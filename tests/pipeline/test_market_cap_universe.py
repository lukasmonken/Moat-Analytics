"""Valida o mapa privado de emissores com um recorte sintético."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PIPELINE = REPO / "apps/pipeline"
sys.path.insert(0, str(PIPELINE))

from src.moat_market_identity import create_market_cap_universe, parse_market_cap_universe


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

            self.directory["companies"] = []
            directory.write_text(json.dumps(self.directory), encoding="utf-8")
            invalid = subprocess.run([*command, str(output)], capture_output=True, text=True)
            self.assertNotEqual(invalid.returncode, 0)
            self.assertEqual(output.read_bytes(), previous)


if __name__ == "__main__":
    unittest.main()
