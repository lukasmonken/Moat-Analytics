"""Testa janelas acumuladas de DFP e ITR em arquivos temporários."""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path
from zipfile import ZipFile

from test_cvm_pipeline import ACCOUNT_FIELDS, FILING_FIELDS, csv_bytes

REPO = Path(__file__).resolve().parents[2]
PIPELINE = REPO / "apps/pipeline/run_price_fundamentals.py"
REFERENCE = "2026-09-30"
COLLECTED = datetime(2026, 11, 16, tzinfo=UTC).timestamp()


def make_archive(path, form, reference, periods, *, incomplete_weg=False):
    filings = []
    rows = []
    for code in ("005410", "019348"):
        issuer = {"CD_CVM": code, "CNPJ_CIA": f"TESTE-{code}", "DT_REFER": reference}
        for version in (1, 2):
            filing = {**issuer, "VERSAO": version}
            filings.append({
                **filing,
                "DENOM_CIA": f"Companhia de teste {code}",
                "CATEG_DOC": form,
                "DT_RECEB": "2026-02-27" if form == "DFP" else "2026-11-03",
                "LINK_DOC": f"http://www.rad.cvm.gov.br/{form}-{code}-v{version}",
            })
            for order, start, end, operating_income, parent_income in periods:
                if incomplete_weg and code == "005410" and version == 2 and order == "PENÚLTIMO":
                    continue
                multiplier = 1 if version == 2 else 10
                if code == "005410":
                    operating = operating_income * multiplier
                    accounts = (
                        ("3.03", "Resultado Bruto", operating + 20),
                        ("3.04", "Despesas/Receitas Operacionais", -20),
                        ("3.05", "Resultado Antes do Resultado Financeiro e dos Tributos", operating),
                    )
                else:
                    income = parent_income * multiplier
                    accounts = (
                        ("3.09", "Lucro/Prejuízo Consolidado do Período", income + 2),
                        ("3.09.01", "Atribuído a Sócios da Empresa Controladora", income),
                        ("3.09.02", "Atribuído a Sócios Não Controladores", 2),
                    )
                for account, label, value in accounts:
                    rows.append({
                        **filing,
                        "ORDEM_EXERC": order,
                        "DT_INI_EXERC": start,
                        "DT_FIM_EXERC": end,
                        "MOEDA": "REAL",
                        "ESCALA_MOEDA": "MIL",
                        "CD_CONTA": account,
                        "DS_CONTA": label,
                        "VL_CONTA": value,
                    })
    member = form.lower() + "_cia_aberta"
    year = reference[:4]
    with ZipFile(path, "w") as archive:
        archive.writestr(f"{member}_{year}.csv", csv_bytes((*FILING_FIELDS, "CATEG_DOC"), filings))
        archive.writestr(f"{member}_DRE_con_{year}.csv", csv_bytes(ACCOUNT_FIELDS, rows))
    os.utime(path, (COLLECTED, COLLECTED))


class PriceFundamentalsPipelineTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.output = self.root / "cvm-price-fundamentals.json"
        self.annual = self.root / "dfp_cia_aberta_2025.zip"
        self.interim = self.root / "itr_cia_aberta_2026.zip"
        make_archive(
            self.annual, "DFP", "2025-12-31",
            [("ÚLTIMO", "2025-01-01", "2025-12-31", 500, 40)],
        )
        self.make_itr()

    def make_itr(self, *, incomplete_weg=False):
        make_archive(
            self.interim, "ITR", REFERENCE, [
                ("ÚLTIMO", "2026-01-01", REFERENCE, 450, 32),
                ("PENÚLTIMO", "2025-01-01", "2025-09-30", 400, 25),
                ("ÚLTIMO", "2026-07-01", REFERENCE, 99, 9),
                ("PENÚLTIMO", "2025-07-01", "2025-09-30", 80, 5),
            ],
            incomplete_weg=incomplete_weg,
        )

    def run_pipeline(self):
        return subprocess.run(
            [
                sys.executable, str(PIPELINE),
                "--raw-dir", str(self.root), "--output", str(self.output),
                "--reference-date", REFERENCE,
            ],
            cwd=REPO, capture_output=True, text=True, timeout=15, check=False,
        )

    def read_snapshot(self):
        result = self.run_pipeline()
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(self.output.read_bytes())

    def test_uses_accumulated_current_and_prior_from_latest_itr(self):
        snapshot = self.read_snapshot()
        companies = {company["companyId"]: company for company in snapshot["companies"]}
        self.assertEqual(snapshot["manifest"]["asOf"], REFERENCE)
        self.assertEqual(set(companies), {"cvm:5410", "cvm:19348"})
        self.assertEqual(snapshot["issues"][0]["companyId"], "cvm:8133")

        weg = companies["cvm:5410"]
        self.assertEqual((weg["periodStart"], weg["periodEnd"]), ("2025-10-01", REFERENCE))
        self.assertEqual(weg["incomeTtmBrl"], 550_000)
        self.assertEqual(weg["amountBrl"], 363_000)
        self.assertEqual(weg["taxRate"], 0.34)
        self.assertEqual(weg["provenance"]["qualityStatus"], "estimated")
        inputs = {row["role"]: row for row in weg["inputs"]}
        self.assertEqual(
            [inputs[key]["amountBrl"] for key in ("annual", "currentYtd", "priorYtd")],
            [500_000, 450_000, 400_000],
        )
        self.assertEqual(inputs["currentYtd"]["archiveSha256"], inputs["priorYtd"]["archiveSha256"])
        self.assertEqual(inputs["currentYtd"]["documentUrl"], inputs["priorYtd"]["documentUrl"])
        self.assertTrue(all(row["filingVersion"] == 2 for row in inputs.values()))

        itau = companies["cvm:19348"]
        self.assertEqual(itau["amountBrl"], 47_000)
        self.assertIsNone(itau["taxRate"])
        self.assertEqual(itau["provenance"]["qualityStatus"], "validated")

    def test_never_falls_back_to_prior_version_with_missing_comparative(self):
        self.make_itr(incomplete_weg=True)
        snapshot = self.read_snapshot()
        self.assertEqual([company["companyId"] for company in snapshot["companies"]], ["cvm:19348"])
        issue = next(issue for issue in snapshot["issues"] if issue["companyId"] == "cvm:5410")
        self.assertIn("Faltam as contas", issue["message"])
        self.assertIn("2025-09-30", issue["message"])

    def test_unchanged_on_repeat_and_failed_import(self):
        self.read_snapshot()
        previous = self.output.read_bytes()
        os.utime(self.output, (COLLECTED, COLLECTED))
        before = self.output.stat().st_mtime_ns

        repeat = self.run_pipeline()
        self.assertEqual(repeat.returncode, 0, repeat.stderr)
        self.assertEqual(self.output.stat().st_mtime_ns, before)
        self.interim.write_bytes(b"ITR corrompido")
        failure = self.run_pipeline()
        self.assertNotEqual(failure.returncode, 0)
        self.assertIn("Snapshot anterior preservado", failure.stderr)
        self.assertEqual(self.output.read_bytes(), previous)
