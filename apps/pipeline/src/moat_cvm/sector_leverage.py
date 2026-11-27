"""Dívida líquida sobre EBITDA estimado no exercício mais recente do ROIC."""

import re
import unicodedata
from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal, DecimalException
from pathlib import Path
from zipfile import ZipFile

from .archives import csv_rows, read_archive
from .bank_roe import same_filing
from .comparison_identity import selected_companies
from .dfp import ORIGIN, SOURCE, CsvRow, amount, normalize
from .sector_roic import METHODOLOGY as ROIC_METHOD, NEWEST, closing_net_debt, matching_dfp_filings

METHOD = "net-debt-ebitda-dfp.v2"
GROUPS = {"DFC_MI": "6.01.01.", "DFC_MD": "6.01."}
DEPRECIATION = {"depreciacao", "depreciacoes", "deprecicao"}
AMORTIZATION = {"amortizacao", "amortizacoes", "amotizacao"}
DEPLETION = {"exaustao", "exaustoes", "deplecao", "deplecoes"}
ASSETS = ("direito de uso", "direitos de uso", "imobilizado", "intang", "mais valia", "arrendamento", "concessao")
DVA_CODE = "7.04.01"
DVA_LABEL = "depreciacao, amortizacao e exaustao"
RIGHT_OF_USE = re.compile(r"(?:depreciacao|amortizacao) (?:(?:de|do) )?direitos? de uso")
DFCRow = tuple[str, CsvRow]


def _label(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text.casefold()).encode("ascii", "ignore").decode()
    label = " ".join(ascii_text.split())
    label = re.sub(r"^despesas? (?:com|de) ", "", label)
    return re.sub(r"\s*\(nota \d+(?: e \d+)*\)$", "", label)


def _total(label: str) -> bool:
    if label in (
        "depreciacao de bens do ativo imobilizado e intangivel",
        "depreciacao e amortizacao de bens ativo imobilizado e intangivel",
    ):
        return True
    words = set(re.findall(r"[a-z]+", label)) - {"e"}
    return (
        len(words) in (2, 3)
        and len(words & DEPRECIATION) == 1
        and len(words & AMORTIZATION) == 1
        and words <= DEPRECIATION | AMORTIZATION | DEPLETION
    )


def _component(label: str) -> bool:
    text = label.strip()
    if text.startswith(("credito", "reversao")):
        return False
    return (
        bool(re.search(r"\b(deprecia\w*|exaust\w*|deplec\w*)\b", text))
        or text in AMORTIZATION
        or (text.startswith("amortiza") and any(word in text for word in ASSETS))
    )


def _split_depreciation(rows: list[DFCRow]) -> list[DFCRow]:
    components = [
        (statement, row) for statement, row in rows
        if _label(row["DS_CONTA"]) in DEPRECIATION | AMORTIZATION
    ]
    if len(components) != 2:
        raise ValueError("Total de depreciação e amortização indisponível na DFC.")
    first, second = components
    labels = {_label(row["DS_CONTA"]) for _, row in components}
    codes = [row["CD_CONTA"] for _, row in components]
    if (
        len(labels & DEPRECIATION) != 1 or len(labels & AMORTIZATION) != 1
        or first[0] != second[0] or codes[0] == codes[1]
        or codes[0].rsplit(".", 1)[0] != codes[1].rsplit(".", 1)[0]
    ):
        raise ValueError("Contas separadas de depreciação e amortização sem conciliação na DFC.")
    return sorted(components, key=lambda entry: entry[1]["CD_CONTA"])


def _corroborated_total(total: DFCRow, separate: DFCRow, dva_rows: tuple[CsvRow, ...]) -> dict | None:
    statement, total_row = total
    separate_statement, separate_row = separate
    total_words = set(re.findall(r"[a-z]+", _label(total_row["DS_CONTA"])))
    if (
        len(dva_rows) != 1
        or not total_words <= DEPRECIATION | AMORTIZATION | {"e"}
        or statement != separate_statement
        or total_row["CD_CONTA"].rsplit(".", 1)[0] != separate_row["CD_CONTA"].rsplit(".", 1)[0]
        or not RIGHT_OF_USE.fullmatch(_label(separate_row["DS_CONTA"]))
        or normalize(separate_row)[0] <= 0
    ):
        return None
    dva = dva_rows[0]
    if dva["CD_CONTA"] != DVA_CODE or _label(dva["DS_CONTA"]) != DVA_LABEL:
        return None
    value, _ = normalize(dva)
    if value > 0 or value != -normalize(total_row)[0]:
        return None
    return {
        "statement": "DVA",
        "code": DVA_CODE,
        "label": dva["DS_CONTA"].strip(),
        "referenceDate": dva["DT_FIM_EXERC"],
        "amountBrl": amount(value),
    }


def _depreciation(rows: list[DFCRow], dva_rows: tuple[CsvRow, ...] = ()) -> tuple[Decimal, dict]:
    totals = [(statement, row) for statement, row in rows if _total(_label(row["DS_CONTA"]))]
    if len(totals) > 1:
        raise ValueError("Mais de uma conta de depreciação e amortização na DFC.")

    selected = totals or _split_depreciation(rows)
    statement = selected[0][0]
    codes = {row["CD_CONTA"] for _, row in selected}
    outside = []
    for entry in rows:
        other_statement, row = entry
        if entry in selected:
            continue
        if other_statement == statement and row["CD_CONTA"] in codes:
            raise ValueError("Conta de depreciação e amortização duplicada na DFC.")
        if other_statement == statement and any(row["CD_CONTA"].startswith(code + ".") for code in codes):
            continue
        outside.append(entry)
    corroboration = None
    if any(_component(_label(row["DS_CONTA"])) and normalize(row)[0] != 0 for _, row in outside):
        separate = [
            entry for entry in outside
            if re.search(r"\b(?:deprec|amortiz|amotiz|exaus|deple)", _label(entry[1]["DS_CONTA"]))
            and normalize(entry[1])[0] != 0
        ]
        if totals and len(separate) == 1:
            corroboration = _corroborated_total(totals[0], separate[0], dva_rows)
        if corroboration is None:
            raise ValueError("A DFC apresenta componentes de depreciação e amortização em contas separadas.")

    accounts = []
    depreciation = Decimal(0)
    for statement, row in selected:
        value, _ = normalize(row)
        if value < 0:
            raise ValueError("Saldo de depreciação e amortização negativo na DFC.")
        account = {
            "statement": statement,
            "code": row["CD_CONTA"],
            "label": row["DS_CONTA"].strip(),
            "referenceDate": row["DT_FIM_EXERC"],
        }
        if len(selected) == 1:
            evidence = {"depreciationAccount": account}
            if corroboration is not None:
                evidence["depreciationDvaAccount"] = corroboration
            return value, evidence
        accounts.append({**account, "amountBrl": amount(value)})
        depreciation += value
    if depreciation >= 2**53:
        raise ValueError("Total de depreciação e amortização fora da faixa suportada.")
    return depreciation, {"depreciationAccounts": accounts}


def _read_depreciation_rows(
    archive: ZipFile, year: int, observations: dict[str, dict],
) -> tuple[dict[str, list[DFCRow]], dict[str, list[CsvRow]]]:
    reference = f"{year}-12-31"
    filings = matching_dfp_filings(archive, year, observations)
    rows: dict[str, list[DFCRow]] = defaultdict(list)
    dva_rows: dict[str, list[CsvRow]] = defaultdict(list)
    for basis in ("con", "ind"):
        for statement in (*GROUPS, "DVA"):
            member = f"dfp_cia_aberta_{statement}_{basis}_{year}.csv"
            if member not in archive.namelist():
                continue
            for row in csv_rows(archive, member):
                code = row["CD_CVM"]
                if code not in filings or not same_filing(row, filings[code]):
                    continue
                filing = observations[code]["filing"]
                expected_basis = "ind" if filing.get("basis") == "individual" else "con"
                if (
                    basis != expected_basis or row["ORDEM_EXERC"] != NEWEST
                    or row["DT_INI_EXERC"] != f"{year}-01-01" or row["DT_FIM_EXERC"] != reference
                ):
                    continue
                if statement == "DVA":
                    if row["CD_CONTA"] == DVA_CODE and row not in dva_rows[code]:
                        dva_rows[code].append(row)
                elif row["CD_CONTA"].startswith(GROUPS[statement]):
                    entry = statement, row
                    if entry not in rows[code]:
                        rows[code].append(entry)
    return rows, dva_rows


def _leverage(
    name: str, observation: dict, rows: list[DFCRow], dva_rows: tuple[CsvRow, ...] = (),
) -> dict:
    filing = observation.get("filing")
    result = {"name": name, "value": None, "reason": None, "filing": filing, "inputs": None}
    inputs = observation.get("inputs")
    if inputs is None or filing is None:
        return {**result, "reason": observation.get("reason") or "Contas do ROIC indisponíveis."}
    net_debt = closing_net_debt(inputs, filing["referenceDate"])
    if net_debt is None:
        return {**result, "reason": "Dívida líquida indisponível no balanço de fechamento."}
    try:
        depreciation, evidence = _depreciation(rows, dva_rows)
        ebit = Decimal(str(inputs["ebitBrl"]))
        ebitda = ebit + depreciation
        if not ebitda.is_finite() or abs(ebitda) >= 2**53:
            raise ValueError("EBITDA estimado inválido.")
    except (DecimalException, ValueError) as error:
        return {**result, "reason": str(error)}
    return {
        **result,
        "value": amount(net_debt / ebitda) if ebitda > 0 else None,
        "reason": "EBITDA estimado não positivo." if ebitda <= 0 else None,
        "inputs": {
            "ebitBrl": amount(ebit),
            "depreciationBrl": amount(depreciation),
            "ebitdaBrl": amount(ebitda),
            "netDebtBrl": amount(net_debt),
            **evidence,
        },
    }


def create_sector_leverage(selection: dict, directory: dict, roic: dict, raw_dir: Path) -> dict:
    cutoff, names = selected_companies(selection, directory)
    code_by_name = {name: f"{code:06}" for code, name in names.items()}
    source = roic["manifest"]
    if source["asOf"] != cutoff.isoformat() or source["methodologyVersion"] != ROIC_METHOD:
        raise ValueError("O comparativo de ROIC não corresponde à seleção anual.")
    year = max(source["years"])
    companies: dict[str, tuple[str, dict]] = {}
    for company in roic["companies"]:
        name = company["name"]
        code = code_by_name.get(name)
        current = [observation for observation in company["observations"] if observation["year"] == year]
        if code is None or code in companies or len(current) != 1:
            raise ValueError("Companhia ou exercício inválido no comparativo de ROIC.")
        companies[code] = (name, current[0])
    path = raw_dir / f"dfp_cia_aberta_{year}.zip"
    with read_archive(path) as (archive, checksum, collected):
        rows, dva_rows = _read_depreciation_rows(
            archive, year, {code: observation for code, (_, observation) in companies.items()},
        )
    return {
        "manifest": {
            "schemaVersion": "1.0.0",
            "methodologyVersion": METHOD,
            "asOf": cutoff.isoformat(),
            "year": year,
            "generatedAt": datetime.now(UTC).isoformat(timespec="seconds"),
            "source": SOURCE,
            "archive": {
                "kind": "dfp", "year": year, "url": ORIGIN + path.name,
                "sha256": checksum, "retrievedAt": collected.isoformat(timespec="seconds"),
            },
        },
        "companies": [
            _leverage(name, observation, rows.get(code, []), tuple(dva_rows.get(code, [])))
            for code, (name, observation) in companies.items()
        ],
    }
