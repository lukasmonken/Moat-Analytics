"""Verifica a reconstituição do universo contábil com o FCA disponível na data-base."""

import csv
import io
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from apps.pipeline.src.moat_cvm.refresh_selection import build_refresh_selection


def filing(code, name, received, *, version=1, reference="2024-01-01"):
    document = f"{code}{version}"
    return {
        "CD_CVM": code,
        "DENOM_CIA": name,
        "DT_REFER": reference,
        "DT_RECEB": received,
        "VERSAO": version,
        "CATEG_DOC": "FCA",
        "CNPJ_CIA": f"31.000.000/{int(code):04d}-55",
        "ID_DOC": document,
        "LINK_DOC": f"https://www.rad.cvm.gov.br/ENETCONSULTA/{document}",
    }


def make_archive(folder, year, filings):
    path = folder / f"fca_cia_aberta_{year}.zip"
    with io.StringIO(newline="") as source:
        writer = csv.DictWriter(source, fieldnames=list(filings[0]), delimiter=";")
        writer.writeheader()
        writer.writerows(filings)
        with ZipFile(path, "w") as archive:
            archive.writestr(f"fca_cia_aberta_{year}.csv", source.getvalue().encode("latin1"))
    return path


class RefreshSelectionTest(unittest.TestCase):
    def setUp(self):
        storage = tempfile.TemporaryDirectory()
        self.addCleanup(storage.cleanup)
        self.folder = Path(storage.name)
        self.directory = {
            "schemaVersion": "1.0.0",
            "asOf": "2024-05-01",
            "companies": ["Empresa B", "Empresa Á"],
        }

    def test_resolves_exact_names_from_latest_filings_on_selection_date(self):
        archive = make_archive(self.folder, 2024, [
            filing("000111", "Nome Antigo", "2024-02-15"),
            filing("000111", "Empresa Á", "2024-04-15", version=2),
            filing("000111", "Nome Posterior", "2024-06-01", version=3),
            filing("000222", "Empresa B", "2024-03-01"),
        ])
        self.assertEqual(build_refresh_selection(self.directory, [archive]), {
            "schemaVersion": "1.0.0",
            "asOf": "2024-05-01",
            "companies": [{"cvmCode": 222, "name": "Empresa B"}, {"cvmCode": 111, "name": "Empresa Á"}],
        })
        self.directory["companies"] = ["Nome Antigo"]
        with self.assertRaisesRegex(ValueError, "ausentes no FCA.*Nome Antigo"):
            build_refresh_selection(self.directory, [archive])

    def test_rejects_homonymous_issuer_and_inexact_names(self):
        archive = make_archive(self.folder, 2024, [
            filing("000111", "Empresa Á", "2024-02-15"),
            filing("000333", "Empresa Á", "2024-04-15"),
            filing("000222", "Empresa B", "2024-03-01"),
        ])
        with self.assertRaisesRegex(ValueError, "Nome ambíguo no FCA"):
            build_refresh_selection(self.directory, [archive])
        self.directory["companies"] = ["empresa B"]
        with self.assertRaisesRegex(ValueError, "ausentes no FCA.*empresa B"):
            build_refresh_selection(self.directory, [archive])

    def test_rejects_conflicting_identity_between_archives(self):
        first = make_archive(self.folder, 2023, [
            filing("000111", "Empresa Á", "2024-02-15"),
        ])
        second = make_archive(self.folder, 2024, [
            filing("000111", "Outro nome", "2024-02-15"),
            filing("000222", "Empresa B", "2024-03-01"),
        ])
        with self.assertRaisesRegex(ValueError, "formulários cadastrais conflitantes"):
            build_refresh_selection(self.directory, [second, first])


if __name__ == "__main__":
    unittest.main()
