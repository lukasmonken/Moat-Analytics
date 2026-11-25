"""Exercita o vínculo entre emissores e setores com um FCA sintético."""

import csv
import io
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from apps.pipeline.src.moat_cvm.comparison_identity import comparison_identities


def as_csv(rows: list[dict]) -> bytes:
    with io.StringIO(newline="") as text:
        writer = csv.DictWriter(text, fieldnames=list(rows[0]), delimiter=";")
        writer.writeheader()
        writer.writerows(rows)
        return text.getvalue().encode("latin1")


def sample_fca(path: Path, first_sector: str = "Energia Elétrica"):
    filings = []
    general = []
    for code, cnpj, name, sector, version, received in (
        ("000111", "12.345.678/0001-90", "Companhia de Teste", first_sector, 1, "2024-03-01"),
        ("000111", "12.345.678/0001-90", "Companhia Reformulada", "Papel e Celulose", 2, "2024-06-01"),
        ("000222", "12.345.678/0002-90", "Banco de Teste", "Bancos", 1, "2024-04-01"),
    ):
        reference = "2024-01-01"
        document = f"{code}{version}"
        filings.append({
            "CD_CVM": code,
            "CNPJ_CIA": cnpj,
            "DENOM_CIA": name,
            "DT_REFER": reference,
            "DT_RECEB": received,
            "VERSAO": version,
            "ID_DOC": document,
            "CATEG_DOC": "FCA",
            "LINK_DOC": f"http://www.rad.cvm.gov.br/ENETCONSULTA/{document}",
        })
        general.append({
            "Codigo_CVM": code,
            "CNPJ_Companhia": cnpj,
            "Data_Referencia": reference,
            "Versao": version,
            "ID_Documento": document,
            "Nome_Empresarial": name.upper(),
            "Setor_Atividade": sector,
            "Pais_Origem": "Brasil",
            "Categoria_Registro_CVM": "Categoria A",
            "Situacao_Registro_CVM": "Ativo",
        })
    with ZipFile(path, "w") as archive:
        archive.writestr("fca_cia_aberta_2024.csv", as_csv(filings))
        archive.writestr("fca_cia_aberta_geral_2024.csv", as_csv(general))


class ComparisonIdentityTest(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.archive = Path(folder.name) / "fca_cia_aberta_2024.zip"
        self.selection = {
            "schemaVersion": "1.0.0",
            "asOf": "2024-05-01",
            "companies": [
                {"cvmCode": 111, "name": "Companhia de Teste"},
                {"cvmCode": 222, "name": "Banco de Teste"},
            ],
        }
        self.directory = {
            "schemaVersion": "1.0.0",
            "asOf": "2024-05-01",
            "companies": ["Banco de Teste", "Companhia de Teste"],
        }
        sample_fca(self.archive)

    def load(self):
        return comparison_identities(self.selection, self.directory, [self.archive])

    def test_joins_by_filing_identity_and_respects_selection_date(self):
        companies, sources = self.load()
        self.assertEqual(set(companies), {111, 222})
        company = companies[111]
        self.assertEqual(company["name"], "Companhia de Teste")
        self.assertEqual(company["sector"], "Energia Elétrica")
        self.assertEqual(company["cnpj"], "12.345.678/0001-90")
        self.assertEqual(company["classification"], {
            "referenceDate": "2024-01-01",
            "receivedAt": "2024-03-01",
            "version": 1,
            "filingUrl": "https://www.rad.cvm.gov.br/ENETCONSULTA/0001111",
            "archiveYear": 2024,
        })
        self.assertEqual(companies[222]["sector"], "Bancos")
        self.assertEqual(sources[0]["kind"], "fca")
        self.assertRegex(sources[0]["sha256"], r"^[0-9a-f]{64}$")

    def test_rejects_drift_from_public_directory(self):
        self.directory["companies"] = ["Banco de Teste", "Companhia de teste"]
        with self.assertRaisesRegex(ValueError, "nomes.*divergem"):
            self.load()
        self.directory["asOf"] = "2024-05-02"
        with self.assertRaisesRegex(ValueError, "data-base.*diverge"):
            self.load()

    def test_preserves_absence_in_the_source(self):
        sample_fca(self.archive, first_sector="")
        with self.assertRaisesRegex(ValueError, "CVM 111.*setor cadastral indisponível"):
            self.load()


if __name__ == "__main__":
    unittest.main()
