"""Estima ROIC em setores revisados com DFP consolidada."""

from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal, DecimalException
from pathlib import Path
from zipfile import ZipFile

from moat_finance import calculate_roic, invested_capital

from .archives import csv_rows, read_archive
from .bank_roe import Record, reconciled, record, same_filing
from .comparison_identity import comparison_identities, uses_roe
from .dfp import ORIGIN, SOURCE, CsvRow, amount, normalize
from .fca import SOURCE as SECTOR_SOURCE
from .quality import ROIC_TAX
from .quality import ACCOUNTS as QUALITY_ACCOUNTS
from .sector_comparison import YEARS, selected_filings
from .sector_roic_lease_notes import EMBEDDED_LEASE_REVIEWS, LeaseBalances
from .sector_roic_notes import REVIEWS, ReviewedAccount

METHODOLOGY = "roic-dfp-comparisons.v1"
INCOME_ACCOUNTS = (
    ("grossIncome", "3.03", "Resultado Bruto"),
    ("operatingIncomeAndExpenses", "3.04", "Despesas/Receitas Operacionais"),
    ("ebit", "3.05", "Resultado Antes do Resultado Financeiro e dos Tributos"),
)
LEASES_OUTSIDE_DEBT = {
    # A grafia da CSN Mineração aparece nas contas específicas do lote da CVM.
    "025585": {
        "2.01.05.02.04": ("Passivos de arredamentos",),
        "2.02.02.02.03": ("Passivos de arredamentos",),
    },
}
LEASE_LABEL_TERMS = ("arrend", "arredamento", "direito de uso", "leasing", "alugue", "aluguel", "locação")
SEPARATE_LEASE_LABELS = frozenset((
    "arrendamento a pagar", "arrendamentos a pagar", "passivo de arrendamento",
    "passivos de arrendamento", "passivo de arrendamentos", "passivos de arrendamentos",
    "passivo por arrendamento", "obrigações de arrendamento", "obrigações de arrendamento mercantil",
    "arrendamento mercantil a pagar", "passivo de arrendamento por direito de uso",
    "arrendamento por direito de uso", "arrendamento mercantil - direito de uso",
    "contas a pagar de arrendamento", "contas a pagar com operações com arrendamento",
))
NONZERO_SEPARATE_LEASE_LABELS = frozenset((
    "arrendamento", "arrendamentos", "arrendamento mercantil", "arrendamentos mercantis",
    "arrendamentos operacionais", "arrendamento custo amortizado",
    "obrigações - arrendamento mercantil", "obrigações com arrendamento",
    "valores a pagar de arrendamentos", "arrendamentos de direito de uso a pagar",
))
SEPARATE_DEBT = {
    "004170": {"2.02.04.02.12": "Debentures participativas"},
}
VALE_NOTES = "https://vale.com/documents/d/guest/form-20-f-2025-en"
GERDAU_SUPPLIER_CODE = "2.01.02.01.02"
GERDAU_NOTES = {
    # Opening and closing amounts are the corresponding audited trade payables in BRL.
    # The notes identify unchanged supplier terms and no financing cost borne by Gerdau.
    ("2022-12-31", "123775", "1"): (
        807_915_000, 653_085_000,
        "https://www.sec.gov/Archives/edgar/data/1073404/000110465923040166/R20.htm",
    ),
    ("2023-12-31", "134146", "1"): (
        653_085_000, 584_320_000,
        "https://www.sec.gov/Archives/edgar/data/1073404/000110465924040516/R20.htm",
    ),
    ("2024-12-31", "144975", "2"): (
        584_320_000, 459_899_000,
        "https://www.sec.gov/Archives/edgar/data/1073404/000141057825000353/R20.htm",
    ),
    ("2025-12-31", "154830", "1"): (
        459_899_000, 381_415_000,
        "https://www.sec.gov/Archives/edgar/data/1073404/000110465926027678/ggb-20251231x20f.htm",
    ),
}
DEBT_LABEL_TERMS = (
    "risco sacado", "forfaiting", "factoring", "confirming", "financiament",
    "empréstim", "emprestim", "debêntur", "debentur", "dívida", "divida",
    "mútuo", "mutuo", "bonds", "nota promiss", "notas promiss",
    "cessão de direitos creditór", "cessao de direitos creditor",
    "cessão de recebíveis", "cessao de recebiveis", "aquisição de empres",
    "aquisição de controlad", "aquisição de participa", "combinação de negócios",
    "contraprestação contingente", "compromissos com aquisição de ativos",
    "contas a pagar - aquisi", "contas a pagar por aquisi", "contas a pagar pela aquisi",
    "obrigações a pagar por aquisi",
)
NEWEST, PRIOR = "ÚLTIMO", "PENÚLTIMO"
STATEMENTS = ("DRE", "BPA", "BPP")
Accounts = dict[str, CsvRow]
Roles = dict[str, dict[str, Accounts]]


def labeled_record(rows: Accounts, key: str, statement: str, code: str, label: str) -> Record:
    row = rows.get(code)
    if row is None or row["DS_CONTA"].strip().casefold() != label.casefold():
        raise ValueError(f"Conta ausente ou com classificação divergente em {statement} {code}.")
    return record(key, statement, row)


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
    for statement in STATEMENTS:
        for row in csv_rows(archive, f"dfp_cia_aberta_{statement}_con_{year}.csv"):
            issuer = row["CD_CVM"]
            filing = filings.get(issuer)
            if filing is None or not same_filing(row, filing):
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


def affected_rollups(code: str, accounts: Accounts) -> set[str]:
    parts = code.split(".")
    parents = {".".join(parts[:index]) for index in range(3, len(parts))}
    if any(other.startswith(code + ".") for other in accounts):
        parents.add(code)
    return parents


def separate_financing(
    issuer: str, stage: str, liabilities: Accounts, operating_supplier_balance: int | None,
    reviewed_accounts: tuple[ReviewedAccount, ...],
) -> tuple[list[Record], set[str], list[Record]]:
    debt = [
        labeled_record(liabilities, f"{stage}SeparateDebt{index}", "BPP", code, label)
        for index, (code, label) in enumerate(SEPARATE_DEBT.get(issuer, {}).items(), 1)
    ]
    operational: list[Record] = []
    if operating_supplier_balance is not None:
        supplier = labeled_record(
            liabilities, f"{stage}OperatingSupplier", "BPP", GERDAU_SUPPLIER_CODE,
            "Fornecedores risco sacado",
        )
        if supplier[1] != operating_supplier_balance:
            raise ValueError("O saldo de fornecedores diverge da nota auditada.")
        operational.append(supplier)

    for review in reviewed_accounts:
        destination = debt if review.financing else operational
        kind = "SeparateDebt" if review.financing else "OperatingSupplier"
        account = labeled_record(
            liabilities, f"{stage}{kind}{len(destination) + 1}", "BPP", review.code, review.label,
        )
        expected = review.opening_brl if stage == "opening" else review.closing_brl
        if account[1] != expected:
            raise ValueError(f"O saldo em BPP {review.code} diverge da nota auditada.")
        destination.append(account)

    if any(item[1] < 0 for item in debt):
        raise ValueError("Saldo de financiamento separado incompatível.")
    outside_codes = {item[0]["code"] for item in (*debt, *operational)}
    parents = set().union(*(affected_rollups(code, liabilities) for code in outside_codes))

    for code, row in liabilities.items():
        label = row["DS_CONTA"].strip().casefold()
        if (
            code.startswith(("2.01.", "2.02."))
            and code not in ("2.01.04", "2.02.01")
            and not code.startswith(("2.01.04.", "2.02.01."))
            and not any(code == known or code.startswith(known + ".") for known in outside_codes)
            and not any(term in label for term in LEASE_LABEL_TERMS)
            and any(term in label for term in DEBT_LABEL_TERMS)
            and normalize(row)[0] != 0
        ):
            raise ValueError(
                f"Financiamento fora das contas revisadas de dívida em BPP {code}: "
                f"{row['DS_CONTA'].strip()}."
            )
    return debt, parents, operational


def balance_capital(
    issuer: str, stage: str, balance: dict[str, Accounts],
    operating_supplier_balance: int | None = None,
    reviewed_accounts: tuple[ReviewedAccount, ...] = (),
    reviewed_leases: LeaseBalances | None = None,
) -> tuple[Decimal, list[dict]]:
    assets, liabilities = balance["BPA"], balance["BPP"]
    equity = labeled_record(
        liabilities, f"{stage}Equity", "BPP", "2.03", "Patrimônio Líquido Consolidado",
    )
    cash = labeled_record(assets, f"{stage}Cash", "BPA", "1.01.01", "Caixa e Equivalentes de Caixa")
    separately_reported, extra_rollups, operating = separate_financing(
        issuer, stage, liabilities, operating_supplier_balance, reviewed_accounts,
    )
    operating_codes = {item[0]["code"] for item in operating}
    evidence = [equity, cash, *separately_reported, *operating]
    debt = sum((item[1] for item in separately_reported), Decimal(0))
    allowed = {
        **{entry.code: entry.labels for entry in QUALITY_ACCOUNTS.get(issuer, ())
           if entry.key in ("shortLease", "longLease")},
        **LEASES_OUTSIDE_DEBT.get(issuer, {}),
    }
    if reviewed_leases and not (
        0 < reviewed_leases.leases_brl
        <= reviewed_leases.short_borrowings_brl + reviewed_leases.long_borrowings_brl
    ):
        raise ValueError("Arrendamentos incompatíveis com os financiamentos da nota auditada.")
    for loan_root, tenure in (("2.01.04", "Short"), ("2.02.01", "Long")):
        liability_root = loan_root[:4]
        borrowings = labeled_record(
            liabilities, f"{stage}{tenure}Borrowings", "BPP", loan_root, "Empréstimos e Financiamentos",
        )
        included = labeled_record(
            liabilities, f"{stage}{tenure}LeaseIncluded", "BPP",
            f"{loan_root}.03", "Financiamento por Arrendamento",
        )
        outside = []
        for code, row in liabilities.items():
            label = row["DS_CONTA"].strip().casefold()
            if (
                not code.startswith(liability_root + ".")
                or code.startswith(loan_root + ".")
                or code in operating_codes
            ):
                continue
            clearly_reported_lease = (
                code.startswith(("2.01.05.02.", "2.02.02.02."))
                and (
                    label in SEPARATE_LEASE_LABELS
                    or (label in NONZERO_SEPARATE_LEASE_LABELS and normalize(row)[0] != 0)
                )
            )
            if clearly_reported_lease or any(
                label == approved.casefold() for approved in allowed.get(code, ())
            ):
                outside.append(record(f"{stage}{tenure}SeparateLease", "BPP", row))
            elif any(term in label for term in LEASE_LABEL_TERMS) and normalize(row)[0] != 0:
                raise ValueError(
                    "Arrendamento fora de financiamentos com conta não revisada: "
                    f"BPP {code}, {row['DS_CONTA'].strip()}."
                )
        if len(outside) > 1 or (included[1] > 0 and any(item[1] > 0 for item in outside)):
            raise ValueError("Apresentação de arrendamentos requer revisão para evitar dupla contagem.")
        if reviewed_leases:
            expected_loan = (
                reviewed_leases.short_borrowings_brl
                if tenure == "Short" else reviewed_leases.long_borrowings_brl
            )
            if borrowings[1] != expected_loan or included[1] != 0 or outside:
                raise ValueError(f"Financiamentos em BPP {loan_root} não correspondem à nota auditada.")
        elif included[1] == 0 and not outside:
            raise ValueError("Arrendamentos não identificados nas contas estruturadas da DFP.")
        if included[1] > borrowings[1] or any(item[1] < 0 for item in (borrowings, included, *outside)):
            raise ValueError("Saldo de financiamento ou arrendamento incompatível.")
        for detail, _, _ in outside:
            extra_rollups.update(affected_rollups(detail["code"], liabilities))
        debt += borrowings[1] + sum(item[1] for item in outside)
        evidence.extend((borrowings, included, *outside))

    check_rollups(assets, "BPA", {"1", "1.01"})
    check_rollups(liabilities, "BPP", {"2", "2.01", "2.02", "2.03", "2.01.04", "2.02.01", *extra_rollups})
    if not reconciled(record("assets", "BPA", assets["1"]), record("liabilities", "BPP", liabilities["2"])):
        raise ValueError("O ativo total diverge do passivo total.")
    capital = invested_capital(equity=equity[1], debt=debt, excess_cash=cash[1])
    if capital is None or capital <= 0 or abs(capital) >= 2**53:
        raise ValueError("Capital investido incompatível no balanço consolidado.")
    return capital, [item[0] for item in evidence]


def unavailable(year: int, reason: str, filing: dict | None = None) -> dict:
    return {"year": year, "roic": None, "reason": reason, "filing": filing, "inputs": None}


def observe_roic(issuer: str, year: int, filing: CsvRow, rows: Roles, duplicate: bool = False) -> dict:
    source = {
        "referenceDate": filing["DT_REFER"],
        "receivedAt": filing["DT_RECEB"],
        "publishedAt": None,
        "version": int(filing["VERSAO"]),
        "filingUrl": filing["LINK_DOC"],
    }
    if duplicate:
        return unavailable(year, "Conta duplicada na mesma versão da DFP.", source)
    if any(not accounts for statements in rows.values() for accounts in statements.values()):
        return unavailable(year, "DFP consolidada ou balanço de abertura indisponível na janela civil.", source)
    filing_key = (
        filing["DT_REFER"], filing.get("ID_DOC", ""), str(filing["VERSAO"]),
    )
    supplier = GERDAU_NOTES.get(filing_key) if issuer == "003980" else None
    review_key = (issuer, *filing_key)
    review = REVIEWS.get(review_key)
    lease_review = EMBEDDED_LEASE_REVIEWS.get(review_key)
    reviewed_accounts = review.accounts if review else ()
    try:
        gross_income, operating, ebit = (
            labeled_record(rows["income"]["DRE"], key, "DRE", code, label)
            for key, code, label in INCOME_ACCOUNTS
        )
        if not reconciled(ebit, gross_income, operating):
            raise ValueError("O resultado antes do financeiro e dos tributos diverge dos subtotais da DRE.")
        opening, opening_accounts = balance_capital(
            issuer, "opening", rows["opening"], supplier[0] if supplier else None, reviewed_accounts,
            lease_review.opening if lease_review else None,
        )
        closing, closing_accounts = balance_capital(
            issuer, "closing", rows["closing"], supplier[1] if supplier else None, reviewed_accounts,
            lease_review.closing if lease_review else None,
        )
        result = calculate_roic(
            ebit=ebit[1], tax_rate=ROIC_TAX, capital_open=opening, capital_close=closing, estimated=True,
        )
        if result.value is None or result.numerator is None:
            raise ValueError(result.reasons[0] if result.reasons else "ROIC indisponível no exercício.")
    except (DecimalException, KeyError) as error:
        return unavailable(year, f"Conta ou escala monetária incompatível: {error}.", source)
    except ValueError as error:
        return unavailable(year, str(error), source)

    if supplier:
        source["supportingDocumentUrl"] = supplier[2]
    if review:
        source["supportingDocumentUrl"] = review.url
    if lease_review and not review:
        source["supportingDocumentUrl"] = lease_review.url
    if issuer == "004170":
        source["supportingDocumentUrl"] = VALE_NOTES
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
            "accounts": [gross_income[0], operating[0], ebit[0], *opening_accounts, *closing_accounts],
            **({"embeddedLeases": {
                "note": lease_review.note,
                "openingBrl": lease_review.opening.leases_brl,
                "closingBrl": lease_review.closing.leases_brl,
            }} if lease_review else {}),
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
