"""Reconcilia quantidades exatas de ações por classe com a composição do capital do ITR."""

from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Literal

from .archives import csv_rows, read_archive
from .price_filings import ITR_ORIGIN, latest_income_filing, select_income_filings
from .sample import COMPANIES


@dataclass(frozen=True)
class ShareClass:
    ticker: str
    kind: Literal["ON", "PN"]
    issued: int
    treasury: int


@dataclass(frozen=True)
class ReviewedComposition:
    cnpj: str
    document_id: str
    filing_version: str
    reported_unit: Literal[1, 1000]
    evidence_url: str
    classes: tuple[ShareClass, ...]


REVIEWED_DATE = date(2026, 9, 30)

# O CSV da CVM omite a escala da composição do capital. Cada revisão fixa
# a versão, a escala do ITR original e as quantidades confirmadas no documento.
# Os tickers ON/PN são os mesmos já validados no FCA de 2026.
REVIEWED_COMPOSITIONS = {
    "005410": ReviewedComposition(
        cnpj="84.429.695/0001-11",
        document_id="161774",
        filing_version="1",
        reported_unit=1,
        # Apresentação para investidores da WEG, página 19.
        evidence_url=(
            "https://api.mziq.com/mzfilemanager/v2/d/50c1bd3e-8ac6-42d9-884f-b9d69f690602/"
            "9bedd535-f9e4-4e23-0d8e-90c7c0ba56ac?origin=2"
        ),
        classes=(ShareClass("WEGE3", "ON", 4_197_317_998, 1_488_307),),
    ),
    "019348": ReviewedComposition(
        cnpj="60.872.504/0001-23",
        document_id="161944",
        filing_version="1",
        reported_unit=1000,
        # Demonstrações IFRS do Itaú Unibanco no formulário 6-K, Nota 19.
        evidence_url=(
            "https://www.sec.gov/Archives/edgar/data/1132597/000113259726000279/"
            "condensedconsolidatedfin.htm"
        ),
        classes=(
            ShareClass("ITUB3", "ON", 5_617_742_977, 0),
            ShareClass("ITUB4", "PN", 5_409_126_215, 4_843_290),
        ),
    ),
}
SHARE_FIELDS = {
    "ON": ("QT_ACAO_ORDIN_CAP_INTEGR", "QT_ACAO_ORDIN_TESOURO"),
    "PN": ("QT_ACAO_PREF_CAP_INTEGR", "QT_ACAO_PREF_TESOURO"),
    "total": ("QT_ACAO_TOTAL_CAP_INTEGR", "QT_ACAO_TOTAL_TESOURO"),
}


def check_share_fields(row: dict, reviewed: ReviewedComposition) -> None:
    for kind, (issued_field, treasury_field) in SHARE_FIELDS.items():
        classes = tuple(
            entry for entry in reviewed.classes if kind == "total" or entry.kind == kind
        )
        for field, exact in (
            (issued_field, sum(entry.issued for entry in classes)),
            (treasury_field, sum(entry.treasury for entry in classes)),
        ):
            # Para o campo publicado em mil ações, arredondar o número exato
            # do documento pela escala explícita e confrontar com o CSV.
            reported = (exact + reviewed.reported_unit // 2) // reviewed.reported_unit
            if int(row[field]) != reported:
                raise ValueError("A composição de capital do ITR diverge da quantidade revisada.")


def read_share_counts(
    itr_path: Path, reference: date
) -> tuple[dict[str, dict], dict[str, str]]:
    """Retorna posições na data-base do ITR, sem extrapolar para outro pregão."""
    if reference != REVIEWED_DATE:
        return {}, {
            f"cvm:{int(code)}": "A quantidade exata por classe aguarda validação nesta data-base."
            for code in COMPANIES
        }

    shares: dict[str, dict] = {}
    issues = {
        "cvm:8133": (
            "O ITR informa a quantidade de ações em milhares. "
            "A posição exata na mesma data-base ainda não foi confirmada."
        ),
    }
    reference_iso = reference.isoformat()
    member = f"itr_cia_aberta_composicao_capital_{reference.year}.csv"
    with read_archive(itr_path) as (archive, checksum, collected):
        if member not in archive.namelist():
            return {}, {
                f"cvm:{int(code)}": "O arquivo ITR não contém a composição do capital."
                for code in COMPANIES
            }
        filings = select_income_filings(archive, "ITR", reference)
        by_company = {reviewed.cnpj: [] for reviewed in REVIEWED_COMPOSITIONS.values()}
        for row in csv_rows(archive, member):
            cnpj = row["CNPJ_CIA"]
            if cnpj in by_company and row["DT_REFER"] == reference_iso:
                by_company[cnpj].append(row)

        for code, reviewed in REVIEWED_COMPOSITIONS.items():
            company_id = f"cvm:{int(code)}"
            try:
                filing = latest_income_filing(filings[code], "ITR", reference, collected)
                if (
                    filing["CNPJ_CIA"] != reviewed.cnpj
                    or filing["VERSAO"] != reviewed.filing_version
                    or filing["ID_DOC"] != reviewed.document_id
                ):
                    raise ValueError("A versão do ITR não corresponde à revisão dos números exatos.")
                rows = [row for row in by_company[reviewed.cnpj] if row["VERSAO"] == filing["VERSAO"]]
                if len(rows) != 1 or rows[0]["DENOM_CIA"] != filing["DENOM_CIA"]:
                    raise ValueError("A composição do capital do ITR está ausente ou ambígua.")
                check_share_fields(rows[0], reviewed)
            except (KeyError, ValueError) as error:
                issues[company_id] = str(error)
                continue

            shares[company_id] = {
                "referenceDate": reference_iso,
                "filingVersion": int(filing["VERSAO"]),
                "receiptDate": filing["DT_RECEB"],
                "documentUrl": (
                    "https://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx"
                    f"?CodigoInstituicao=1&NumeroSequencialDocumento={reviewed.document_id}"
                ),
                "archiveUrl": f"{ITR_ORIGIN}itr_cia_aberta_{reference.year}.zip",
                "archiveSha256": checksum,
                "retrievedAt": collected.isoformat(timespec="seconds"),
                "evidenceUrl": reviewed.evidence_url,
                "classes": [
                    {
                        "ticker": entry.ticker,
                        "kind": entry.kind,
                        "issued": entry.issued,
                        "treasury": entry.treasury,
                        "outstanding": entry.issued - entry.treasury,
                    }
                    for entry in reviewed.classes
                ],
            }

    return shares, issues
