"""Extrai dividendos e JCP pagos na DFC individual do exercício anual."""

import re
import unicodedata
from decimal import Decimal, DecimalException
from zipfile import ZipFile

from .archives import csv_rows
from .bank_roe import same_filing
from .dfp import CsvRow, amount, normalize

STATEMENTS = ("DFC_MI", "DFC_MD")
FINANCING_ACCOUNT = re.compile(r"6\.03(?:\.[0-9]{2})+")
PAYMENT_PREFIX = re.compile(r"^(?:pagamentos?|distribuicao) de ")
PAYMENT_SUFFIX = re.compile(r" pag[oa]s?$")
DIVIDEND = "dividendos"
JCP = "juros sobre capital proprio"
COMBINED = "dividendos e juros sobre capital proprio"


def _payment_kind(text: str) -> str | None:
    ascii_label = unicodedata.normalize("NFKD", text.casefold()).encode("ascii", "ignore").decode()
    label = " ".join(ascii_label.split()).replace("dividentos", "dividendos")
    label = label.replace("juros s/ ", "juros sobre ").replace("sobre o capital", "sobre capital")
    label = PAYMENT_SUFFIX.sub("", PAYMENT_PREFIX.sub("", label)).replace("jcp", JCP)
    if label == f"{JCP} e {DIVIDEND}":
        return COMBINED
    return label if label in (DIVIDEND, JCP, COMBINED) else None


def _paid_accounts(rows_by_code: dict[str, list[CsvRow]]) -> tuple[Decimal, list[str]]:
    selected: dict[str, tuple[str, Decimal]] = {}
    for code, rows in rows_by_code.items():
        kind = next((kind for row in rows if (kind := _payment_kind(row["DS_CONTA"]))), None)
        if kind is None:
            continue
        if len(rows) != 1:
            raise ValueError("Contas de dividendos ou JCP conflitantes na DFC individual.")
        value, _ = normalize(rows[0])
        if value > 0:
            raise ValueError("Conta de dividendos ou JCP sem sinal de saída na DFC individual.")
        selected[code] = (kind, value)

    roots: dict[str, tuple[str, Decimal]] = {}
    for code, (kind, value) in sorted(selected.items()):
        parent = next((parent for parent in roots if code.startswith(parent + ".")), None)
        if parent is None:
            roots[code] = (kind, value)
        elif roots[parent][0] not in (COMBINED, kind) or value < roots[parent][1]:
            raise ValueError("Detalhes incompatíveis com a conta total de dividendos ou JCP.")

    kinds = {kind for kind, _ in roots.values()}
    if len(kinds) != len(roots) or (COMBINED in kinds and len(roots) > 1):
        raise ValueError("Não foi possível conciliar as contas de dividendos ou JCP na DFC individual.")
    total = -sum((value for _, value in roots.values()), Decimal(0))
    if total >= 2**53:
        raise ValueError("Total de dividendos ou JCP inválido na DFC individual.")
    return total, list(roots)


def _payments(year: int, statements: dict[str, dict[str, list[CsvRow]]], reason: str | None) -> dict:
    empty = {"year": year, "paidBrl": None, "statement": None, "accountCodes": []}
    if reason is not None:
        return {**empty, "reason": reason}
    try:
        measures = []
        for statement, rows in statements.items():
            total, codes = _paid_accounts(rows)
            if codes:
                measures.append((statement, total, codes))
        if not measures:
            raise ValueError("Pagamento de dividendos ou JCP indisponível na DFC individual.")
        statement, total, codes = measures[0]
        if any(value != total for _, value, _ in measures[1:]):
            raise ValueError("Os métodos da DFC individual divergem no total de dividendos ou JCP.")
    except (DecimalException, KeyError):
        return {**empty, "reason": "Valor contábil ou escala incompatível na DFC individual."}
    except ValueError as error:
        return {**empty, "reason": str(error)}
    return {**empty, "paidBrl": amount(total), "statement": statement, "accountCodes": codes, "reason": None}


def read_annual_dividends(
    archive: ZipFile, year: int, filings: dict[str, CsvRow], missing_filings: dict[str, str],
) -> dict[str, dict]:
    reference, start = f"{year}-12-31", f"{year}-01-01"
    rows: dict[str, dict[str, dict[str, list[CsvRow]]]] = {code: {} for code in filings}
    members = set(archive.namelist())
    for statement in STATEMENTS:
        member = f"dfp_cia_aberta_{statement}_ind_{year}.csv"
        if member not in members:
            continue
        for row in csv_rows(archive, member):
            code = row["CD_CVM"]
            filing = filings.get(code)
            if filing is None or not same_filing(row, filing):
                continue
            account = row["CD_CONTA"]
            if (
                (row["ORDEM_EXERC"], row["DT_INI_EXERC"], row["DT_FIM_EXERC"]) != ("ÚLTIMO", start, reference)
                or not FINANCING_ACCOUNT.fullmatch(account)
            ):
                continue
            entries = rows[code].setdefault(statement, {}).setdefault(account, [])
            if row not in entries:
                entries.append(row)
    return {
        code: _payments(year, rows.get(code, {}), missing_filings.get(code))
        for code in filings.keys() | missing_filings.keys()
    }
