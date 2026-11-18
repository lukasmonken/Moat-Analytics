"""Séries de ROE contábil de bancos de varejo com DFPs consolidados."""

from datetime import UTC, date, datetime
from decimal import Decimal, DecimalException
from pathlib import Path
from zipfile import ZipFile

from moat_finance import QualityPoint, calculate_roe, return_percentiles, summarize_quality
from moat_finance.ranking import MINIMUM_PEERS

from .archives import csv_rows, read_archive
from .dfp import ORIGIN, SOURCE, CsvRow, normalize
from .quality import ACCOUNTS, BANK, account, json_number, rename_position

METHODOLOGY = "bank-roe-dfp-m2.v1"
BANKS = {
    "000906": ("BCO BRADESCO S.A.", "60.746.948/0001-12"),
    "001023": ("BCO BRASIL S.A.", "00.000.000/0001-91"),
    "001210": ("BANCO DO ESTADO DO RIO GRANDE DO SUL SA", "92.702.067/0001-96"),
    "019348": ("ITAU UNIBANCO HOLDING S.A.", "60.872.504/0001-23"),
    "020532": ("BCO SANTANDER (BRASIL) S.A.", "90.400.888/0001-42"),
}
STANDARD_ACCOUNTS = (
    account("income", "DRE", "3.11", "Lucro ou Prejuízo Líquido Consolidado do Período"),
    account("parentIncome", "DRE", "3.11.01", "Atribuído aos Sócios da Empresa Controladora"),
    account("minorityIncome", "DRE", "3.11.02", "Atribuído aos Sócios não Controladores"),
    account("equity", "BPP", "2.07", "Patrimônio Líquido Consolidado"),
    account("parentEquity", "BPP", "2.07.01", "Patrimônio Líquido Atribuído ao Controlador"),
    account("minorityEquity", "BPP", "2.07.02", "Patrimônio Líquido Atribuído aos Não Controladores"),
)
ITAU_EQUITY_COMPONENTS = (
    "Capital Social Realizado",
    "Reservas de Capital",
    "Reservas de Reavaliação",
    "Reservas de Lucros",
    "Lucros/Prejuízos Acumulados",
    "Ajustes de Avaliação Patrimonial",
    "Ajustes Acumulados de Conversão",
    "Outros Resultados Abrangentes",
)
ITAU_COMPONENT_KEYS = tuple(f"equityComponent{index}" for index in range(1, 9))
ACCOUNT_MAPS = {
    code: (
        (
            *ACCOUNTS[BANK],
            *(account(key, "BPP", f"2.08.{index:02}", label)
              for index, (key, label) in enumerate(zip(ITAU_COMPONENT_KEYS, ITAU_EQUITY_COMPONENTS), 1)),
        )
        if code == BANK else STANDARD_ACCOUNTS
    )
    for code in BANKS
}
ACCOUNT_KEYS = {
    code: {(spec.statement, spec.code): spec for spec in specs}
    for code, specs in ACCOUNT_MAPS.items()
}
SANTANDER_IFRS_2022 = (
    "https://cms.santander.com.br/sites/WRI/documentos/url-dfs-ifrs-4T22/"
    "23-02-28_185641_dfs%2520ifrs%25204t22.pdf"
)
Record = tuple[dict, Decimal, Decimal]


def bank_filings(archive: ZipFile, year: int, reference: str) -> dict[str, list[CsvRow]]:
    candidates: dict[str, list[CsvRow]] = {code: [] for code in BANKS}
    for row in csv_rows(archive, f"dfp_cia_aberta_{year}.csv"):
        code = row["CD_CVM"]
        if code in candidates and row["DT_REFER"] == reference:
            candidates[code].append(row)
    return candidates


def latest_filing(rows: list[CsvRow], code: str, reference: str, collected: datetime) -> CsvRow:
    if not rows:
        raise ValueError("DFP anual ausente.")
    version = max(int(row["VERSAO"]) for row in rows)
    current = [row for row in rows if int(row["VERSAO"]) == version]
    filing = current[0]
    if version < 1 or any(row != filing for row in current):
        raise ValueError("Metadados conflitantes ou versão inválida no DFP mais recente.")
    if filing["CATEG_DOC"] != "DFP" or filing["CNPJ_CIA"] != BANKS[code][1]:
        raise ValueError("Identificação do emissor ou categoria do DFP divergente.")
    received = date.fromisoformat(filing["DT_RECEB"])
    if not date.fromisoformat(reference) <= received <= collected.date():
        raise ValueError("Data de recebimento incompatível com a coleta.")
    return filing


def bank_accounts(archive: ZipFile, year: int, filings: dict[str, CsvRow]):
    reference, opening, start = f"{year}-12-31", f"{year - 1}-12-31", f"{year}-01-01"
    rows: dict[str, dict[str, list[CsvRow]]] = {code: {} for code in filings}
    for statement in ("DRE", "BPP"):
        for row in csv_rows(archive, f"dfp_cia_aberta_{statement}_con_{year}.csv"):
            code = row["CD_CVM"]
            filing = filings.get(code)
            if filing is None or not same_filing(row, filing):
                continue
            spec = ACCOUNT_KEYS[code].get((statement, row["CD_CONTA"]))
            if spec is None:
                continue

            period = (row["ORDEM_EXERC"], row["DT_FIM_EXERC"])
            if statement == "DRE":
                if period != ("ÚLTIMO", reference) or row["DT_INI_EXERC"] != start:
                    continue
                key = spec.key
            elif period == ("ÚLTIMO", reference):
                key = rename_position("closing", spec.key)
            elif period == ("PENÚLTIMO", opening):
                key = rename_position("opening", spec.key)
            else:
                continue
            rows[code].setdefault(key, []).append(row)
    return rows


def same_filing(row: CsvRow, filing: CsvRow) -> bool:
    return all(row[key] == filing[key] for key in ("CNPJ_CIA", "DT_REFER", "VERSAO"))


def record(key: str, statement: str, row: CsvRow) -> Record:
    value, unit = normalize(row)
    return {
        "key": key,
        "label": row["DS_CONTA"].strip(),
        "statement": statement,
        "code": row["CD_CONTA"],
        "referenceDate": row["DT_FIM_EXERC"],
        "amountBrl": json_number(value),
    }, value, unit


def checked_inputs(code: str, rows: dict[str, list[CsvRow]]) -> dict[str, Record]:
    records = {}
    for spec in ACCOUNT_MAPS[code]:
        keys = (spec.key,) if spec.statement == "DRE" else (
            rename_position("opening", spec.key), rename_position("closing", spec.key),
        )
        for key in keys:
            candidates = rows.get(key, [])
            if len(candidates) != 1:
                raise ValueError(f"Conta ausente ou duplicada em {spec.statement} {spec.code} ({key}).")
            row = candidates[0]
            if row["DS_CONTA"].strip().casefold() not in {label.casefold() for label in spec.labels}:
                raise ValueError(f"Classificação divergente em {spec.statement} {spec.code}.")
            records[key] = record(key, spec.statement, row)
    return records


def reconciled(total: Record, *parts: Record) -> bool:
    # Metade da precisão de apresentação de cada valor do somatório.
    tolerance = (total[2] + sum(part[2] for part in parts)) / 2
    return abs(total[1] - sum(part[1] for part in parts)) <= tolerance


def santander_income_evidence(
    archive: ZipFile, filing: CsvRow, inputs: dict[str, Record]
) -> Record:
    if (
        filing["CD_CVM"], filing["DT_REFER"], filing["VERSAO"], filing["ID_DOC"],
        inputs["income"][1], inputs["parentIncome"][1], inputs["minorityIncome"][1],
    ) != ("020532", "2022-12-31", "2", "123805", 14_339_475_000, 14_287_093_000, 52_328_000):
        raise ValueError("Lucro consolidado diverge da atribuição aos acionistas.")

    # A DMPL estruturada tem cabeçalhos deslocados neste DFP. A página 12 do IFRS
    # auditado identifica estes três valores, que também constam da DMPL na página 16.
    columns = {
        "Outros Resultados Abrangentes": ("parentIncomeDmpl", Decimal(14_287_093_000)),
        "Patrimônio Líquido Consolidado": ("minorityIncomeDmpl", Decimal(52_382_000)),
        "": ("incomeDmpl", Decimal(14_339_475_000)),
    }
    evidence: dict[str, Record] = {}
    for row in csv_rows(archive, "dfp_cia_aberta_DMPL_con_2022.csv"):
        if (
            row["CD_CVM"] != filing["CD_CVM"]
            or not same_filing(row, filing)
            or (row["ORDEM_EXERC"], row["DT_INI_EXERC"], row["DT_FIM_EXERC"])
            != ("ÚLTIMO", "2022-01-01", "2022-12-31")
            or row["CD_CONTA"] != "5.05.01.02"
            or row["DS_CONTA"].strip().casefold() != "lucro líquido atribuível à controladora"
            or row["COLUNA_DF"] not in columns
        ):
            continue
        key, expected = columns[row["COLUNA_DF"]]
        candidate = record(key, "DMPL", row)
        if key in evidence or candidate[1] != expected:
            raise ValueError("A DMPL de 2022 diverge da conferência do demonstrativo auditado.")
        evidence[key] = candidate
    if len(evidence) != len(columns) or not reconciled(
        evidence["incomeDmpl"], evidence["parentIncomeDmpl"], evidence["minorityIncomeDmpl"]
    ):
        raise ValueError("Conciliação com a DMPL de 2022 incompleta.")
    minority = evidence["minorityIncomeDmpl"]
    minority[0]["label"] = "Parcela dos não controladores identificada na DMPL"
    return minority


def parent_equity(code: str, inputs: dict[str, Record], position: str) -> Decimal:
    equity, minority = (inputs[rename_position(position, key)] for key in ("equity", "minorityEquity"))
    parent_keys = ITAU_COMPONENT_KEYS if code == BANK else ("parentEquity",)
    parts = tuple(inputs[rename_position(position, key)] for key in parent_keys)
    if not reconciled(equity, minority, *parts):
        label = "abertura" if position == "opening" else "encerramento"
        raise ValueError(f"Patrimônio consolidado de {label} diverge da atribuição aos acionistas.")
    return equity[1] - minority[1] if code == BANK else parts[0][1]


def bank_observation(
    archive: ZipFile,
    year: int,
    checksum: str,
    collected: datetime,
    filing: CsvRow,
    rows: dict[str, list[CsvRow]],
) -> tuple[QualityPoint, dict]:
    code = filing["CD_CVM"]
    inputs = checked_inputs(code, rows)
    evidence = None
    if not reconciled(inputs["income"], inputs["parentIncome"], inputs["minorityIncome"]):
        evidence = santander_income_evidence(archive, filing, inputs)
        inputs[evidence[0]["key"]] = evidence

    opening = parent_equity(code, inputs, "opening")
    closing = parent_equity(code, inputs, "closing")
    result = calculate_roe(net_income=inputs["parentIncome"][1], equity_open=opening, equity_close=closing)
    if result.value is None or result.quality_status != "validated":
        raise ValueError(" ".join(result.reasons) or "ROE indisponível.")
    reasons = list(result.reasons)
    observation = {
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
            "referenceDate": filing["DT_REFER"],
            "publishedAt": None,
            "retrievedAt": collected.isoformat(timespec="seconds"),
            "methodologyVersion": METHODOLOGY,
            "qualityStatus": result.quality_status,
        },
        "reasons": reasons,
        "inputs": [inputs[key][0] for key in sorted(inputs)],
    }
    if evidence is not None:
        observation["supportingDocumentUrl"] = SANTANDER_IFRS_2022
        reasons.append(
            "A parcela dos não controladores na DRE estruturada diverge em R$ 54 mil. "
            "A conciliação usa R$ 52.382.000, valor confirmado na DMPL do mesmo DFP e no "
            "demonstrativo IFRS auditado. O lucro da controladora coincide nos registros."
        )
        reasons.append(
            "Na DMPL estruturada, a conta 5.05.01.02 aparece com o rótulo “Lucro líquido "
            "Atribuível à Controladora” e a coluna “Patrimônio Líquido Consolidado”. "
            "O demonstrativo auditado identifica o valor como parcela dos não controladores."
        )
    return QualityPoint(year, result.value), observation


def create_bank_roe_snapshot(archives: dict[int, Path]) -> dict:
    years = sorted(archives)
    if len(years) < 5 or years != list(range(years[0], years[-1] + 1)):
        raise ValueError("Informe ao menos cinco exercícios anuais consecutivos.")
    bank_series: dict[str, list[tuple[QualityPoint, dict]]] = {code: [] for code in BANKS}
    errors: dict[str, list[str]] = {code: [] for code in BANKS}
    for year in years:
        reference = f"{year}-12-31"
        with read_archive(archives[year]) as (archive, checksum, collected):
            filings = {}
            for code, candidates in bank_filings(archive, year, reference).items():
                try:
                    filings[code] = latest_filing(candidates, code, reference, collected)
                except ValueError as error:
                    errors[code].append(f"Exercício de {year}. {error}")
            rows = bank_accounts(archive, year, filings)
            for code, filing in filings.items():
                try:
                    point, observation = bank_observation(archive, year, checksum, collected, filing, rows[code])
                    bank_series[code].append((point, observation))
                except (DecimalException, ValueError) as error:
                    errors[code].append(f"Exercício de {year}. {error}")

    included = []
    excluded = []
    means: dict[str, Decimal] = {}
    for code, (name, _) in BANKS.items():
        company_id = f"cvm:{int(code)}"
        if errors[code]:
            excluded.append({"companyId": company_id, "name": name, "reason": " ".join(errors[code])})
            continue
        series = bank_series[code]
        summary = summarize_quality(point for point, _ in series)
        if summary.mean is None or summary.valid_years != len(years):
            raise ValueError(f"Série incompleta para CVM {int(code)}.")
        means[company_id] = summary.mean
        previous = None
        observations = []
        for point, observation in series:
            if previous is not None and previous != observation["openingCapitalBrl"]:
                observation["reasons"].append(
                    "O patrimônio de abertura informado neste DFP difere do encerramento "
                    "publicado no DFP do exercício anterior."
                )
            previous = observation["closingCapitalBrl"]
            observation["changePp"] = json_number(summary.annual_deltas_pp[point.fiscal_year])
            observations.append(observation)
        included.append({
            "companyId": company_id,
            "name": name,
            "category": "bank",
            "metric": "roe",
            "observations": observations,
            "summary": {
                "validYears": summary.valid_years,
                "mean": json_number(summary.mean),
                "median": json_number(summary.median),
                "populationStddev": json_number(summary.population_stddev),
                "amplitude": json_number(summary.amplitude),
                "trendPpPerYear": json_number(summary.trend_pp_per_year),
            },
        })
    if not included:
        raise ValueError("Nenhum banco foi validado. " + " ".join(item["reason"] for item in excluded))
    percentiles = return_percentiles(means)
    return {
        "manifest": {
            "schemaVersion": "1.0.0",
            "generatedAt": datetime.now(UTC).isoformat(timespec="seconds"),
            "asOf": f"{years[-1]}-12-31",
            "coverage": {"eligibleCompanies": None, "includedCompanies": len(included)},
            "source": SOURCE,
        },
        "methodologyVersion": METHODOLOGY,
        "minimumPeers": MINIMUM_PEERS,
        "comparison": {
            "period": {"startYear": years[0], "endYear": years[-1]},
            "percentiles": (
                {key: json_number(value) for key, value in percentiles.items()}
                if percentiles is not None else None
            ),
        },
        "companies": included,
        "excluded": excluded,
    }
