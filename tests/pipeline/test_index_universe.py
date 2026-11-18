"""Exercita a importação anual exclusivamente com dados sintéticos."""

import csv
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

REPO = Path(__file__).resolve().parents[2]
COMMAND = REPO / "apps/pipeline/run_index_universe.py"
DIRECTORY_COMMAND = REPO / "apps/pipeline/run_company_selection.py"
ISSUER_A = "12.345.678/0001-90"
ISSUER_B = "12.345.678/0002-90"


def synthetic_csv(rows: list[dict]) -> bytes:
    with io.StringIO(newline="") as text:
        writer = csv.DictWriter(text, fieldnames=list(rows[0]), delimiter=";")
        writer.writeheader()
        writer.writerows(rows)
        return text.getvalue().encode("latin1")


def synthetic_fca(path: Path) -> None:
    filings = []
    general = []
    securities = []
    for code, cnpj, name, country, document in (
        ("000111", ISSUER_A, "Companhia de teste", "Brasil", "1"),
        ("000222", ISSUER_B, "Emissora de teste", "Brasil", "2"),
        ("000333", "98.765.432/0001-90", "Emissora estrangeira de teste", "Bermudas", "3"),
    ):
        base = {
            "CNPJ_Companhia": cnpj,
            "Data_Referencia": "2025-01-01",
            "Versao": "1",
            "ID_Documento": document,
        }
        filings.append(
            {
                "CD_CVM": code,
                "CNPJ_CIA": cnpj,
                "DT_REFER": "2025-01-01",
                "VERSAO": "1",
                "DT_RECEB": "2025-02-01",
                "ID_DOC": document,
                "DENOM_CIA": name,
            }
        )
        general.append(
            {
                **base,
                "Codigo_CVM": code,
                "Pais_Origem": country,
                "Categoria_Registro_CVM": "Categoria A",
                "Situacao_Registro_CVM": "Ativo",
            }
        )
        for ticker, kind in {
            "1": (
                ("test3", "Ações Ordinárias"),
                ("TEST4", "Ações Preferenciais"),
                ("FUND11", "Título de Investimento Coletivo"),
            ),
            "2": (("DEMO3", "Ações Ordinárias"),),
            "3": (("OTHR3", "Ações Ordinárias"),),
        }[document]:
            securities.append(
                {
                    **base,
                    "Sigla_Entidade_Administradora": "B3",
                    "Mercado": "Bolsa",
                    "Valor_Mobiliario": kind,
                    "Data_Inicio_Negociacao": "2025-01-01",
                    "Data_Fim_Negociacao": "",
                    "Data_Inicio_Listagem": "2025-01-01",
                    "Data_Fim_Listagem": "",
                    "Codigo_Negociacao": ticker,
                }
            )

    with ZipFile(path, "w") as archive:
        archive.writestr("fca_cia_aberta_2025.csv", synthetic_csv(filings))
        archive.writestr("fca_cia_aberta_geral_2025.csv", synthetic_csv(general))
        archive.writestr("fca_cia_aberta_valor_mobiliario_2025.csv", synthetic_csv(securities))


class IndexUniverseTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.fca = self.root / "fca_cia_aberta_2025.zip"
        self.output = self.root / "universe.json"
        self.history = self.root / "history"
        synthetic_fca(self.fca)

    def run_import(self, *inputs: str, as_of: str = "2025-05-07"):
        return subprocess.run(
            [
                sys.executable, str(COMMAND), *inputs,
                "--source", "Composição sintética", "--as-of", as_of,
                "--fca-archive", str(self.fca), "--output", str(self.output),
                "--history-dir", str(self.history),
            ],
            cwd=REPO, capture_output=True, encoding="utf-8", timeout=15, check=False,
        )

    def write_csv(self, rows: str) -> Path:
        path = self.root / "combined.csv"
        path.write_text("indice,ticker,codigo_cvm\n" + rows, encoding="utf-8")
        return path

    def test_native_exports_union_classes_and_idempotence(self):
        flags = []
        for index, ticker, kind in [
            ("IBOV", "TEST3", "ON"),
            ("SMLL", "TEST4", "PNB"),
            ("IDIV", "DEMO3", "ON"),
        ]:
            path = self.root / f"{index}.csv"
            path.write_text(
                f"{index} - Carteira do Dia 07/05/25\n"
                "Código;Ação;Tipo;Qtde. Teórica;Part. (%)\n"
                f"{ticker};AÇÃO;{kind} NM;1.000;100,000;\n"
                "Quantidade Teórica Total;;;1.000;100,000\n"
                "Redutor;;;50\n",
                encoding="latin1",
            )
            flags.extend([f"--{index.lower()}", str(path)])
        first = self.run_import(*flags)
        self.assertEqual(first.returncode, 0, first.stderr)
        data = json.loads(self.output.read_text(encoding="utf-8"))
        self.assertEqual(data["asOf"], "2025-05-07")
        self.assertEqual(data["coverage"], {
            "includedCompanies": 2, "byIndex": {"IBOV": 1, "SMLL": 1, "IDIV": 1},
        })
        self.assertEqual(data["companies"][0]["indexMemberships"], ["IBOV", "SMLL"])
        self.assertEqual(data["companies"][0]["securities"], [
            {"ticker": "TEST3", "kind": "ON", "indexMemberships": ["IBOV"]},
            {"ticker": "TEST4", "kind": "PN", "indexMemberships": ["SMLL"]},
        ])
        self.assertIsNone(data["companies"][0]["representativeTicker"])
        self.assertIsNone(data["source"]["redistributionBasis"])

        previous = self.output.read_bytes()
        self.assertEqual(self.run_import(*flags).returncode, 0)
        self.assertEqual(self.output.read_bytes(), previous)
        self.assertEqual(len(list(self.history.glob("*.json"))), 1)

        rejected = self.run_import(*flags, as_of="2025-05-08")
        self.assertNotEqual(rejected.returncode, 0)
        self.assertIn("data-base divergente", rejected.stderr)
        self.assertEqual(self.output.read_bytes(), previous)

        ibov = self.root / "IBOV.csv"
        content = ibov.read_text(encoding="latin1").replace(
            "Quantidade Teórica Total;;;1.000", "Quantidade Teórica Total;;;2.000"
        )
        ibov.write_text(content, encoding="latin1")
        rejected = self.run_import(*flags)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertIn("diverge do rodapé", rejected.stderr)
        self.assertEqual(self.output.read_bytes(), previous)

    def test_rejects_excluded_vehicles_and_leaves_existing_snapshot(self):
        path = self.write_csv("IBOV,TEST3,111\nSMLL,TEST4,111\nIDIV,DEMO3,222\n")
        good = self.run_import("--input", str(path))
        self.assertEqual(good.returncode, 0, good.stderr)
        previous = self.output.read_bytes()
        path = self.write_csv("IBOV,FUND11,111\nSMLL,OTHR3,333\nIDIV,FAKE3,\n")
        rejected = self.run_import("--input", str(path))
        self.assertNotEqual(rejected.returncode, 0)
        for ticker in ("FUND11", "OTHR3", "FAKE3"):
            self.assertIn(ticker, rejected.stderr)
        self.assertEqual(self.output.read_bytes(), previous)
        self.assertEqual(len(list(self.history.glob("*.json"))), 1)

    def test_reviewed_override_and_older_vintage_remain_auditable(self):
        path = self.write_csv("IBOV,TEST3,111\nSMLL,TEST4,111\nIDIV,DEMO3,222\n")
        good = self.run_import("--input", str(path))
        self.assertEqual(good.returncode, 0, good.stderr)
        previous = self.output.read_bytes()
        path = self.write_csv("IBOV,TEST3,111\nSMLL,TEST4,111\nIDIV,REVI3,222\n")
        override = self.root / "override.csv"
        override.write_text(
            "data_base,ticker,codigo_cvm,cnpj,companhia,tipo,fonte_url,justificativa\n"
            f"2025-03-08,REVI3,222,{ISSUER_B},Emissora de teste,ON,https://example.org/,Teste\n",
            encoding="utf-8",
        )
        archived = self.run_import(
            "--input", str(path), "--identity-overrides", str(override), as_of="2025-03-08"
        )
        self.assertEqual(archived.returncode, 0, archived.stderr)
        self.assertEqual(self.output.read_bytes(), previous)
        snapshots = list(self.history.glob("2025-03-08-*.json"))
        self.assertEqual(len(snapshots), 1)
        old = json.loads(snapshots[0].read_text(encoding="utf-8"))
        self.assertEqual(old["identityOverrides"][0]["ticker"], "REVI3")
        self.assertEqual(old["identityOverrides"][0]["companyId"], "cvm:222")
        self.assertEqual(len(old["identityOverridesSha256"]), 64)

    def test_public_directory_uses_only_the_official_company_names(self):
        path = self.write_csv("IBOV,TEST3,111\nSMLL,TEST4,111\nIDIV,DEMO3,222\n")
        imported = self.run_import("--input", str(path))
        self.assertEqual(imported.returncode, 0, imported.stderr)
        local = json.loads(self.output.read_text(encoding="utf-8"))
        local["companies"][0]["name"] = "Rótulo do arquivo de entrada"
        self.output.write_text(json.dumps(local), encoding="utf-8")
        directory = self.root / "company-directory.json"
        result = subprocess.run(
            [
                sys.executable, str(DIRECTORY_COMMAND), "--selection", str(self.output),
                "--fca-archive", str(self.fca), "--output", str(directory),
            ],
            cwd=REPO, capture_output=True, encoding="utf-8", timeout=15, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        published = json.loads(directory.read_text(encoding="utf-8"))
        self.assertEqual(set(published), {"schemaVersion", "asOf", "source", "companies"})
        self.assertEqual(published["companies"], ["Companhia de teste", "Emissora de teste"])
        self.assertEqual(published["source"]["license"], "ODbL-1.0")


if __name__ == "__main__":
    unittest.main()
