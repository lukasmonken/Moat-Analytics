"""Calcula margens anuais das companhias classificadas para o ROIC."""

from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal, DecimalException
from pathlib import Path
from zipfile import ZipFile

from .archives import csv_rows, read_archive
from .bank_roe import same_filing
from .comparison_identity import selected_companies
from .dfp import ORIGIN, SOURCE, CsvRow, amount, normalize
from .sector_roic import METHODOLOGY as ROIC_METHOD
from .sector_roic import NEWEST, matching_dfp_filings

METHOD = "margins-dfp.v1"
ACCOUNTS = {
    "3.01": ("revenueBrl", "Receita de Venda de Bens e/ou Serviços"),
    "3.03": ("grossIncomeBrl", "Resultado Bruto"),
    "3.05": ("ebitBrl", "Resultado Antes do Resultado Financeiro e dos Tributos"),
    "3.11": ("netIncomeBrl", "Lucro/Prejuízo Consolidado do Período"),
}


def _read_income(
    archive: ZipFile, year: int, observations: dict[str, dict],
) -> tuple[dict[str, dict[str, CsvRow]], set[str]]:
    filings = matching_dfp_filings(archive, year, observations)
    rows: dict[str, dict[str, CsvRow]] = defaultdict(dict)
    conflicts: set[str] = set()
    members = set(archive.namelist())
    for basis in ("con", "ind"):
        member = f"dfp_cia_aberta_DRE_{basis}_{year}.csv"
        if member not in members:
            continue
        for row in csv_rows(archive, member):
            issuer = row["CD_CVM"]
            filing = filings.get(issuer)
            account = row["CD_CONTA"]
            if filing is None or account not in ACCOUNTS or not same_filing(row, filing):
                continue
            expected = "ind" if observations[issuer]["filing"].get("basis") == "individual" else "con"
            if (
                basis != expected or row["ORDEM_EXERC"] != NEWEST
                or row["DT_INI_EXERC"] != f"{year}-01-01" or row["DT_FIM_EXERC"] != f"{year}-12-31"
            ):
                continue
            previous = rows[issuer].get(account)
            if previous is not None and previous != row:
                conflicts.add(issuer)
            rows[issuer][account] = row
    return rows, conflicts


def _margins(name: str, observation: dict, rows: dict[str, CsvRow], conflict: bool) -> dict:
    filing = observation.get("filing")
    result = {
        "name": name, "filing": filing, "reason": None, "inputs": None,
        "grossMargin": None, "operatingMargin": None, "netMargin": None,
    }
    if filing is None:
        return {**result, "reason": observation.get("reason") or "DFP anual indisponível."}
    if not rows:
        return {**result, "reason": "DRE anual indisponível na base da mesma DFP do ROIC."}
    if conflict:
        return {**result, "reason": "Contas de margem conflitantes na DRE."}
    try:
        inputs = {}
        for code, (key, label) in ACCOUNTS.items():
            if filing.get("basis") == "individual" and code == "3.11":
                label = "Lucro/Prejuízo do Período"
            row = rows.get(code)
            if row is None or row["DS_CONTA"].strip().casefold() != label.casefold():
                raise ValueError(f"Conta de margem ausente ou incompatível na DRE {code}.")
            inputs[key], _ = normalize(row)

        revenue = inputs["revenueBrl"]
        if revenue <= 0:
            raise ValueError("Receita não positiva na DRE 3.01.")
        roic_inputs = observation.get("inputs")
        if roic_inputs is not None and Decimal(str(roic_inputs["ebitBrl"])) != inputs["ebitBrl"]:
            raise ValueError("O resultado na DRE 3.05 diverge do EBIT utilizado no ROIC.")
    except (DecimalException, ValueError) as error:
        return {**result, "reason": str(error)}

    return {
        **result,
        "inputs": {key: amount(balance) for key, balance in inputs.items()},
        "grossMargin": amount(inputs["grossIncomeBrl"] / revenue),
        "operatingMargin": amount(inputs["ebitBrl"] / revenue),
        "netMargin": amount(inputs["netIncomeBrl"] / revenue),
    }


def create_sector_margins(selection: dict, directory: dict, roic: dict, raw_dir: Path) -> dict:
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
        rows, conflicts = _read_income(
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
            _margins(name, observation, rows.get(code, {}), code in conflicts)
            for code, (name, observation) in companies.items()
        ],
    }
