"""Revisões de rubricas oficiais da DFC com evidência nas notas da DFP."""

import re
from decimal import Decimal, DecimalException

from .dfp import CsvRow, normalize

CYRELA_REFERENCE = "2025-12-31"
CYRELA_FILING = (
    "https://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx?"
    "CodigoInstituicao=1&NumeroSequencialDocumento=155491"
)
CYRELA_REVIEW = (
    "https://api.mziq.com/mzfilemanager/v2/d/d7617e78-1c42-4341-83ae-a1faa8569ca8/"
    "94fc56d7-8c92-79a5-4365-560e5f1accd1?origin=2"
)
CYRELA_DEPRECIATION_CODE = "6.01.01.01"
CYRELA_DFC_ACCOUNTS = {
    CYRELA_DEPRECIATION_CODE: ("Depreciação de Bens do Ativo Imobilizado", 79_338_000),
    "6.01.01.02": ("Amortização de Mais Valia de Ativos", 53_237_000),
}
OTHER_DEPRECIATION = re.compile(
    r"\b(?:deprec|amorti|amoti|exaus|deple|arrenda|impair|desvalori|"
    r"direitos? de uso|mais[- ]valia|d\s*&\s*a)",
    re.IGNORECASE,
)


def review_cyrela_depreciation(
    issuer: str, filing: dict, rows: list[tuple[str, CsvRow]],
) -> tuple[Decimal, dict] | None:
    # Nota 9: a mais-valia da segunda rubrica está alocada a imóveis a comercializar.
    # A primeira rubrica concilia o imobilizado e os demais intangíveis das notas 8 e 9.
    if (
        issuer != "014460"
        or filing.get("referenceDate") != CYRELA_REFERENCE
        or filing.get("receivedAt") != "2026-03-19"
        or filing.get("version") != 1
        or filing.get("filingUrl") != CYRELA_FILING
        or filing.get("basis") is not None
    ):
        return None

    matched: dict[str, tuple[str, Decimal]] = {}
    try:
        for statement, row in rows:
            if (
                statement != "DFC_MI"
                or row.get("CD_CVM") != issuer
                or row.get("CNPJ_CIA") != "73.178.600/0001-18"
                or row.get("GRUPO_DFP") != "DF Consolidado - Demonstração do Fluxo de Caixa (Método Indireto)"
                or row.get("VERSAO") != "1"
                or row.get("DT_REFER") != CYRELA_REFERENCE
                or row.get("ORDEM_EXERC") != "ÚLTIMO"
                or row.get("DT_INI_EXERC") != "2025-01-01"
                or row.get("DT_FIM_EXERC") != CYRELA_REFERENCE
            ):
                return None
            code, label = row["CD_CONTA"], row["DS_CONTA"].strip()
            if code in CYRELA_DFC_ACCOUNTS:
                value, _ = normalize(row)
                if code in matched or (label, value) != CYRELA_DFC_ACCOUNTS[code]:
                    return None
                matched[code] = label, value
            elif OTHER_DEPRECIATION.search(label) and normalize(row)[0] != 0:
                return None
    except (DecimalException, KeyError, ValueError):
        return None

    if matched.keys() != CYRELA_DFC_ACCOUNTS.keys():
        return None
    label, value = matched[CYRELA_DEPRECIATION_CODE]
    return value, {
        "depreciationAccount": {
            "statement": "DFC_MI",
            "code": CYRELA_DEPRECIATION_CODE,
            "label": label,
            "referenceDate": CYRELA_REFERENCE,
        },
        "depreciationReview": {
            "documentUrl": CYRELA_REVIEW,
            "page": 67,
            "accountCode": CYRELA_DEPRECIATION_CODE,
        },
    }
