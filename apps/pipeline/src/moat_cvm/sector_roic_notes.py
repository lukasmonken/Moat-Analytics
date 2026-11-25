"""Classificações de passivos conferidas nas notas auditadas dos emissores."""

from typing import NamedTuple


class ReviewedAccount(NamedTuple):
    code: str
    label: str
    opening_brl: int
    closing_brl: int
    financing: bool = True


class FilingReview(NamedTuple):
    url: str
    accounts: tuple[ReviewedAccount, ...]


ACQUISITION_LABEL = "Compromissos com Aquisição de Ativos"
RENNER_SUPPLIER_LABEL = "Obrigações - Risco Sacado"

REVIEWS = {
    # Lojas Renner, notas de fornecedores e risco sacado. O prazo padrão de
    # pagamento é mantido e a antecipação é contratada pelos fornecedores.
    ("008133", "2022-12-31", "123581", "1"): FilingReview(
        "https://api.mziq.com/mzfilemanager/v2/d/13154776-9416-4fce-8c46-3e54d45b03a3/"
        "ab35e3d8-9c71-18a0-3899-fb6c0dbb0f6e?origin=1",
        (ReviewedAccount("2.01.02.01.02", RENNER_SUPPLIER_LABEL, 54_744_000, 78_848_000, False),),
    ),
    ("008133", "2023-12-31", "134755", "1"): FilingReview(
        "https://api.mziq.com/mzfilemanager/v2/d/13154776-9416-4fce-8c46-3e54d45b03a3/"
        "5e18112e-7212-0d7a-a125-9d0678a7450d?origin=1",
        (ReviewedAccount("2.01.02.01.02", RENNER_SUPPLIER_LABEL, 78_848_000, 0, False),),
    ),
    ("008133", "2025-12-31", "155117", "2"): FilingReview(
        # A nota 19 do ITR seguinte também identifica esse saldo de 31/12/2025.
        "https://api.mziq.com/mzfilemanager/v2/d/13154776-9416-4fce-8c46-3e54d45b03a3/"
        "a57e8c82-5758-3c68-1e8d-231b06f46348?origin=2",
        (ReviewedAccount("2.01.02.01.02", RENNER_SUPPLIER_LABEL, 0, 41_156_000, False),),
    ),
    # Suzano, nota 23. As DFPs de 2022 e de 2023 têm parcelas contratuais
    # adicionais que ainda exigem revisão para esta classificação.
    ("013986", "2021-12-31", "111671", "1"): FilingReview(
        "https://www.sec.gov/Archives/edgar/data/909327/000110465922053794/suz-20211231x20f.htm",
        (
            ReviewedAccount("2.01.05.02.06", ACQUISITION_LABEL, 101_515_000, 99_040_000),
            ReviewedAccount("2.02.02.02.05", ACQUISITION_LABEL, 400_713_000, 306_912_000),
        ),
    ),
    ("013986", "2024-12-31", "144744", "1"): FilingReview(
        "https://www.sec.gov/Archives/edgar/data/909327/000162828025020368/suz-20241231.htm",
        (
            ReviewedAccount("2.01.05.02.06", ACQUISITION_LABEL, 93_405_000, 21_166_000),
            ReviewedAccount("2.02.02.02.05", ACQUISITION_LABEL, 93_782_000, 99_324_000),
        ),
    ),
    ("013986", "2025-12-31", "154674", "1"): FilingReview(
        "https://www.sec.gov/Archives/edgar/data/909327/000090932726000022/suz-20251231.htm",
        (
            ReviewedAccount("2.01.05.02.06", ACQUISITION_LABEL, 21_166_000, 17_719_000),
            ReviewedAccount("2.02.02.02.05", ACQUISITION_LABEL, 99_324_000, 77_121_000),
        ),
    ),
    # Klabin, nota 17.1. O prazo e o custo do risco sacado comum permanecem
    # com o fornecedor. Os adiantamentos florestais têm despesa financeira.
    ("012653", "2025-12-31", "154693", "1"): FilingReview(
        "https://api.mziq.com/mzfilemanager/v2/d/1c41fa99-efe7-4e72-81dd-5b571f5aa376/"
        "fcad7df5-9607-78ed-3455-ffa6e0470211?origin=2",
        (
            ReviewedAccount("2.01.02.01.02", "Fornecedor risco sacado", 601_448_000, 658_466_000, False),
            ReviewedAccount("2.01.02.01.03", "Fornecedor risco sacado florestal", 236_661_000, 1_118_187_000),
            ReviewedAccount("2.02.02.02.10", "Fornecedor risco sacado florestal", 588_901_000, 233_784_000),
        ),
    ),
}
