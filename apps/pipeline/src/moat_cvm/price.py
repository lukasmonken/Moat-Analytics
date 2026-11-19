"""Extrai NOPAT e lucro da controladora de doze meses para a amostra."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from zipfile import ZipFile

from .archives import csv_rows, read_archive
from .dfp import ORIGIN as DFP_ORIGIN
from .dfp import SOURCE as DFP_SOURCE
from .dfp import CsvRow, amount, normalize
from .quality import ACCOUNTS, BANK, ROIC_TAX, reconcile_income
from .sample import COMPANIES

ITR_ORIGIN = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/"
ITR_SOURCE = {**DFP_SOURCE, "datasetUrl": "https://dados.cvm.gov.br/dataset/cia_aberta-doc-itr"}
METHODOLOGY = "price-fundamentals.v1"
QUARTER_ENDS = {(3, 31), (6, 30), (9, 30)}


def select_income_filings(
    archive: ZipFile, form: str, reference: date
) -> dict[str, list[CsvRow]]:
    candidates: dict[str, list[CsvRow]] = {code: [] for code in COMPANIES}
    for row in csv_rows(archive, f"{form.lower()}_cia_aberta_{reference.year}.csv"):
        code = row["CD_CVM"]
        if code in COMPANIES and row["DT_REFER"] == reference.isoformat():
            candidates[code].append(row)
    return candidates


def latest_income_filing(
    candidates: list[CsvRow], form: str, reference: date, collected: datetime
) -> CsvRow:
    if not candidates:
        raise ValueError(f"{form} indisponível em {reference.isoformat()}.")
    version = max(int(filing["VERSAO"]) for filing in candidates)
    latest = [filing for filing in candidates if int(filing["VERSAO"]) == version]
    filing = latest[0]
    if version < 1 or any(row != filing for row in latest):
        raise ValueError(f"Versão inválida ou metadados divergentes no {form}.")
    if filing["CATEG_DOC"] != form:
        raise ValueError(f"Categoria incompatível no {form}.")
    received = date.fromisoformat(filing["DT_RECEB"])
    if not reference <= received <= collected.date():
        raise ValueError(f"Data de recebimento incompatível no {form}.")
    return filing


def income_rows(
    archive: ZipFile,
    form: str,
    reference: date,
    filings: dict[str, CsvRow],
    periods: dict[str, tuple[str, str, str]],
) -> dict[str, dict[str, list[CsvRow]]]:
    matches: dict[str, dict[str, list[CsvRow]]] = {
        code: {role: [] for role in periods} for code in filings
    }
    roles = {period: role for role, period in periods.items()}
    member = f"{form.lower()}_cia_aberta_DRE_con_{reference.year}.csv"
    for row in csv_rows(archive, member):
        code = row["CD_CVM"]
        filing = filings.get(code)
        if not filing or any(row[key] != filing[key] for key in ("CNPJ_CIA", "DT_REFER", "VERSAO")):
            continue
        role = roles.get((row["ORDEM_EXERC"], row["DT_INI_EXERC"], row["DT_FIM_EXERC"]))
        if role:
            matches[code][role].append(row)
    return matches


def reconciled_income(code: str, period_end: str, rows: list[CsvRow]) -> tuple[CsvRow, Decimal]:
    mapping = {spec.code: spec for spec in ACCOUNTS[code] if spec.statement == "DRE"}
    inputs = {}
    for row in rows:
        spec = mapping.get(row["CD_CONTA"])
        if spec is None:
            continue
        if spec.key in inputs:
            raise ValueError(f"Conta {spec.code} duplicada em {period_end}.")
        if row["DS_CONTA"].strip().casefold() not in {label.casefold() for label in spec.labels}:
            raise ValueError(f"Classificação contábil não revisada para {spec.code} em {period_end}.")
        value, unit = normalize(row)
        inputs[spec.key] = (row, value, unit)
    missing = mapping.keys() - {row["CD_CONTA"] for row, _, _ in inputs.values()}
    if missing:
        raise ValueError(f"Faltam as contas da DRE {', '.join(sorted(missing))} em {period_end}.")
    reconcile_income(code, inputs, int(period_end[:4]))
    row, value, _ = inputs["parentIncome" if code == BANK else "ebit"]
    return row, value


def read_income(
    path: Path,
    form: str,
    reference: date,
    periods: dict[str, tuple[str, str, str]],
) -> tuple[dict[str, dict], dict[str, str]]:
    origin = DFP_ORIGIN if form == "DFP" else ITR_ORIGIN
    archive_url = f"{origin}{path.name}"
    validated = {}
    issues = {}
    with read_archive(path) as (archive, checksum, collected):
        filings = {}
        for code, candidates in select_income_filings(archive, form, reference).items():
            try:
                filings[code] = latest_income_filing(candidates, form, reference, collected)
            except ValueError as error:
                issues[code] = str(error)

        matches = income_rows(archive, form, reference, filings, periods)
        retrieved_at = collected.isoformat(timespec="seconds")
        for code, filing in filings.items():
            try:
                document_url = filing["LINK_DOC"].replace(
                    "http://www.rad.cvm.gov.br/", "https://www.rad.cvm.gov.br/", 1
                )
                if not document_url.startswith("https://www.rad.cvm.gov.br/"):
                    raise ValueError(f"Endereço do documento incompatível no {form}.")
                values = {}
                inputs = []
                for role, (_, start, end) in periods.items():
                    row, value = reconciled_income(code, end, matches[code][role])
                    values[role] = value
                    inputs.append({
                        "role": role,
                        "accountCode": row["CD_CONTA"],
                        "accountLabel": row["DS_CONTA"].strip(),
                        "periodStart": start,
                        "periodEnd": end,
                        "amountBrl": amount(value),
                        "filingVersion": int(filing["VERSAO"]),
                        "receiptDate": filing["DT_RECEB"],
                        "documentUrl": document_url,
                        "archiveUrl": archive_url,
                        "archiveSha256": checksum,
                        "retrievedAt": retrieved_at,
                    })
                validated[code] = {
                    "cnpj": filing["CNPJ_CIA"],
                    "name": filing["DENOM_CIA"],
                    "values": values,
                    "inputs": inputs,
                }
            except ValueError as error:
                issues[code] = str(error)
    return validated, issues


def create_price_fundamentals_snapshot(
    dfp_archive: Path, itr_archive: Path, reference: date
) -> dict:
    if (reference.month, reference.day) not in QUARTER_ENDS:
        raise ValueError("A data do ITR deve encerrar um dos três primeiros trimestres.")
    prior_cutoff = reference.replace(year=reference.year - 1)
    annual_end = date(prior_cutoff.year, 12, 31)
    prior_start = date(prior_cutoff.year, 1, 1).isoformat()
    current_start = date(reference.year, 1, 1).isoformat()
    annual, annual_issues = read_income(
        dfp_archive, "DFP", annual_end, {"annual": ("ÚLTIMO", prior_start, annual_end.isoformat())}
    )
    interim, interim_issues = read_income(
        itr_archive,
        "ITR",
        reference,
        {
            "currentYtd": ("ÚLTIMO", current_start, reference.isoformat()),
            "priorYtd": ("PENÚLTIMO", prior_start, prior_cutoff.isoformat()),
        },
    )

    companies = []
    issues = []
    for code, category in COMPANIES.items():
        company_id = f"cvm:{int(code)}"
        annual_data, interim_data = annual.get(code), interim.get(code)
        problem = " ".join(filter(None, [annual_issues.get(code), interim_issues.get(code)]))
        if annual_data is None or interim_data is None:
            issues.append({"companyId": company_id, "message": problem})
            continue
        if annual_data["cnpj"] != interim_data["cnpj"]:
            issues.append({"companyId": company_id, "message": "O CNPJ diverge entre DFP e ITR."})
            continue
        inputs = [*annual_data["inputs"], *interim_data["inputs"]]
        annual_income = annual_data["values"]["annual"]
        ytd, prior_ytd = (interim_data["values"][role] for role in ("currentYtd", "priorYtd"))
        income_ttm = annual_income + ytd - prior_ytd
        if abs(income_ttm) >= 2**53:
            issues.append({"companyId": company_id, "message": "Resultado TTM fora da faixa suportada."})
            continue
        tax_rate = None if code == BANK else ROIC_TAX
        numerator = income_ttm if tax_rate is None else income_ttm * (1 - tax_rate)
        companies.append({
            "companyId": company_id,
            "name": interim_data["name"],
            "category": category,
            "metric": "parentNetIncome" if code == BANK else "nopat",
            "periodStart": (prior_cutoff + timedelta(days=1)).isoformat(),
            "periodEnd": reference.isoformat(),
            "amountBrl": amount(numerator),
            "incomeTtmBrl": amount(income_ttm),
            "taxRate": amount(tax_rate) if tax_rate is not None else None,
            "provenance": {
                "source": "CVM · DFP anual e ITR consolidados",
                "referenceDate": reference.isoformat(),
                "publishedAt": None,
                "retrievedAt": max(row["retrievedAt"] for row in inputs),
                "methodologyVersion": METHODOLOGY,
                "qualityStatus": "validated" if code == BANK else "estimated",
            },
            "inputs": inputs,
        })
    if not companies:
        reasons = " ".join(issue["message"] for issue in issues)
        raise ValueError(f"Nenhum resultado TTM validado. {reasons}")

    return {
        "manifest": {
            "schemaVersion": "1.0.0",
            "generatedAt": datetime.now(UTC).isoformat(timespec="seconds"),
            "asOf": reference.isoformat(),
            "coverage": {"eligibleCompanies": len(COMPANIES), "includedCompanies": len(companies)},
            "sources": [DFP_SOURCE, ITR_SOURCE],
        },
        "companies": companies,
        "issues": issues,
    }
