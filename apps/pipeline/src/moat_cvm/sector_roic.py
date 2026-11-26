"""Estima ROIC anual com os totais reportados nas DFPs."""

from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal, DecimalException
from pathlib import Path
from zipfile import ZipFile

from moat_finance import calculate_roic, invested_capital

from .archives import csv_rows, read_archive
from .bank_roe import Record, reconciled, record, same_filing
from .comparison_identity import classification_url, comparison_identities, uses_roe
from .dfp import ORIGIN, SOURCE, CsvRow, amount, normalize
from .fca import SOURCE as SECTOR_SOURCE
from .quality import ROIC_TAX
from .sector_comparison import YEARS, selected_filings

METHODOLOGY = "roic-dfp-comparisons.v2"
INCOME_ACCOUNTS = (
    ("grossIncome", "3.03", "Resultado Bruto"),
    ("operatingIncomeAndExpenses", "3.04", "Despesas/Receitas Operacionais"),
    ("ebit", "3.05", "Resultado Antes do Resultado Financeiro e dos Tributos"),
)
INDIVIDUAL_FILINGS = {
    # A DFP informa que a Sanepar não tem subsidiárias.
    ("018627", "2025-12-31", "154938", "1"): "https://ri.sanepar.com.br/docs/DFP-Sanepar-2025-12-31-BjdwmKcn.pdf",
    # A TIM tinha apenas uma coligada. A aquisição da V8 foi concluída em 2026.
    ("024929", "2025-12-31", "154688", "1"): (
        "https://api.mziq.com/mzfilemanager/v2/d/4c4aa51f-1235-4aa1-8b83-adc92e8dacc3/"
        "197553f9-c229-4f09-b201-bcf48f2026d6?origin=2"
    ),
}
DEBT_ACCOUNTS = (("ShortBorrowings", "2.01.04"), ("LongBorrowings", "2.02.01"))
CLOSING_ACCOUNTS = {
    **{f"closing{key}": ("BPP", code) for key, code in DEBT_ACCOUNTS},
    "closingCash": ("BPA", "1.01.01"),
}
NEWEST, PRIOR = "ÚLTIMO", "PENÚLTIMO"
STATEMENTS = ("DRE", "BPA", "BPP")
Accounts = dict[str, CsvRow]
Roles = dict[str, dict[str, Accounts]]


def labeled_record(rows: Accounts, key: str, statement: str, code: str, label: str) -> Record:
    row = rows.get(code)
    if row is None or row["DS_CONTA"].strip().casefold() != label.casefold():
        raise ValueError(f"Conta ausente ou com classificação divergente em {statement} {code}.")
    return record(key, statement, row)


def filing_key(issuer: str, filing: CsvRow) -> tuple[str, str, str, str]:
    return issuer, filing["DT_REFER"], filing.get("ID_DOC", ""), str(filing["VERSAO"])


def read_accounts(
    archive: ZipFile, year: int, filings: dict[str, CsvRow],
) -> tuple[dict[str, Roles], set[str]]:
    reference, opening, start = f"{year}-12-31", f"{year - 1}-12-31", f"{year}-01-01"
    periods = {(NEWEST, reference): "closing", (PRIOR, opening): "opening"}
    by_company: dict[str, Roles] = {
        code: {"income": {"DRE": {}}, "opening": {"BPA": {}, "BPP": {}}, "closing": {"BPA": {}, "BPP": {}}}
        for code in filings
    }
    duplicates = set()
    individual_issuers = {issuer for issuer, filing in filings.items() if filing_key(issuer, filing) in INDIVIDUAL_FILINGS}
    by_basis = {"con": filings.keys() - individual_issuers, "ind": individual_issuers}
    for basis, issuers in by_basis.items():
        if not issuers:
            continue
        for statement in STATEMENTS:
            for row in csv_rows(archive, f"dfp_cia_aberta_{statement}_{basis}_{year}.csv"):
                issuer = row["CD_CVM"]
                if issuer not in issuers or not same_filing(row, filings[issuer]):
                    continue
                period = row["ORDEM_EXERC"], row["DT_FIM_EXERC"]
                if statement == "DRE":
                    if period != (NEWEST, reference) or row["DT_INI_EXERC"] != start:
                        continue
                    role = "income"
                else:
                    role = periods.get(period)
                    if role is None:
                        continue
                entries = by_company[issuer][role][statement]
                account = row["CD_CONTA"]
                if account in entries:
                    duplicates.add(issuer)
                entries[account] = row
    return by_company, duplicates


def check_rollups(rows: Accounts, statement: str, parents: set[str]) -> None:
    children: dict[str, list[Record]] = defaultdict(list)
    for code, row in rows.items():
        parent = code.rpartition(".")[0]
        if parent in parents:
            children[parent].append(record(code, statement, row))
    for code in sorted(parents):
        if code not in rows or not children[code]:
            raise ValueError(f"Subtotais indisponíveis para conciliar {statement} {code}.")
        if not reconciled(record(code, statement, rows[code]), *children[code]):
            raise ValueError(f"A conta {statement} {code} diverge de seus subtotais.")


def balance_capital(
    stage: str, balance: dict[str, Accounts], individual: bool = False,
) -> tuple[Decimal, list[dict]]:
    assets, liabilities = balance["BPA"], balance["BPP"]
    equity = labeled_record(
        liabilities, f"{stage}Equity", "BPP", "2.03",
        "Patrimônio Líquido" if individual else "Patrimônio Líquido Consolidado",
    )
    cash = labeled_record(assets, f"{stage}Cash", "BPA", "1.01.01", "Caixa e Equivalentes de Caixa")
    borrowings = [
        labeled_record(liabilities, f"{stage}{key}", "BPP", code, "Empréstimos e Financiamentos")
        for key, code in DEBT_ACCOUNTS
    ]
    for detail, debt, _ in borrowings:
        if debt < 0:
            raise ValueError(f"Saldo de dívida negativo em BPP {detail['code']}.")
        if debt == 0 and any(
            normalize(row)[0] != 0
            for code, row in liabilities.items()
            if code.startswith(detail["code"] + ".")
        ):
            raise ValueError(f"Saldo zerado em BPP {detail['code']} diverge das contas do grupo.")

    check_rollups(assets, "BPA", {"1", "1.01"})
    check_rollups(liabilities, "BPP", {"2", "2.01", "2.02"})
    if not reconciled(record("assets", "BPA", assets["1"]), record("liabilities", "BPP", liabilities["2"])):
        raise ValueError("O ativo total diverge do passivo total.")
    capital = invested_capital(equity=equity[1], debt=sum(item[1] for item in borrowings), excess_cash=cash[1])
    if capital is None or capital <= 0 or abs(capital) >= 2**53:
        raise ValueError("Capital investido incompatível no balanço.")
    return capital, [item[0] for item in (equity, *borrowings, cash)]


def unavailable(year: int, reason: str, filing: dict | None = None) -> dict:
    return {"year": year, "roic": None, "reason": reason, "filing": filing, "inputs": None}


def closing_net_debt(inputs: dict, reference: str) -> Decimal | None:
    """Reutiliza os saldos de empréstimos, financiamentos e caixa do ROIC."""
    accounts = inputs.get("accounts")
    if not isinstance(accounts, list):
        return None
    balances: dict[str, Decimal] = {}
    for account in accounts:
        key = account["key"]
        if key not in CLOSING_ACCOUNTS:
            continue
        value = account.get("amountBrl")
        if (
            key in balances or type(value) not in (int, float) or not 0 <= value < 2**53
            or (account.get("statement"), account.get("code")) != CLOSING_ACCOUNTS[key]
            or account.get("referenceDate") != reference
        ):
            return None
        balances[key] = Decimal(str(value))
    if balances.keys() != CLOSING_ACCOUNTS.keys():
        return None
    net_debt = balances["closingShortBorrowings"] + balances["closingLongBorrowings"] - balances["closingCash"]
    return net_debt if abs(net_debt) < 2**53 else None


def matching_dfp_filings(archive: ZipFile, year: int, observations: dict[str, dict]) -> dict[str, CsvRow]:
    """Localiza os mesmos formulários das observações anuais por emissor, versão e URL."""
    reference = f"{year}-12-31"
    filings: dict[str, CsvRow] = {}
    conflicts: set[str] = set()
    for row in csv_rows(archive, f"dfp_cia_aberta_{year}.csv"):
        code = row["CD_CVM"]
        filing = observations.get(code, {}).get("filing")
        if (
            not filing or row["DT_REFER"] != reference or row["VERSAO"] != str(filing["version"])
            or row["CATEG_DOC"] != "DFP" or row["DT_RECEB"] != filing["receivedAt"]
        ):
            continue
        try:
            if classification_url(row["LINK_DOC"]) != filing["filingUrl"]:
                continue
        except ValueError:
            continue
        if code in filings and filings[code] != row:
            conflicts.add(code)
        filings[code] = row
    return {code: row for code, row in filings.items() if code not in conflicts}


def observe_roic(issuer: str, year: int, filing: CsvRow, rows: Roles, duplicate: bool = False) -> dict:
    source = {
        "referenceDate": filing["DT_REFER"],
        "receivedAt": filing["DT_RECEB"],
        "publishedAt": None,
        "version": int(filing["VERSAO"]),
        "filingUrl": filing["LINK_DOC"],
    }
    individual_source = INDIVIDUAL_FILINGS.get(filing_key(issuer, filing))
    if individual_source:
        source["basis"] = "individual"
        source["supportingDocumentUrl"] = individual_source
    if duplicate:
        return unavailable(year, "Conta duplicada na mesma versão da DFP.", source)
    if any(not accounts for statements in rows.values() for accounts in statements.values()):
        basis = "individual" if individual_source else "consolidada"
        return unavailable(year, f"DFP {basis} ou balanço de abertura indisponível na janela civil.", source)
    try:
        gross_income, operating, ebit = (
            labeled_record(rows["income"]["DRE"], key, "DRE", code, label)
            for key, code, label in INCOME_ACCOUNTS
        )
        if not reconciled(ebit, gross_income, operating):
            raise ValueError("O resultado antes do financeiro e dos tributos diverge dos subtotais da DRE.")
        opening, opening_accounts = balance_capital("opening", rows["opening"], individual_source is not None)
        closing, closing_accounts = balance_capital("closing", rows["closing"], individual_source is not None)
        result = calculate_roic(
            ebit=ebit[1], tax_rate=ROIC_TAX, capital_open=opening, capital_close=closing, estimated=True,
        )
        if result.value is None or result.numerator is None:
            raise ValueError(result.reasons[0] if result.reasons else "ROIC indisponível no exercício.")
    except (DecimalException, KeyError) as error:
        return unavailable(year, f"Conta ou escala monetária incompatível: {error}.", source)
    except ValueError as error:
        return unavailable(year, str(error), source)

    return {
        "year": year,
        "roic": amount(result.value),
        "reason": None,
        "filing": source,
        "inputs": {
            "ebitBrl": amount(ebit[1]),
            "nopatBrl": amount(result.numerator),
            "openingCapitalBrl": amount(opening),
            "closingCapitalBrl": amount(closing),
            "accounts": [ebit[0], *opening_accounts, *closing_accounts],
        },
    }


def create_sector_roic(
    selection: dict, directory: dict, fca_archives: list[Path], dfp_archives: dict[int, Path],
) -> dict:
    identities, archives = comparison_identities(selection, directory, fca_archives)
    selected = {
        f"{code:06}": identity for code, identity in identities.items()
        if not uses_roe(code, identity)
    }
    if not selected or tuple(sorted(dfp_archives)) != YEARS:
        raise ValueError("Seleção de ROIC vazia ou ZIPs anuais incompletos.")
    companies = {
        code: {"name": item["name"], "sector": item["sector"], "observations": []}
        for code, item in selected.items()
    }
    for year, path in sorted(dfp_archives.items()):
        with read_archive(path) as (archive, checksum, collected):
            filings, reasons = selected_filings(archive, year, selected, collected)
            rows, duplicates = read_accounts(archive, year, filings)
            for code, company in companies.items():
                filing = filings.get(code)
                observation = (
                    observe_roic(code, year, filing, rows[code], code in duplicates)
                    if filing is not None else unavailable(year, reasons[code])
                )
                company["observations"].append(observation)
            archives.append({
                "kind": "dfp", "year": year, "url": f"{ORIGIN}{path.name}",
                "sha256": checksum, "retrievedAt": collected.isoformat(timespec="seconds"),
            })
    return {
        "manifest": {
            "schemaVersion": "1.0.0",
            "methodologyVersion": METHODOLOGY,
            "asOf": selection["asOf"],
            "generatedAt": datetime.now(UTC).isoformat(timespec="seconds"),
            "years": list(YEARS),
            "source": SOURCE,
            "sectorSource": SECTOR_SOURCE,
            "archives": sorted(archives, key=lambda archive: (archive["kind"], archive["year"])),
            "taxRate": amount(ROIC_TAX),
        },
        "companies": sorted(companies.values(), key=lambda company: company["name"].casefold()),
    }
