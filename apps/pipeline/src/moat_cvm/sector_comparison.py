"""Calcula ROE atribuível à controladora em DFP consolidada, por exercício civil."""

from collections.abc import Callable
from datetime import UTC, date, datetime
from decimal import Decimal, DecimalException
from functools import cache
from pathlib import Path
from zipfile import ZipFile

from moat_finance import calculate_roe

from .archives import csv_rows, read_archive
from .bank_roe import (
    ITAU_EQUITY_COMPONENTS,
    SANTANDER_IFRS_2022,
    Record,
    reconciled,
    record,
    same_filing,
    santander_income_evidence,
)
from .comparison_identity import comparison_identities, uses_roe
from .dfp import ORIGIN, SOURCE, CsvRow, amount
from .fca import SOURCE as SECTOR_SOURCE

METHODOLOGY = "roe-dfp-comparisons.v1"
YEARS = tuple(range(2021, 2026))
INCOME_LAYOUTS = ("3.11", "3.09", "3.13")
EQUITY_LAYOUTS = ("2.03", "2.07", "2.08")
INCOME_LABELS = (
    "Lucro/Prejuízo Consolidado do Período", "Lucro ou Prejuízo Líquido Consolidado do Período",
)
PARENT_INCOME_LABELS = (
    "Atribuído a Sócios da Empresa Controladora", "Atribuído aos Sócios da Empresa Controladora",
)
MINORITY_INCOME_LABELS = (
    "Atribuído a Sócios Não Controladores", "Atribuído aos Sócios Não Controladores",
)
EQUITY_LABEL = "Patrimônio Líquido Consolidado"
PARENT_EQUITY_LABEL = "Patrimônio Líquido Atribuído ao Controlador"
MINORITY_EQUITY_LABEL = "Patrimônio Líquido Atribuído aos Não Controladores"
MINORITY_COMPONENT_LABEL = "Participação dos Acionistas Não Controladores"
INCOME_CODES = frozenset(root + suffix for root in INCOME_LAYOUTS for suffix in ("", ".01", ".02"))
EQUITY_CODES = frozenset(
    root + suffix
    for root in EQUITY_LAYOUTS
    for suffix in ("", *(f".{part:02}" for part in range(1, 10)))
)
DMPL_INCOME_CODE = "5.05.01"
DMPL_INCOME_COLUMNS = (
    "Patrimônio Líquido", "Participação dos Não Controladores", "Patrimônio Líquido Consolidado",
)
INCOME_MISMATCH = "Lucro consolidado diverge da atribuição aos acionistas."
DmplAccounts = dict[str, dict[str, list[CsvRow]]]


def digits(value: str) -> str:
    return "".join(char for char in value if "0" <= char <= "9")


def selected_filings(
    archive: ZipFile, year: int, identities: dict[str, dict], collected: datetime,
) -> tuple[dict[str, CsvRow], dict[str, str]]:
    reference = f"{year}-12-31"
    candidates: dict[str, list[CsvRow]] = {code: [] for code in identities}
    other_closes = set()
    for row in csv_rows(archive, f"dfp_cia_aberta_{year}.csv"):
        code = row["CD_CVM"]
        if code not in candidates:
            continue
        if row["DT_REFER"] == reference:
            candidates[code].append(row)
        else:
            other_closes.add(code)

    accepted, reasons = {}, {}
    for code, rows in candidates.items():
        if not rows:
            reasons[code] = (
                "Encerramento fiscal diferente de 31/12 no lote da CVM."
                if code in other_closes else "DFP anual de 31/12 indisponível no lote da CVM."
            )
            continue
        try:
            latest = max(int(row["VERSAO"]) for row in rows)
            newest = [row for row in rows if int(row["VERSAO"]) == latest]
            filing = newest[0]
            if latest < 1 or any(row != filing for row in newest):
                raise ValueError("A versão mais recente da DFP tem metadados conflitantes ou inválidos.")
            if filing["CATEG_DOC"] != "DFP" or digits(filing["CNPJ_CIA"]) != digits(identities[code]["cnpj"]):
                raise ValueError("A identidade do emissor na DFP diverge do cadastro da CVM.")
            received = date.fromisoformat(filing["DT_RECEB"])
            if not date.fromisoformat(reference) <= received <= collected.date():
                raise ValueError("A data de recebimento da DFP é incompatível com a data de coleta.")
            document = filing["LINK_DOC"].replace(
                "http://www.rad.cvm.gov.br/", "https://www.rad.cvm.gov.br/", 1,
            )
            if not document.startswith("https://www.rad.cvm.gov.br/"):
                raise ValueError("O endereço do documento da CVM está indisponível.")
            accepted[code] = {**filing, "LINK_DOC": document}
        except (ValueError, KeyError) as error:
            reasons[code] = str(error)
    return accepted, reasons


def accounting_rows(archive: ZipFile, year: int, filings: dict[str, CsvRow]):
    reference, opening, start = f"{year}-12-31", f"{year - 1}-12-31", f"{year}-01-01"
    by_company: dict[str, dict[str, dict[str, list[CsvRow]]]] = {
        code: {"income": {}, "opening": {}, "closing": {}} for code in filings
    }
    period_presence: dict[str, set[str]] = {code: set() for code in filings}
    statement_presence: dict[str, set[str]] = {code: set() for code in filings}
    for statement, codes in (("DRE", INCOME_CODES), ("BPP", EQUITY_CODES)):
        for row in csv_rows(archive, f"dfp_cia_aberta_{statement}_con_{year}.csv"):
            code, account_code = row["CD_CVM"], row["CD_CONTA"]
            filing = filings.get(code)
            if filing is None or not same_filing(row, filing):
                continue
            statement_presence[code].add(statement)
            period = row["ORDEM_EXERC"], row["DT_FIM_EXERC"]
            if statement == "DRE":
                if period != ("ÚLTIMO", reference) or row["DT_INI_EXERC"] != start:
                    continue
                role = "income"
            elif period == ("ÚLTIMO", reference):
                role = "closing"
            elif period == ("PENÚLTIMO", opening):
                role = "opening"
            else:
                continue
            period_presence[code].add(role)
            if account_code in codes:
                by_company[code][role].setdefault(account_code, []).append(row)
    return by_company, statement_presence, period_presence


def has_label(row: CsvRow, expected: tuple[str, ...]) -> bool:
    label = row["DS_CONTA"].strip().casefold()
    return any(label == candidate.casefold() for candidate in expected)


def read_dmpl_accounts(archive: ZipFile, year: int, filings: dict[str, CsvRow]) -> DmplAccounts:
    member = f"dfp_cia_aberta_DMPL_con_{year}.csv"
    if member not in archive.namelist():
        return {}
    reference, start = f"{year}-12-31", f"{year}-01-01"
    rows: DmplAccounts = {}
    for row in csv_rows(archive, member):
        code, column = row["CD_CVM"], row["COLUNA_DF"].strip()
        filing = filings.get(code)
        if (
            filing is None or not same_filing(row, filing)
            or (row["ORDEM_EXERC"], row["DT_INI_EXERC"], row["DT_FIM_EXERC"])
            != ("ÚLTIMO", start, reference)
            or row["CD_CONTA"] != DMPL_INCOME_CODE
            or not has_label(row, ("Lucro Líquido do Período",))
            or column not in DMPL_INCOME_COLUMNS
        ):
            continue
        rows.setdefault(code, {}).setdefault(column, []).append(row)
    return rows


def reconcile_income_with_dmpl(
    rows: dict[str, list[CsvRow]], dre_total: Record, dre_parent: Record, dre_minority: Record,
) -> Record:
    if any(len(rows.get(column, [])) != 1 for column in DMPL_INCOME_COLUMNS):
        raise ValueError(INCOME_MISMATCH)
    parent, minority, total = (
        record(key, "DMPL", rows[column][0])
        for key, column in zip(
            ("parentIncomeDmpl", "minorityIncomeDmpl", "incomeDmpl"), DMPL_INCOME_COLUMNS,
        )
    )
    if not reconciled(total, parent, minority) or not reconciled(dre_total, total):
        raise ValueError(INCOME_MISMATCH)
    if dre_parent[1] == 0 and dre_minority[1] == 0:
        return parent
    if reconciled(dre_parent, parent):
        return dre_parent
    raise ValueError(INCOME_MISMATCH)


def find_layout(
    rows: dict[str, list[CsvRow]], codes: tuple[str, ...], labels: tuple[str, ...], statement: str,
) -> str:
    layouts = [code for code in codes if any(has_label(row, labels) for row in rows.get(code, []))]
    if len(layouts) != 1:
        raise ValueError(f"Classificação contábil sem mapeamento inequívoco em {statement}.")
    return layouts[0]


def require_record(
    rows: dict[str, list[CsvRow]], code: str, statement: str, key: str, *labels: str,
) -> Record:
    candidates = rows.get(code, [])
    if len(candidates) != 1 or not has_label(candidates[0], labels):
        raise ValueError(f"Conta ausente, duplicada ou com classificação divergente em {statement} {code}.")
    return record(key, statement, candidates[0])


def parent_income(
    archive: ZipFile, filing: CsvRow, rows: dict[str, list[CsvRow]],
    dmpl_accounts: Callable[[], DmplAccounts],
) -> tuple[Record, str | None]:
    layout = find_layout(rows, INCOME_LAYOUTS, INCOME_LABELS, "DRE")
    total = require_record(rows, layout, "DRE", "income", *INCOME_LABELS)
    parent = require_record(rows, f"{layout}.01", "DRE", "parentIncome", *PARENT_INCOME_LABELS)
    minority = require_record(rows, f"{layout}.02", "DRE", "minorityIncome", *MINORITY_INCOME_LABELS)
    evidence = None
    if not reconciled(total, parent, minority):
        if (filing["CD_CVM"], filing["DT_REFER"]) == ("020532", "2022-12-31"):
            verified_minority = santander_income_evidence(
                archive, filing, {"income": total, "parentIncome": parent, "minorityIncome": minority},
            )
            if not reconciled(total, parent, verified_minority):
                raise ValueError(INCOME_MISMATCH)
            evidence = SANTANDER_IFRS_2022
        else:
            parent = reconcile_income_with_dmpl(
                dmpl_accounts().get(filing["CD_CVM"], {}), total, parent, minority,
            )
    return parent, evidence


def parent_equity(rows: dict[str, list[CsvRow]]) -> tuple[Decimal, tuple[str, ...]]:
    layout = find_layout(rows, EQUITY_LAYOUTS, (EQUITY_LABEL,), "BPP")
    total = require_record(rows, layout, "BPP", "equity", EQUITY_LABEL)
    if layout == "2.07":
        parent = require_record(rows, "2.07.01", "BPP", "parentEquity", PARENT_EQUITY_LABEL)
        minority = require_record(rows, "2.07.02", "BPP", "minorityEquity", MINORITY_EQUITY_LABEL)
        components = (parent, minority)
        value = parent[1]
        codes = ("2.07.01",)
    else:
        minority_code = f"{layout}.09"
        minority = require_record(rows, minority_code, "BPP", "minorityEquity", MINORITY_COMPONENT_LABEL)
        components = (
            *(require_record(rows, f"{layout}.{index:02}", "BPP", f"component{index}", label)
              for index, label in enumerate(ITAU_EQUITY_COMPONENTS, 1)),
            minority,
        )
        value = total[1] - minority[1]
        codes = (layout, minority_code)
    if not reconciled(total, *components):
        raise ValueError("Patrimônio consolidado diverge da atribuição aos acionistas.")
    return value, codes


def unavailable(year: int, reason: str, filing: dict | None = None) -> dict:
    return {"year": year, "roe": None, "reason": reason, "filing": filing, "inputs": None}


def calculate_observation(
    archive: ZipFile, year: int, filing: CsvRow, rows: dict[str, dict[str, list[CsvRow]]],
    statements: set[str], periods: set[str], dmpl_accounts: Callable[[], DmplAccounts],
) -> dict:
    source = {
        "referenceDate": filing["DT_REFER"],
        "receivedAt": filing["DT_RECEB"],
        "publishedAt": None,
        "version": int(filing["VERSAO"]),
        "filingUrl": filing["LINK_DOC"],
    }
    if statements != {"DRE", "BPP"}:
        return unavailable(year, "DFP consolidada indisponível no lote da CVM.", source)
    if periods != {"income", "opening", "closing"}:
        return unavailable(
            year, "Exercício anual ou balanço comparativo incompatível com a janela civil.", source,
        )
    try:
        income, support = parent_income(archive, filing, rows["income"], dmpl_accounts)
        opening, opening_codes = parent_equity(rows["opening"])
        closing, closing_codes = parent_equity(rows["closing"])
        if opening_codes != closing_codes:
            raise ValueError("Mapeamentos do patrimônio de abertura e de encerramento divergentes.")
        result = calculate_roe(net_income=income[1], equity_open=opening, equity_close=closing)
        if result.value is None or result.quality_status != "validated":
            raise ValueError(result.reasons[0] if result.reasons else "ROE indisponível no exercício.")
    except (DecimalException, KeyError):
        return unavailable(year, "Valor contábil ou escala incompatível na DFP.", source)
    except ValueError as error:
        return unavailable(year, str(error), source)

    if support:
        source["supportingDocumentUrl"] = support
    return {
        "year": year,
        "roe": amount(result.value),
        "reason": None,
        "filing": source,
        "inputs": {
            "netIncomeBrl": amount(income[1]),
            "openingEquityBrl": amount(opening),
            "closingEquityBrl": amount(closing),
            "incomeCode": income[0]["code"],
            "incomeStatement": income[0]["statement"],
            "equityCodes": list(opening_codes),
        },
    }


def year_comparison(path: Path, year: int, identities: dict[str, dict]) -> tuple[dict, dict[str, dict]]:
    with read_archive(path) as (archive, checksum, collected):
        filings, reasons = selected_filings(archive, year, identities, collected)
        rows, statements, periods = accounting_rows(archive, year, filings)

        @cache
        def dmpl_accounts() -> DmplAccounts:
            return read_dmpl_accounts(archive, year, filings)

        observations = {
            code: (
                calculate_observation(
                    archive, year, filings[code], rows[code], statements[code], periods[code],
                    dmpl_accounts,
                )
                if code in filings else unavailable(year, reasons[code])
            )
            for code in identities
        }
    return {
        "kind": "dfp",
        "year": year,
        "url": f"{ORIGIN}dfp_cia_aberta_{year}.zip",
        "sha256": checksum,
        "retrievedAt": collected.isoformat(timespec="seconds"),
    }, observations


def create_sector_comparison(
    selection: dict, directory: dict, fca_archives: list[Path], dfp_archives: dict[int, Path],
) -> dict:
    if tuple(sorted(dfp_archives)) != YEARS:
        raise ValueError("A janela de comparação exige os cinco ZIPs da CVM de 2021 a 2025.")
    by_code, archives = comparison_identities(selection, directory, fca_archives)
    identities = {
        f"{code:06d}": identity for code, identity in by_code.items() if uses_roe(code, identity)
    }
    companies = {
        code: {**{key: identity[key] for key in ("name", "sector", "classification")}, "observations": []}
        for code, identity in identities.items()
    }
    for year in YEARS:
        source, observations = year_comparison(dfp_archives[year], year, identities)
        archives.append(source)
        for code, observation in observations.items():
            companies[code]["observations"].append(observation)
    return {
        "manifest": {
            "schemaVersion": "1.0.0",
            "methodologyVersion": METHODOLOGY,
            "asOf": selection["asOf"],
            "generatedAt": datetime.now(UTC).isoformat(timespec="seconds"),
            "years": list(YEARS),
            "source": SOURCE,
            "sectorSource": SECTOR_SOURCE,
            "archives": sorted(archives, key=lambda source: (source["kind"], source["year"])),
        },
        "companies": sorted(companies.values(), key=lambda company: company["name"].casefold()),
    }
