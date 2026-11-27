"""Reinvestimento operacional anual documentado no mesmo exercício do ROIC."""

import re
import unicodedata
from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal, DecimalException
from pathlib import Path
from zipfile import ZipFile

from .moat_cvm.archives import csv_rows, read_archive
from .moat_cvm.bank_roe import record, same_filing
from .moat_cvm.comparison_identity import selected_companies
from .moat_cvm.dfp import ORIGIN, SOURCE, CsvRow, amount, normalize
from .moat_cvm.sector_roic import METHODOLOGY as ROIC_METHOD
from .moat_cvm.sector_roic import NEWEST, PRIOR, matching_dfp_filings

METHOD = "nopat-reinvestment-dfp.v1"
BALANCE_ACCOUNTS = {
    ("BPA", "1.01.03"): ("Receivables", "contas a receber"),
    ("BPA", "1.01.04"): ("Inventories", "estoques"),
    ("BPP", "2.01.02"): ("Suppliers", "fornecedores"),
}
CASH_FLOW_STATEMENTS = ("DFC_MI", "DFC_MD")
CAPEX_OPERATIONS = frozenset("""
    aquisicao aquisicoes adicao adicoes acrescimo acrescimos compra compras aplicacao
    aplicacoes aumento aumentos investimento investimentos pagamento pagamentos desembolso
    desembolsos desenvolvimento capitalizacao construcoes
""".split())
CAPEX_QUALIFIERS = frozenset("""
    a ao aos as ativo ativos bem bens da das de do dos e em na nas no nos o os outros
    outras para pela pelas pelo pelos por uso proprio proprios
""".split())
CAPEX_PROPERTY = frozenset(("imobilizado", "imobilizados", "fixo", "fixos"))
CAPEX_INTANGIBLE = frozenset(("intangivel", "intangiveis", "instangivel", "intangives"))
CAPEX_ASSETS = CAPEX_PROPERTY | CAPEX_INTANGIBLE
SALE_PREFIX = re.compile(r"^(?:(?:valor recebido|recebimento) pela )?(?:venda|alienacao) ")
SALE_ASSET_WORDS = CAPEX_ASSETS | {
    "ativo", "ativos", "bem", "bens", "da", "das", "de", "do", "dos", "e", "investimento", "investimentos",
}
EachRow = tuple[str, CsvRow]


def _label(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text.casefold()).encode("ascii", "ignore").decode()
    return " ".join(re.findall(r"[a-z]+", re.sub(r"\(notas? [^)]+\)", "", ascii_text)))


def _capex_kind(text: str) -> str | None:
    if text == "aquisicao e desenvolvimento de softwares":
        return "capexIntangible"
    words = set(text.split())
    if words & {"investimento", "investimentos"} and not re.match(r"^investimentos? (em|no|na) ", text):
        return None
    if not words & CAPEX_ASSETS or words - (CAPEX_ASSETS | CAPEX_OPERATIONS | CAPEX_QUALIFIERS):
        return None
    if words & CAPEX_PROPERTY and words & CAPEX_INTANGIBLE:
        return "capex"
    if words & CAPEX_PROPERTY:
        return "capexProperty"
    return "capexIntangible"


def _is_asset_sale(text: str) -> bool:
    prefix = SALE_PREFIX.match(text)
    return prefix is not None and set(text[prefix.end():].split()) <= SALE_ASSET_WORDS


def _is_descendant(detail: dict, parent: dict) -> bool:
    return detail["statement"] == parent["statement"] and detail["code"].startswith(parent["code"] + ".")


def _capex(rows: list[EachRow]) -> tuple[Decimal, list[dict]]:
    candidates = []
    seen: set[tuple[str, str]] = set()
    for statement, row in rows:
        label = _label(row["DS_CONTA"])
        key = _capex_kind(label)
        if key is None:
            words = set(label.split())
            if words & CAPEX_ASSETS and words & CAPEX_OPERATIONS:
                value, _ = normalize(row)
                if value != 0 and not (value > 0 and _is_asset_sale(label)):
                    raise ValueError("Aquisições de ativos aparecem agregadas a outros fluxos na DFC.")
            continue
        detail, value, _ = record(key, statement, row)
        account = statement, detail["code"]
        if account in seen:
            raise ValueError("A DFC apresenta códigos de CAPEX conflitantes.")
        seen.add(account)
        if value > 0:
            raise ValueError("A conta de CAPEX da DFC apresenta entrada de caixa.")
        candidates.append((detail, value))

    # Uma rubrica agregadora já inclui os componentes cujos códigos descendem dela.
    for detail, value in candidates:
        if value == 0 and any(child_value != 0 and _is_descendant(child, detail) for child, child_value in candidates):
            raise ValueError("O total zerado da DFC conflita com os detalhes de CAPEX.")
    roots = [
        (detail, value)
        for detail, value in candidates
        if not any(_is_descendant(detail, parent) for parent, _ in candidates)
    ]
    # Uma linha agregada zerada fora da hierarquia pode coexistir com as duas compras em linhas próprias.
    property_statements = {detail["statement"] for detail, _ in roots if detail["key"] == "capexProperty"}
    intangible_statements = {detail["statement"] for detail, _ in roots if detail["key"] == "capexIntangible"}
    complete_statements = property_statements & intangible_statements
    roots = [
        (detail, value)
        for detail, value in roots
        if not (value == 0 and detail["key"] == "capex" and detail["statement"] in complete_statements)
    ]
    keys = {detail["key"] for detail, _ in roots}
    if (
        len(roots) != len(keys)
        or len({detail["statement"] for detail, _ in roots}) > 1
        or ("capex" in keys and len(keys) > 1)
    ):
        raise ValueError("A DFC apresenta contas de CAPEX sobrepostas ou conflitantes.")
    if keys not in ({"capex"}, {"capexProperty", "capexIntangible"}):
        raise ValueError("Compras de imobilizado e intangível indisponíveis em contas distintas ou agregadas.")
    return -sum(value for _, value in roots), [detail for detail, _ in roots]


def _read_accounts(
    archive: ZipFile, year: int, observations: dict[str, dict],
) -> tuple[dict[str, dict[str, EachRow]], dict[str, list[EachRow]], set[str]]:
    filings = matching_dfp_filings(archive, year, observations)
    positions: dict[str, dict[str, EachRow]] = defaultdict(dict)
    cash_flows: dict[str, list[EachRow]] = defaultdict(list)
    conflicts: set[str] = set()
    reference, start = f"{year}-12-31", f"{year}-01-01"
    periods = {(PRIOR, f"{year - 1}-12-31"): "opening", (NEWEST, reference): "closing"}
    available = set(archive.namelist())
    for basis in ("con", "ind"):
        for statement in ("BPA", "BPP", *CASH_FLOW_STATEMENTS):
            member = f"dfp_cia_aberta_{statement}_{basis}_{year}.csv"
            if member not in available:
                continue
            for row in csv_rows(archive, member):
                issuer = row["CD_CVM"]
                filing = filings.get(issuer)
                if filing is None or not same_filing(row, filing):
                    continue
                expected = "ind" if observations[issuer]["filing"].get("basis") == "individual" else "con"
                if basis != expected:
                    continue
                stage = periods.get((row["ORDEM_EXERC"], row["DT_FIM_EXERC"]))
                code = row["CD_CONTA"]
                entry = statement, row
                if statement in CASH_FLOW_STATEMENTS:
                    if stage == "closing" and row["DT_INI_EXERC"] == start and code.startswith("6.02."):
                        if entry not in cash_flows[issuer]:
                            cash_flows[issuer].append(entry)
                    continue
                account = BALANCE_ACCOUNTS.get((statement, code))
                if stage is None or account is None:
                    continue
                key = f"{stage}{account[0]}"
                previous = positions[issuer].get(key)
                if previous is not None and previous != entry:
                    conflicts.add(issuer)
                positions[issuer][key] = entry
    return positions, cash_flows, conflicts


def _working_capital(stage: str, rows: dict[str, EachRow]) -> tuple[Decimal, list[dict]]:
    accounts = []
    values = []
    for (statement, code), (suffix, label) in BALANCE_ACCOUNTS.items():
        key = f"{stage}{suffix}"
        entry = rows.get(key)
        if entry is None or _label(entry[1]["DS_CONTA"]) != label:
            raise ValueError(f"Conta de capital de giro ausente ou incompatível em {statement} {code}.")
        detail, value, _ = record(key, statement, entry[1])
        if value < 0:
            raise ValueError(f"Saldo negativo em {statement} {code}.")
        accounts.append(detail)
        values.append(value)
    receivables, inventories, suppliers = values
    return receivables + inventories - suppliers, accounts


def _reinvestment(name: str, observation: dict, balances: dict[str, EachRow], cash_flows: list[EachRow], conflict: bool) -> dict:
    filing = observation.get("filing")
    result = {"name": name, "value": None, "reason": None, "filing": filing, "inputs": None}
    roic = observation.get("inputs")
    if roic is None or filing is None:
        return {**result, "reason": observation.get("reason") or "NOPAT indisponível no exercício."}
    if conflict:
        return {**result, "reason": "Contas de capital de giro conflitantes na DFP."}
    try:
        opening, opening_accounts = _working_capital("opening", balances)
        closing, closing_accounts = _working_capital("closing", balances)
        capex, cash_flow_accounts = _capex(cash_flows)
        nopat = Decimal(str(roic["nopatBrl"]))
        reinvestment = capex + closing - opening
        if not all(value.is_finite() and abs(value) < 2**53 for value in (nopat, opening, closing, capex, reinvestment)):
            raise ValueError("Saldo de reinvestimento fora da faixa suportada.")
    except (DecimalException, ValueError) as error:
        return {**result, "reason": str(error)}
    return {
        **result,
        "value": amount(nopat / reinvestment) if reinvestment > 0 else None,
        "reason": None if reinvestment > 0 else "O reinvestimento no exercício é menor ou igual a zero.",
        "inputs": {
            "nopatBrl": amount(nopat),
            "openingWorkingCapitalBrl": amount(opening),
            "closingWorkingCapitalBrl": amount(closing),
            "capexBrl": amount(capex),
            "reinvestmentBrl": amount(reinvestment),
            "accounts": [*opening_accounts, *closing_accounts, *cash_flow_accounts],
        },
    }


def create_sector_reinvestment(selection: dict, directory: dict, roic: dict, raw_dir: Path) -> dict:
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
        expected = [
            entry["sha256"]
            for entry in source["archives"]
            if (entry["kind"], entry["year"]) == ("dfp", year)
        ]
        if expected != [checksum]:
            raise ValueError("O ZIP de DFP do exercício difere do usado no ROIC.")
        positions, cash_flows, conflicts = _read_accounts(
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
            _reinvestment(name, observation, positions.get(code, {}), cash_flows.get(code, []), code in conflicts)
            for code, (name, observation) in companies.items()
        ],
    }
