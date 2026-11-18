"""Mapeia e concilia demonstrações anuais consolidadas da amostra CVM."""

from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path
from zipfile import ZipFile

from .archives import csv_rows, read_archive
from .sample import COMPANIES

ORIGIN = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS/"
SOURCE = {
    "name": "Comissão de Valores Mobiliários (CVM)",
    "datasetUrl": "https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp",
    "license": "ODbL-1.0",
    "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
}
GROUPS = {
    "nonfinancial": {
        "BPA": ("1", "1.01", "1.01.01", "1.02"),
        "BPP": ("2", "2.01", "2.02", "2.03"),
        "DRE": tuple(f"3.{index:02}" for index in range(1, 12)),
    },
    "bank": {
        "BPA": ("1", *(f"1.{index:02}" for index in range(1, 8))),
        "BPP": ("2", *(f"2.{index:02}" for index in range(1, 9))),
        "DRE": tuple(f"3.{index:02}" for index in range(1, 10)),
    },
}
SCALES = {"MIL": Decimal(1000), "UNIDADE": Decimal(1)}
CsvRow = dict[str, str]
AccountKey = tuple[str, str]


def account_group(code: str) -> dict[str, tuple[str, ...]]:
    return GROUPS["bank" if COMPANIES[code] == "bank" else "nonfinancial"]


def select_filings(archive: ZipFile, year: int, reference: str) -> dict[str, CsvRow]:
    filings = {}
    for row in csv_rows(archive, f"dfp_cia_aberta_{year}.csv"):
        code = row["CD_CVM"]
        if code not in COMPANIES or row["DT_REFER"] != reference:
            continue
        version = int(row["VERSAO"])
        if version < 1:
            raise ValueError(f"{year} CVM {code}: versão de DFP inválida.")
        selected = filings.get(code)
        if selected and int(selected["VERSAO"]) == version and selected != row:
            raise ValueError(f"{year} CVM {code}: metadados conflitantes na mesma versão.")
        if not selected or version > int(selected["VERSAO"]):
            filings[code] = row

    missing = COMPANIES.keys() - filings.keys()
    if missing:
        raise ValueError(f"{year}: DFP ausente para CVM {', '.join(sorted(missing))}.")
    return filings


def read_accounts(
    archive: ZipFile,
    year: int,
    start: str,
    reference: str,
    filings: dict[str, CsvRow],
) -> dict[str, dict[AccountKey, CsvRow]]:
    accounts: dict[str, dict[AccountKey, CsvRow]] = {code: {} for code in filings}
    for statement in ("BPA", "BPP", "DRE"):
        member = f"dfp_cia_aberta_{statement}_con_{year}.csv"
        for row in csv_rows(archive, member):
            code = row["CD_CVM"]
            filing = filings.get(code)
            if not filing or row["ORDEM_EXERC"] != "ÚLTIMO":
                continue
            if row["DT_REFER"] != reference or row["DT_FIM_EXERC"] != reference:
                continue
            if row["VERSAO"] != filing["VERSAO"] or row["CNPJ_CIA"] != filing["CNPJ_CIA"]:
                continue
            if statement == "DRE" and row["DT_INI_EXERC"] != start:
                continue
            if row["CD_CONTA"] not in account_group(code)[statement]:
                continue
            key = (statement, row["CD_CONTA"])
            if key in accounts[code]:
                raise ValueError(f"{year} CVM {code}: conta duplicada {statement} {key[1]}.")
            accounts[code][key] = row
    return accounts


def normalize(row: CsvRow) -> tuple[Decimal, Decimal]:
    if row["MOEDA"] != "REAL" or row["ESCALA_MOEDA"] not in SCALES:
        raise ValueError(f"Moeda ou escala não suportada na conta {row['CD_CONTA']}.")
    scale = SCALES[row["ESCALA_MOEDA"]]
    value = Decimal(row["VL_CONTA"]) * scale
    if not value.is_finite() or abs(value) >= 2**53:
        raise ValueError(f"Valor inválido na conta {row['CD_CONTA']}.")
    return value, scale


def amount(number: Decimal) -> int | float:
    return int(number) if number == number.to_integral_value() else float(number)


def build_reconciliations(
    code: str,
    reference: str,
    values: dict[AccountKey, tuple[Decimal, Decimal]],
) -> list[dict]:
    def check(key: str, label: str, target: AccountKey, parts: list[AccountKey]) -> dict:
        base, precision = values[target]
        components = [values[part] for part in parts]
        delta = base - sum(item[0] for item in components)
        tolerance = (precision + sum(item[1] for item in components)) / 2
        if abs(delta) > tolerance:
            raise ValueError(f"{reference} CVM {code}: {label}, diferença de {delta} BRL.")
        return {"key": key, "label": label, "status": "passed", "differenceBrl": amount(delta)}

    group = account_group(code)
    bank = COMPANIES[code] == "bank"
    assets = group["BPA"][1:] if bank else ("1.01", "1.02")
    continuance, discontinued, net = ("3.07", "3.08", "3.09") if bank else ("3.09", "3.10", "3.11")
    return [
        check("balance", "Ativo total e passivo total", ("BPA", "1"), [("BPP", "2")]),
        check("assets", "Composição do ativo total", ("BPA", "1"), [("BPA", a) for a in assets]),
        check(
            "liabilities", "Composição do passivo total", ("BPP", "2"),
            [("BPP", a) for a in group["BPP"][1:]],
        ),
        check(
            "gross", "Composição do resultado bruto", ("DRE", "3.03"),
            [("DRE", "3.01"), ("DRE", "3.02")],
        ),
        check(
            "net", "Composição do resultado consolidado", ("DRE", net),
            [("DRE", continuance), ("DRE", discontinued)],
        ),
    ]


def observations(archive: Path, year: int):
    reference = f"{year}-12-31"
    start = f"{year}-01-01"
    with read_archive(archive) as (data, checksum, collected):
        filings = select_filings(data, year, reference)
        groups = read_accounts(data, year, start, reference, filings)

    for code, group in groups.items():
        required = [
            (statement, account)
            for statement, codes in account_group(code).items()
            for account in codes
        ]
        missing = [f"{s}:{a}" for s, a in required if (s, a) not in group]
        if missing:
            raise ValueError(f"{year} CVM {code}: faltam contas ({', '.join(missing)}).")

        values = {key: normalize(group[key]) for key in required}
        filing = filings[code]
        receipt = date.fromisoformat(filing["DT_RECEB"]).isoformat()
        if not reference <= receipt <= collected.date().isoformat():
            raise ValueError(f"{year} CVM {code}: data de recebimento incompatível com a coleta.")
        doc = filing["LINK_DOC"].replace("http://www.rad.cvm.gov.br/", "https://www.rad.cvm.gov.br/", 1)
        if not doc.startswith("https://www.rad.cvm.gov.br/"):
            raise ValueError(f"{year} CVM {code}: endereço do documento incompatível.")

        yield code, filing["DENOM_CIA"], {
            "fiscalYear": year,
            "referenceDate": reference,
            "periodStart": start,
            "filingVersion": int(filing["VERSAO"]),
            "receiptDate": receipt,
            "documentUrl": doc,
            "archiveUrl": f"{ORIGIN}dfp_cia_aberta_{year}.zip",
            "archiveSha256": checksum,
            "provenance": {
                "source": "CVM · DFP anual consolidado",
                "referenceDate": reference,
                "publishedAt": None,
                "retrievedAt": collected.isoformat(timespec="seconds"),
                "methodologyVersion": "cvm-dfp-m1.v1",
                "qualityStatus": "validated",
            },
            "accounts": [
                {
                    "key": f"{statement.lower()}:{account}",
                    "statement": statement,
                    "code": account,
                    "label": group[(statement, account)]["DS_CONTA"],
                    "amountBrl": amount(values[(statement, account)][0]),
                }
                for statement, account in required
            ],
            "reconciliations": build_reconciliations(code, reference, values),
        }


def create_snapshot(archives: dict[int, Path]) -> dict:
    companies = {
        code: {
            "companyId": f"cvm:{int(code)}",
            "cvmCode": int(code),
            "category": category,
            "observations": [],
        }
        for code, category in COMPANIES.items()
    }
    for year, archive in sorted(archives.items()):
        for code, name, record in observations(archive, year):
            companies[code]["name"] = name
            companies[code]["observations"].append(record)

    return {
        "manifest": {
            "schemaVersion": "1.0.0",
            "generatedAt": datetime.now(UTC).isoformat(timespec="seconds"),
            "asOf": f"{max(archives)}-12-31",
            "coverage": {"eligibleCompanies": None, "includedCompanies": len(companies)},
            "source": SOURCE,
        },
        "companies": list(companies.values()),
        "issues": [],
    }
