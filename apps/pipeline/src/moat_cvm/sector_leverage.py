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

METHOD = "net-debt-ebitda-dfp.v1"
GROUPS = {"DFC_MI": "6.01.01.", "DFC_MD": "6.01."}
DEPRECIATION = {"depreciacao", "depreciacoes", "deprecicao"}
AMORTIZATION = {"amortizacao", "amortizacoes"}
DEPLETION = {"exaustao", "exaustoes", "deplecao", "deplecoes"}
ASSETS = ("direito de uso", "direitos de uso", "imobilizado", "intang", "mais valia", "arrendamento", "concessao")
DFCRow = tuple[str, CsvRow]


def _label(text: str) -> str:
    return unicodedata.normalize("NFKD", text.casefold()).encode("ascii", "ignore").decode()


def _total(label: str) -> bool:
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


def _depreciation(rows: list[DFCRow]) -> tuple[Decimal, dict]:
    totals = [(statement, row) for statement, row in rows if _total(_label(row["DS_CONTA"]))]
    if not totals:
        raise ValueError("Total de depreciação e amortização indisponível na DFC.")
    if len(totals) != 1:
        raise ValueError("Mais de uma conta de depreciação e amortização na DFC.")
    statement, total = totals[0]
    value, _ = normalize(total)
    if value < 0:
        raise ValueError("Saldo de depreciação e amortização negativo na DFC.")
    code = total["CD_CONTA"]
    for other_statement, row in rows:
        if (other_statement, row) == (statement, total) or not _component(_label(row["DS_CONTA"])):
            continue
        if other_statement == statement and row["CD_CONTA"].startswith(code + "."):
            continue
        if normalize(row)[0] != 0:
            raise ValueError("A DFC apresenta componentes de depreciação e amortização em contas separadas.")
    return value, {
        "statement": statement,
        "code": code,
        "label": total["DS_CONTA"].strip(),
        "referenceDate": total["DT_FIM_EXERC"],
    }


def _read_dfc(
    archive: ZipFile, year: int, observations: dict[str, dict],
) -> dict[str, list[DFCRow]]:
    reference = f"{year}-12-31"
    filings = matching_dfp_filings(archive, year, observations)
    rows: dict[str, list[DFCRow]] = defaultdict(list)
    for basis in ("con", "ind"):
        for statement, prefix in GROUPS.items():
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
                    or not row["CD_CONTA"].startswith(prefix)
                ):
                    continue
                entry = statement, row
                if entry not in rows[code]:
                    rows[code].append(entry)
    return rows


def _leverage(name: str, observation: dict, rows: list[DFCRow]) -> dict:
    filing = observation.get("filing")
    result = {"name": name, "value": None, "reason": None, "filing": filing, "inputs": None}
    inputs = observation.get("inputs")
    if inputs is None or filing is None:
        return {**result, "reason": observation.get("reason") or "Contas do ROIC indisponíveis."}
    net_debt = closing_net_debt(inputs, filing["referenceDate"])
    if net_debt is None:
        return {**result, "reason": "Dívida líquida indisponível no balanço de fechamento."}
    try:
        depreciation, account = _depreciation(rows)
        ebit = Decimal(str(inputs["ebitBrl"]))
        ebitda = ebit + depreciation
        if not 0 < ebitda < 2**53:
            raise ValueError("EBITDA estimado inválido ou não positivo.")
    except (DecimalException, ValueError) as error:
        return {**result, "reason": str(error)}
    return {
        **result,
        "value": amount(net_debt / ebitda),
        "inputs": {
            "ebitBrl": amount(ebit),
            "depreciationBrl": amount(depreciation),
            "ebitdaBrl": amount(ebitda),
            "netDebtBrl": amount(net_debt),
            "depreciationAccount": account,
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
        rows = _read_dfc(archive, year, {code: observation for code, (_, observation) in companies.items()})
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
            _leverage(name, observation, rows.get(code, []))
            for code, (name, observation) in companies.items()
        ],
    }
