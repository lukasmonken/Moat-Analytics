"""Valida o mapa privado de emissores com um recorte sintético."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

REPO = Path(__file__).resolve().parents[2]
PIPELINE = REPO / "apps/pipeline"
sys.path.insert(0, str(PIPELINE))

from src.moat_market_identity import create_market_cap_universe, parse_market_cap_universe
from test_index_universe import synthetic_csv


class MarketCapUniverseTests(unittest.TestCase):
    def setUp(self):
        self.selection = {
            "schemaVersion": "1.0.0",
            "asOf": "2026-11-18",
            "companies": [
                {
                    "companyId": "cvm:456",
                    "cvmCode": 456,
                    "name": "Emissora sem código disponível",
                    "securities": None,
                    "representativeTicker": None,
                },
                {
                    "companyId": "cvm:123",
                    "cvmCode": 123,
                    "name": "Companhia de teste",
                    "indexMemberships": ["IBOV"],
                    "securities": [
                        {"ticker": "TEST3", "indexMemberships": ["IBOV"]},
                        {"ticker": "TEST4", "indexMemberships": ["IBOV"]},
                        {"ticker": "TEST4", "indexMemberships": ["IDIV"]},
                    ],
                    "representativeTicker": "TEST4",
                },
            ],
        }
        self.directory = {
            "schemaVersion": "1.0.0",
            "asOf": "2026-11-18",
            "companies": [company["name"] for company in self.selection["companies"]],
        }

    def test_projects_candidates_without_affiliations_and_keeps_empty_rows(self):
        universe = create_market_cap_universe(self.selection, self.directory)
        self.assertEqual(universe, {
            "asOf": "2026-11-18",
            "companies": [
                {"companyId": "cvm:123", "name": "Companhia de teste", "tickers": ["TEST4", "TEST3"]},
                {"companyId": "cvm:456", "name": "Emissora sem código disponível", "tickers": []},
            ],
        })
        self.selection["companies"][1]["representativeTicker"] = "OTHR11"
        fallback = create_market_cap_universe(self.selection, self.directory)
        self.assertEqual(fallback["companies"][0]["tickers"], ["TEST3", "TEST4"])

    def test_requires_directory_names_and_selection_date_to_agree(self):
        self.directory["companies"][1] = "Nome diferente"
        with self.assertRaisesRegex(ValueError, "nomes"):
            create_market_cap_universe(self.selection, self.directory)
        self.directory["asOf"] = "2026-11-17"
        with self.assertRaisesRegex(ValueError, "data-base"):
            create_market_cap_universe(self.selection, self.directory)

    def test_rejects_tickers_shared_across_issuers_and_unstripped_data(self):
        universe = create_market_cap_universe(self.selection, self.directory)
        universe["companies"][1]["tickers"] = ["TEST3"]
        with self.assertRaisesRegex(ValueError, "Ticker duplicado"):
            parse_market_cap_universe(universe)
        with self.assertRaisesRegex(ValueError, "Formato inválido"):
            parse_market_cap_universe(self.selection)

    def test_fca_appends_only_current_unambiguous_codes_after_selected_candidates(self):
        filings, general, securities = [], [], []
        for company in self.selection["companies"]:
            code = company["cvmCode"]
            for version, received in (("1", "2026-02-01"), ("2", "2026-11-19")):
                cnpj = f"12.345.{code:03}/0001-90"
                document = f"{code}{version}"
                base = {
                    "CNPJ_Companhia": cnpj,
                    "Data_Referencia": "2026-01-01",
                    "Versao": version,
                    "ID_Documento": document,
                }
                filings.append({
                    "CD_CVM": f"{code:06}",
                    "CNPJ_CIA": cnpj,
                    "DT_REFER": "2026-01-01",
                    "DT_RECEB": received,
                    "VERSAO": version,
                    "ID_DOC": document,
                    "DENOM_CIA": company["name"],
                })
                general.append({
                    **base,
                    "Codigo_CVM": code,
                    "Pais_Origem": "Brasil",
                    "Categoria_Registro_CVM": "Categoria A",
                    "Situacao_Registro_CVM": "Ativo",
                })
                candidates = [("NEXT3", "Ações Ordinárias", "", "")] if version == "2" else [
                    ("DUPE3", "Ações Ordinárias", "", ""),
                    ("TEST4", "Ações Preferenciais", "", ""),
                    ("FUND11", "Título de Investimento Coletivo", "", ""),
                    ("OLDX3", "Ações Ordinárias", "", "2026-11-18"),
                    ("FUTR3", "Ações Ordinárias", "2026-11-19", ""),
                    (("TEST11" if code == 123 else "EMIS3"), "Units", "", ""),
                ]
                for ticker, kind, start, end in candidates:
                    securities.append({
                        **base,
                        "Sigla_Entidade_Administradora": "B3",
                        "Mercado": "Bolsa",
                        "Valor_Mobiliario": kind,
                        "Data_Inicio_Negociacao": start or "2026-01-01",
                        "Data_Fim_Negociacao": end,
                        "Data_Inicio_Listagem": "2026-01-01",
                        "Data_Fim_Listagem": "",
                        "Codigo_Negociacao": ticker,
                    })

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fca = root / "fca_cia_aberta_2026.zip"
            with ZipFile(fca, "w") as archive:
                archive.writestr("fca_cia_aberta_2026.csv", synthetic_csv(filings))
                archive.writestr("fca_cia_aberta_geral_2026.csv", synthetic_csv(general))
                archive.writestr("fca_cia_aberta_valor_mobiliario_2026.csv", synthetic_csv(securities))

            selection, directory, output = (root / file for file in ("selection", "directory", "universe"))
            selection.write_text(json.dumps(self.selection), encoding="utf-8")
            directory.write_text(json.dumps(self.directory), encoding="utf-8")
            run = subprocess.run(
                [
                    sys.executable, str(PIPELINE / "run_market_cap_universe.py"),
                    "--selection", str(selection), "--directory", str(directory),
                    "--fca", str(fca), "--output", str(output),
                ],
                capture_output=True, text=True,
            )
            self.assertEqual(run.returncode, 0, run.stderr)
            result = parse_market_cap_universe(json.loads(output.read_text(encoding="utf-8")))
        self.assertEqual([company["tickers"] for company in result["companies"]], [
            ["TEST4", "TEST3", "TEST11"], ["EMIS3"],
        ])

    def test_cli_keeps_previous_output_on_failed_validation_and_blocks_public_output(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            selection, directory, output = (root / filename for filename in ("selection", "directory", "universe"))
            selection.write_text(json.dumps(self.selection), encoding="utf-8")
            directory.write_text(json.dumps(self.directory), encoding="utf-8")
            command = [
                sys.executable, str(PIPELINE / "run_market_cap_universe.py"),
                "--selection", str(selection), "--directory", str(directory), "--output",
            ]
            run = subprocess.run([*command, str(output)], capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertIn("1 de 2 empresas com candidatos", run.stdout)
            previous = output.read_bytes()

            public = subprocess.run(
                [*command, str(REPO / "data/public/cvm-company-selection.json")],
                capture_output=True, text=True,
            )
            self.assertNotEqual(public.returncode, 0)
            self.assertIn("data/processed/market-caps", public.stderr)

            bad_archive = root / "fca_cia_aberta_2026.zip"
            bad_archive.write_text("Arquivo inválido.", encoding="utf-8")
            invalid_archive = subprocess.run(
                [*command, str(output), "--fca", str(bad_archive)], capture_output=True, text=True,
            )
            self.assertNotEqual(invalid_archive.returncode, 0)
            self.assertIn("Mapa rejeitado", invalid_archive.stderr)
            self.assertEqual(output.read_bytes(), previous)

            self.directory["companies"] = []
            directory.write_text(json.dumps(self.directory), encoding="utf-8")
            invalid = subprocess.run([*command, str(output)], capture_output=True, text=True)
            self.assertNotEqual(invalid.returncode, 0)
            self.assertEqual(output.read_bytes(), previous)


if __name__ == "__main__":
    unittest.main()
