"""Extrai os componentes contábeis do valor da firma dos ITRs consolidados."""

from datetime import date
from decimal import Decimal, DecimalException
from pathlib import Path

from .archives import csv_rows, read_archive
from .dfp import CsvRow, amount, normalize
from .price_filings import ITR_ORIGIN, QUARTER_ENDS, latest_income_filing, select_income_filings
from .quality import ACCOUNTS, DEBT_PARTS, account
from .sample import COMPANIES

METHODOLOGY = "price-balance.v1"
LIMITATIONS = (
    "A dívida líquida simplificada deduz caixa e equivalentes. Aplicações financeiras "
    "circulantes são informadas à parte. O cálculo não ajusta aplicações não circulantes, "
    "derivativos ou investimentos em participações societárias.",
    "O patrimônio atribuível aos não controladores é um ajuste contábil aproximado "
    "para o valor da firma.",
)
RENNER_LIMITATION = (
    "O balanço consolidado inclui a Realize, o negócio de serviços financeiros do grupo. "
    "Os saldos não representam o varejo de forma isolada."
)
MAPPINGS = {
    code: (
        *(spec for spec in ACCOUNTS[code] if spec.statement in ("BPA", "BPP") and spec.key != "equity"),
        account("financialInvestments", "BPA", "1.01.02", "Aplicações Financeiras"),
        account(
            "nonControllingInterests",
            "BPP",
            "2.03.09",
            "Participação dos Acionistas Não Controladores",
        ),
    )
    for code, category in COMPANIES.items()
    if category != "bank"
}


def reconcile_group(
    amounts: dict[str, tuple[Decimal, Decimal]], code: str
) -> None:
    children = [
        value for key, value in amounts.items()
        if key.startswith(code + ".") and key.count(".") == code.count(".") + 1
    ]
    if not children:
        raise ValueError(f"Faltam os subtotais para conciliar a conta {code}.")
    total, unit = amounts[code]
    difference = total - sum(child[0] for child in children)
    tolerance = (unit + sum(child[1] for child in children)) / 2
    if abs(difference) > tolerance:
        raise ValueError(f"A conta {code} diverge de seus subtotais.")


def balance_components(
    code: str, reference: str, rows: dict[str, dict[str, CsvRow]]
) -> dict:
    amounts = {
        statement: {key: normalize(row) for key, row in accounts.items()}
        for statement, accounts in rows.items()
    }
    inputs = []
    values = {}
    for spec in MAPPINGS[code]:
        row = rows[spec.statement].get(spec.code)
        if row is None:
            raise ValueError(f"Falta a conta {spec.code} no balanço consolidado.")
        label = row["DS_CONTA"].strip()
        if label.casefold() not in {expected.casefold() for expected in spec.labels}:
            raise ValueError(f"Classificação contábil não revisada para a conta {spec.code}.")
        value, _ = amounts[spec.statement][spec.code]
        values[spec.key] = value
        inputs.append({
            "key": spec.key,
            "statement": spec.statement,
            "code": spec.code,
            "label": label,
            "referenceDate": reference,
            "amountBrl": amount(value),
        })

    if any(values[key] < 0 for key in (*DEBT_PARTS, "cash", "financialInvestments")):
        raise ValueError("Saldo negativo em dívida, arrendamentos, caixa ou aplicações.")
    if values["shortLeaseInDebt"] != 0 or values["longLeaseInDebt"] != 0:
        raise ValueError("Arrendamentos dentro da dívida exigem revisão para evitar dupla contagem.")
    lease_codes = {
        spec.code for spec in MAPPINGS[code] if spec.key in ("shortLease", "longLease")
    }
    if any(
        key not in lease_codes
        and "arrend" in row["DS_CONTA"].casefold()
        and amounts["BPP"][key][0] != 0
        for key, row in rows["BPP"].items()
    ):
        raise ValueError("Há arrendamentos com classificação contábil não revisada.")
    for group in ("1", "1.01"):
        reconcile_group(amounts["BPA"], group)
    for group in ("2", "2.01.04", "2.02.01", "2.01.05.02", "2.02.02.02", "2.03"):
        reconcile_group(amounts["BPP"], group)
    if amounts["BPA"]["1"][0] != amounts["BPP"]["2"][0]:
        raise ValueError("O ativo total diverge do passivo total.")

    borrowings = values["shortDebt"] + values["longDebt"]
    leases = values["shortLease"] + values["longLease"]
    gross_debt = borrowings + leases
    net_debt = gross_debt - values["cash"]
    for combined in (gross_debt, net_debt):
        if abs(combined) >= 2**53:
            raise ValueError("Saldo combinado fora da faixa suportada.")
    return {
        "borrowingsBrl": amount(borrowings),
        "leaseLiabilitiesBrl": amount(leases),
        "grossDebtBrl": amount(gross_debt),
        "cashBrl": amount(values["cash"]),
        "netDebtBrl": amount(net_debt),
        "nonControllingInterestsBrl": amount(values["nonControllingInterests"]),
        "financialInvestmentsBrl": amount(values["financialInvestments"]),
        "inputs": inputs,
        "limitations": [*LIMITATIONS, RENNER_LIMITATION] if code == "008133" else list(LIMITATIONS),
    }


def read_price_balances(
    itr_archive: Path, reference: date
) -> tuple[dict[str, dict], dict[str, str]]:
    if (reference.month, reference.day) not in QUARTER_ENDS:
        raise ValueError("A data do ITR deve encerrar um dos três primeiros trimestres.")
    balances = {}
    issues = {}
    reference_date = reference.isoformat()
    with read_archive(itr_archive) as (archive, checksum, collected):
        members = {
            statement: f"itr_cia_aberta_{statement}_con_{reference.year}.csv"
            for statement in ("BPA", "BPP")
        }
        if not set(members.values()).issubset(archive.namelist()):
            return {}, {
                f"cvm:{int(code)}": "O arquivo ITR não contém os balanços consolidados."
                for code in MAPPINGS
            }
        filings = {}
        candidates = select_income_filings(archive, "ITR", reference)
        for code in MAPPINGS:
            try:
                filings[code] = latest_income_filing(candidates[code], "ITR", reference, collected)
            except ValueError as error:
                issues[f"cvm:{int(code)}"] = str(error)
        rows = {code: {"BPA": {}, "BPP": {}} for code in filings}
        duplicates = set()
        for statement, member in members.items():
            for row in csv_rows(archive, member):
                code = row["CD_CVM"]
                filing = filings.get(code)
                if (
                    not filing
                    or (row["ORDEM_EXERC"], row["DT_FIM_EXERC"]) != ("ÚLTIMO", reference_date)
                    or any(row[key] != filing[key] for key in ("CNPJ_CIA", "DT_REFER", "VERSAO"))
                ):
                    continue
                key = row["CD_CONTA"]
                if key in rows[code][statement]:
                    duplicates.add(code)
                rows[code][statement][key] = row

        for code, filing in filings.items():
            company_id = f"cvm:{int(code)}"
            try:
                if code in duplicates:
                    raise ValueError("Há contas duplicadas no balanço consolidado.")
                document = filing["LINK_DOC"].replace(
                    "http://www.rad.cvm.gov.br/", "https://www.rad.cvm.gov.br/", 1
                )
                if not document.startswith("https://www.rad.cvm.gov.br/"):
                    raise ValueError("Endereço do documento incompatível no ITR.")
                balances[company_id] = {
                    **balance_components(code, reference_date, rows[code]),
                    "filingVersion": int(filing["VERSAO"]),
                    "receiptDate": filing["DT_RECEB"],
                    "documentUrl": document,
                    "archiveUrl": f"{ITR_ORIGIN}itr_cia_aberta_{reference.year}.zip",
                    "archiveSha256": checksum,
                    "provenance": {
                        "source": "CVM · ITR consolidado",
                        "referenceDate": reference_date,
                        "publishedAt": None,
                        "retrievedAt": collected.isoformat(timespec="seconds"),
                        "methodologyVersion": METHODOLOGY,
                        "qualityStatus": "validated",
                    },
                }
            except (DecimalException, KeyError, ValueError) as error:
                issues[company_id] = str(error)
    return balances, issues
