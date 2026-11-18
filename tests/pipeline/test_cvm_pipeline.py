"""Testes offline com DFP sintéticos, usados apenas em diretórios temporários."""

import csv
import hashlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path
from zipfile import ZipFile

REPO = Path(__file__).resolve().parents[2]
PIPELINE = REPO / "apps/pipeline/run_cvm.py"
YEAR = 2025
REFERENCE_DATE = "2025-12-31"
PERIOD_START = "2025-01-01"
RECEIPT_DATE = "2026-02-27"
ARCHIVE_TIME = datetime(2026, 6, 1, tzinfo=UTC).timestamp()
ISSUERS = {"005410": "industry", "008133": "retail", "019348": "bank"}
FILING_FIELDS = ("CNPJ_CIA", "DT_REFER", "VERSAO", "DENOM_CIA", "CD_CVM", "DT_RECEB", "LINK_DOC")
ACCOUNT_FIELDS = (
    "CNPJ_CIA", "CD_CVM", "DT_REFER", "VERSAO", "ORDEM_EXERC", "DT_INI_EXERC",
    "DT_FIM_EXERC", "MOEDA", "ESCALA_MOEDA", "CD_CONTA", "DS_CONTA", "VL_CONTA",
)
NONFINANCIAL_ACCOUNTS = {
    "BPA": {"1": 100, "1.01": 60, "1.01.01": 12, "1.02": 40},
    "BPP": {"2": 100, "2.01": 20, "2.02": 30, "2.03": 50},
    "DRE": {
        "3.01": 90, "3.02": -30, "3.03": 60, "3.04": -5, "3.05": 55, "3.06": -5,
        "3.07": 50, "3.08": -5, "3.09": 45, "3.10": 0, "3.11": 45,
    },
}
BANK_ACCOUNTS = {
    "BPA": {
        "1": 100, "1.01": 60, "1.02": 40, "1.03": 0,
        "1.04": 0, "1.05": 0, "1.06": 0, "1.07": 0,
    },
    "BPP": {
        "2": 100, "2.01": 20, "2.02": 30, "2.03": 0, "2.04": 0,
        "2.05": 0, "2.06": 0, "2.07": 0, "2.08": 50,
    },
    "DRE": {
        "3.01": 90, "3.02": -30, "3.03": 60, "3.04": -10, "3.05": 50,
        "3.06": -5, "3.07": 45, "3.08": 0, "3.09": 45,
    },
}


def csv_bytes(fields, entries):
    out = io.StringIO(newline="")
    writer = csv.DictWriter(out, fieldnames=fields, delimiter=";")
    writer.writeheader()
    writer.writerows(entries)
    return out.getvalue().encode("latin-1")


def build_archive(path, *, divergent=False):
    filings = []
    statements = {statement: [] for statement in NONFINANCIAL_ACCOUNTS}
    for issuer_code, category in ISSUERS.items():
        issuer_fields = {
            "CNPJ_CIA": f"TESTE-{issuer_code}",
            "CD_CVM": issuer_code,
            "DT_REFER": REFERENCE_DATE,
        }
        for version in (1, 2):
            filings.append({
                **issuer_fields,
                "VERSAO": version,
                "DENOM_CIA": f"Companhia de teste {issuer_code}",
                "DT_RECEB": RECEIPT_DATE,
                "LINK_DOC": f"http://www.rad.cvm.gov.br/dfp-{issuer_code}-v{version}",
            })
        accounts = BANK_ACCOUNTS if category == "bank" else NONFINANCIAL_ACCOUNTS
        for statement, codes in accounts.items():
            for account_code, balance in codes.items():
                if divergent and issuer_code == "005410" and account_code == "1":
                    balance = 103
                latest = {
                    **issuer_fields,
                    "VERSAO": 2,
                    "ORDEM_EXERC": "ÚLTIMO",
                    "DT_INI_EXERC": PERIOD_START if statement == "DRE" else "",
                    "DT_FIM_EXERC": REFERENCE_DATE,
                    "MOEDA": "REAL",
                    "ESCALA_MOEDA": "MIL",
                    "CD_CONTA": account_code,
                    "DS_CONTA": f"Conta de teste {account_code}",
                    "VL_CONTA": balance,
                }
                statements[statement].extend([
                    {**latest, "VERSAO": 1, "VL_CONTA": 999},
                    {
                        **latest, "ORDEM_EXERC": "PENÚLTIMO",
                        "DT_FIM_EXERC": "2024-12-31", "VL_CONTA": 999,
                    },
                    latest,
                ])

    with ZipFile(path, "w") as archive:
        archive.writestr(f"dfp_cia_aberta_{YEAR}.csv", csv_bytes(FILING_FIELDS, filings))
        for statement, entries in statements.items():
            archive.writestr(
                f"dfp_cia_aberta_{statement}_con_{YEAR}.csv",
                csv_bytes(ACCOUNT_FIELDS, entries),
            )
        archive.writestr(f"dfp_cia_aberta_BPA_ind_{YEAR}.csv", "Demonstrativo individual de teste.")
    os.utime(path, (ARCHIVE_TIME, ARCHIVE_TIME))


class DfpPipelineTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        self.archive = root / f"dfp_cia_aberta_{YEAR}.zip"
        self.output = root / "public" / "cvm-sample.json"

    def run_pipeline(self):
        return subprocess.run(
            [
                sys.executable, str(PIPELINE), "--offline",
                "--start-year", str(YEAR), "--end-year", str(YEAR),
                "--raw-dir", str(self.archive.parent), "--output", str(self.output),
            ],
            cwd=REPO, capture_output=True, encoding="utf-8", timeout=15, check=False,
        )

    def publish_valid_fixture(self):
        build_archive(self.archive)
        result = self.run_pipeline()
        self.assertEqual(result.returncode, 0, result.stderr)
        return self.output.read_bytes()

    def test_selects_latest_consolidated_filing_and_normalizes_units(self):
        snapshot = json.loads(self.publish_valid_fixture())
        self.assertEqual(snapshot["manifest"]["asOf"], REFERENCE_DATE)
        self.assertEqual(
            snapshot["manifest"]["coverage"],
            {"eligibleCompanies": None, "includedCompanies": 3},
        )
        digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()

        for company in snapshot["companies"]:
            with self.subTest(company=company["companyId"]):
                category = ISSUERS[f'{company["cvmCode"]:06}']
                self.assertEqual(company["category"], category)
                self.assertEqual(len(company["observations"]), 1)
                observation = company["observations"][0]
                self.assertEqual(observation["periodStart"], PERIOD_START)
                self.assertEqual(observation["filingVersion"], 2)
                self.assertEqual(observation["receiptDate"], RECEIPT_DATE)
                self.assertEqual(observation["archiveSha256"], digest)
                self.assertIn("-v2", observation["documentUrl"])
                self.assertTrue(observation["documentUrl"].startswith("https://"))
                self.assertEqual(
                    observation["provenance"]["retrievedAt"],
                    datetime.fromtimestamp(ARCHIVE_TIME, UTC).isoformat(timespec="seconds"),
                )
                self.assertIsNone(observation["provenance"]["publishedAt"])
                values = {row["key"]: row["amountBrl"] for row in observation["accounts"]}
                self.assertEqual(values["bpa:1"], 100_000)
                self.assertEqual(values["dre:3.02"], -30_000)
                self.assertEqual(values["dre:3.09" if category == "bank" else "dre:3.11"], 45_000)
                self.assertEqual(len(observation["reconciliations"]), 5)
                self.assertTrue(all(
                    check["status"] == "passed" and check["differenceBrl"] == 0
                    for check in observation["reconciliations"]
                ))

    def test_preserves_last_snapshot_on_divergent_balance_and_invalid_zip(self):
        previous = self.publish_valid_fixture()
        build_archive(self.archive, divergent=True)
        result = self.run_pipeline()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("Ativo total e passivo total", result.stderr)
        self.assertEqual(self.output.read_bytes(), previous)

        self.archive.write_bytes(b"ZIP sintetico corrompido")
        result = self.run_pipeline()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("Snapshot anterior preservado", result.stderr)
        self.assertEqual(self.output.read_bytes(), previous)

    def test_leaves_unchanged_snapshot_on_repeated_run(self):
        previous = self.publish_valid_fixture()
        os.utime(self.output, (ARCHIVE_TIME, ARCHIVE_TIME))
        previous_mtime = self.output.stat().st_mtime_ns

        result = self.run_pipeline()

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.output.read_bytes(), previous)
        self.assertEqual(self.output.stat().st_mtime_ns, previous_mtime)


if __name__ == "__main__":
    unittest.main()
