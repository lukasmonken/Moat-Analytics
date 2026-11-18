"""Extrai insumos contábeis revisados para a amostra de qualidade."""

from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path
from zipfile import ZipFile

from moat_finance import (
    QualityPoint,
    calculate_roe,
    calculate_roic,
    invested_capital,
    summarize_quality,
)

from .archives import csv_rows, read_archive
from .dfp import ORIGIN, SOURCE, CsvRow, amount, normalize, select_filings
from .sample import COMPANIES

METHODOLOGY = "quality-dfp-m2.v1"
ROIC_TAX = Decimal("0.34")
BANK = "019348"


@dataclass(frozen=True)
class MappedAccount:
    key: str
    statement: str
    code: str
    labels: tuple[str, ...]


def account(key: str, statement: str, code: str, *labels: str) -> MappedAccount:
    return MappedAccount(key, statement, code, labels)


INDUSTRIAL = (
    account("ebit", "DRE", "3.05", "Resultado Antes do Resultado Financeiro e dos Tributos"),
    account("grossIncome", "DRE", "3.03", "Resultado Bruto"),
    account("operatingIncomeAndExpenses", "DRE", "3.04", "Despesas/Receitas Operacionais"),
    account("equity", "BPP", "2.03", "Patrimônio Líquido Consolidado"),
    account("shortDebt", "BPP", "2.01.04", "Empréstimos e Financiamentos"),
    account("longDebt", "BPP", "2.02.01", "Empréstimos e Financiamentos"),
    account("shortLeaseInDebt", "BPP", "2.01.04.03", "Financiamento por Arrendamento"),
    account("longLeaseInDebt", "BPP", "2.02.01.03", "Financiamento por Arrendamento"),
    account("cash", "BPA", "1.01.01", "Caixa e Equivalentes de Caixa"),
)
ACCOUNTS = {
    "005410": (
        *INDUSTRIAL,
        account("shortLease", "BPP", "2.01.05.02.07", "Arrendamento Mercantil", "Arrendamentos"),
        account("longLease", "BPP", "2.02.02.02.05", "Arrendamento Mercantil", "Arrendamentos"),
    ),
    "008133": (
        *INDUSTRIAL,
        account("shortLease", "BPP", "2.01.05.02.09", "Arrendamentos a pagar"),
        account("longLease", "BPP", "2.02.02.02.05", "Arrendamentos a pagar"),
    ),
    BANK: (
        account("income", "DRE", "3.09", "Lucro/Prejuízo Consolidado do Período"),
        account("parentIncome", "DRE", "3.09.01", "Atribuído a Sócios da Empresa Controladora"),
        account("minorityIncome", "DRE", "3.09.02", "Atribuído a Sócios Não Controladores"),
        account("equity", "BPP", "2.08", "Patrimônio Líquido Consolidado"),
        account("minorityEquity", "BPP", "2.08.09", "Participação dos Acionistas Não Controladores"),
    ),
}
DEBT_PARTS = ("shortDebt", "longDebt", "shortLease", "longLease")


def rename_position(position: str, key: str) -> str:
    return f"{position}{key[0].upper()}{key[1:]}"


def read_quality_accounts(archive: ZipFile, year: int, filings: dict[str, CsvRow]):
    reference, opening, start = f"{year}-12-31", f"{year - 1}-12-31", f"{year}-01-01"
    mappings = {
        code: {(spec.statement, spec.code): spec for spec in ACCOUNTS[code]}
        for code in filings
    }
    inputs: dict[str, dict[str, tuple[dict, Decimal, Decimal]]] = {
        code: {} for code in filings
    }
    for statement in ("BPA", "BPP", "DRE"):
        for row in csv_rows(archive, f"dfp_cia_aberta_{statement}_con_{year}.csv"):
            code = row["CD_CVM"]
            filing = filings.get(code)
            if filing is None or row["DT_REFER"] != reference:
                continue
            if row["CNPJ_CIA"] != filing["CNPJ_CIA"] or row["VERSAO"] != filing["VERSAO"]:
                continue
            spec = mappings[code].get((statement, row["CD_CONTA"]))
            if spec is None:
                continue

            order, end = row["ORDEM_EXERC"], row["DT_FIM_EXERC"]
            if statement == "DRE":
                if (order, end, row["DT_INI_EXERC"]) != ("ÚLTIMO", reference, start):
                    continue
                key = spec.key
            else:
                if (order, end) == ("ÚLTIMO", reference):
                    key = rename_position("closing", spec.key)
                elif (order, end) == ("PENÚLTIMO", opening):
                    key = rename_position("opening", spec.key)
                else:
                    continue

            if key in inputs[code]:
                raise ValueError(f"{year} CVM {code}: conta de qualidade duplicada ({key}).")
            label = row["DS_CONTA"].strip()
            if label.casefold() not in {expected.casefold() for expected in spec.labels}:
                raise ValueError(
                    f"{year} CVM {code}: classificação não revisada em {statement} {spec.code}: {label}."
                )
            value, unit = normalize(row)
            inputs[code][key] = (
                {
                    "key": key,
                    "label": label,
                    "statement": statement,
                    "code": spec.code,
                    "referenceDate": end,
                    "amountBrl": amount(value),
                },
                value,
                unit,
            )

    for code, group in inputs.items():
        expected = [
            key
            for spec in ACCOUNTS[code]
            for key in (
                (spec.key,)
                if spec.statement == "DRE"
                else (rename_position("opening", spec.key), rename_position("closing", spec.key))
            )
        ]
        absent = [key for key in expected if key not in group]
        if absent:
            raise ValueError(f"{year} CVM {code}: insumos ausentes ({', '.join(absent)}).")
    return inputs


def reconcile_income(code: str, inputs: dict, year: int) -> None:
    if code == BANK:
        total, component_a, component_b = ("income", "parentIncome", "minorityIncome")
        failure = "lucro consolidado diverge da atribuição aos acionistas."
    else:
        total, component_a, component_b = ("ebit", "grossIncome", "operatingIncomeAndExpenses")
        failure = "resultado antes do financeiro e dos tributos diverge dos subtotais da DRE."
    difference = inputs[total][1] - inputs[component_a][1] - inputs[component_b][1]
    tolerance = sum(inputs[key][2] for key in (total, component_a, component_b)) / 2
    if abs(difference) > tolerance:
        raise ValueError(f"{year} CVM {code}: {failure}")


def capital(code: str, values: dict[str, Decimal], position: str, year: int) -> Decimal | None:
    def balance(key: str) -> Decimal:
        return values[rename_position(position, key)]

    equity = balance("equity")
    if code == BANK:
        return equity - balance("minorityEquity")

    if balance("shortLeaseInDebt") != 0 or balance("longLeaseInDebt") != 0:
        raise ValueError(f"{year} CVM {code}: arrendamentos dentro da dívida requerem novo mapeamento.")
    return invested_capital(
        equity=equity,
        debt=sum((balance(key) for key in DEBT_PARTS), Decimal(0)),
        excess_cash=balance("cash"),
    )


def json_number(value: Decimal | None) -> int | float | None:
    return amount(value) if value is not None else None


def year_observations(path: Path, year: int):
    reference = f"{year}-12-31"
    with read_archive(path) as (archive, checksum, collected):
        filings = select_filings(archive, year, reference)
        inputs = read_quality_accounts(archive, year, filings)

    for code, filing in filings.items():
        receipt = date.fromisoformat(filing["DT_RECEB"])
        if not date.fromisoformat(reference) <= receipt <= collected.date():
            raise ValueError(f"{year} CVM {code}: data de recebimento incompatível com a coleta.")
        group = inputs[code]
        reconcile_income(code, group, year)
        values = {key: record[1] for key, record in group.items()}
        opening = capital(code, values, "opening", year)
        closing = capital(code, values, "closing", year)
        if code == BANK:
            result = calculate_roe(
                net_income=values["parentIncome"],
                equity_open=opening,
                equity_close=closing,
            )
        else:
            result = calculate_roic(
                ebit=values["ebit"],
                tax_rate=ROIC_TAX,
                capital_open=opening,
                capital_close=closing,
                estimated=True,
            )
        reasons = list(result.reasons)
        if code != BANK:
            reasons.append("Estimativa com alíquota de cenário de 34% e caixa total como proxy de caixa excedente.")
        yield code, filing["DENOM_CIA"], QualityPoint(year, result.value), {
            "fiscalYear": year,
            "value": json_number(result.value),
            "changePp": None,
            "spreadPp": None,
            "numeratorBrl": json_number(result.numerator),
            "openingCapitalBrl": json_number(opening),
            "closingCapitalBrl": json_number(closing),
            "averageCapitalBrl": json_number(result.denominator),
            "filingVersion": int(filing["VERSAO"]),
            "archiveUrl": f"{ORIGIN}dfp_cia_aberta_{year}.zip",
            "archiveSha256": checksum,
            "provenance": {
                "source": "CVM · DFP anual consolidado",
                "referenceDate": reference,
                "publishedAt": None,
                "retrievedAt": collected.isoformat(timespec="seconds"),
                "methodologyVersion": METHODOLOGY,
                "qualityStatus": result.quality_status,
            },
            "reasons": reasons,
            "inputs": [group[key][0] for key in sorted(group)],
        }


def create_quality_snapshot(archives: dict[int, Path]) -> dict:
    companies = {
        code: {
            "companyId": f"cvm:{int(code)}",
            "category": category,
            "metric": "roe" if code == BANK else "roic",
            "observations": [],
        }
        for code, category in COMPANIES.items()
    }
    series: dict[str, list[QualityPoint]] = {code: [] for code in companies}
    for year, path in sorted(archives.items()):
        for code, name, point, observation in year_observations(path, year):
            companies[code]["name"] = name
            companies[code]["observations"].append(observation)
            series[code].append(point)

    for code, company in companies.items():
        summary = summarize_quality(series[code])
        for observation in company["observations"]:
            observation["changePp"] = json_number(
                summary.annual_deltas_pp.get(observation["fiscalYear"])
            )
        company["summary"] = {
            "validYears": summary.valid_years,
            "mean": json_number(summary.mean),
            "median": json_number(summary.median),
            "populationStddev": json_number(summary.population_stddev),
            "amplitude": json_number(summary.amplitude),
            "trendPpPerYear": json_number(summary.trend_pp_per_year),
        }
    return {
        "manifest": {
            "schemaVersion": "1.0.0",
            "generatedAt": datetime.now(UTC).isoformat(timespec="seconds"),
            "asOf": f"{max(archives)}-12-31",
            "coverage": {"eligibleCompanies": None, "includedCompanies": len(companies)},
            "source": SOURCE,
        },
        "methodologyVersion": METHODOLOGY,
        "roicTaxRate": json_number(ROIC_TAX),
        "benchmark": {
            "status": "unavailable",
            "reason": "A série histórica da taxa prefixada de dez anos aguarda validação de cobertura e autorização de publicação.",
        },
        "ranking": {
            "status": "unavailable",
            "reason": "A classificação requer pares com históricos comparáveis e indicadores validados. A amostra contém uma companhia por categoria.",
        },
        "companies": list(companies.values()),
    }
