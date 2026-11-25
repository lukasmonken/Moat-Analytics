"""Saldos de arrendamentos e financiamentos conferidos em notas auditadas."""

from typing import NamedTuple


class LeaseBalances(NamedTuple):
    short_borrowings_brl: int
    long_borrowings_brl: int
    leases_brl: int


class LiabilityBalance(NamedTuple):
    code: str
    label: str
    opening_brl: int
    closing_brl: int


class LeaseReview(NamedTuple):
    note: str
    url: str
    opening: LeaseBalances
    closing: LeaseBalances
    separate_liabilities: tuple[LiabilityBalance, ...] = ()


class ReviewedSubtotal(NamedTuple):
    balance: LiabilityBalance
    zero_children: tuple[str, ...]


class SubtotalReview(NamedTuple):
    url: str
    accounts: tuple[ReviewedSubtotal, ...]


TUPY_DFP = (
    "https://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx"
    "?CodigoInstituicao=1&NumeroSequencialDocumento=155493"
)
ENGIE_NOTES = "https://www.engie.com.br/wp-content/uploads/2026/02/260225-Release-de-Resultados-4T25.pdf"

# A DFP individual da Sanepar informa que a companhia não tem subsidiárias.
INDIVIDUAL_FILINGS = {
    ("018627", "2025-12-31", "154938", "1"): "https://ri.sanepar.com.br/docs/DFP-Sanepar-2025-12-31-BjdwmKcn.pdf",
}

LEASE_REVIEWS = {
    # A nota 17 apresenta o total de arrendamentos por moeda, dentro do financiamento.
    # Os subtotais da DFP incluem também as debêntures da nota 17.
    ("006343", "2025-12-31", "155493", "1"): LeaseReview(
        "17", TUPY_DFP,
        LeaseBalances(638_123_000, 4_132_189_000, 56_734_000),
        LeaseBalances(212_756_000, 3_881_960_000, 39_142_000),
    ),
    # A nota 14 separa os arrendamentos dos empréstimos da nota 15.
    # No BPP da DFP os arrendamentos fazem parte de outras obrigações.
    ("011932", "2025-12-31", "154907", "1"): LeaseReview(
        "14", "https://api.mziq.com/mzfilemanager/v2/d/aa331a3b-0a4a-4acc-a70e-512ff88e3c02/"
        "b12fda81-2659-40c5-b3af-864331bb8306?origin=2",
        LeaseBalances(614_709_000, 5_774_050_000, 103_258_000),
        LeaseBalances(356_196_000, 5_275_350_000, 115_932_000),
        (
            LiabilityBalance("2.01.05.02.05", "Outras obrigações", 540_808_000, 427_993_000),
            LiabilityBalance("2.02.02.02.03", "Outras Contas a Pagar", 194_328_000, 243_662_000),
        ),
    ),
    # ENGIE, nota 12(a). A divulgação auditada e o anexo de resultados
    # separam os arrendamentos dos grupos agregados no BPP da DFP.
    ("017329", "2025-12-31", "155137", "2"): LeaseReview(
        "12", ENGIE_NOTES,
        LeaseBalances(2_610_790_000, 21_036_859_000, 353_997_000),
        LeaseBalances(2_941_959_000, 25_717_397_000, 430_452_000),
        (
            LiabilityBalance("2.01.02", "Fornecedores", 1_099_881_000, 965_883_000),
            LiabilityBalance("2.02.02.02.06", "Outros passivos não circulantes", 1_115_749_000, 991_554_000),
        ),
    ),
    # Hypera, nota 23(i). O balanço por prazo e a movimentação confirmam
    # R$ 178.857 mil no encerramento dentro de outros passivos.
    ("021431", "2025-12-31", "155321", "1"): LeaseReview(
        "23", "https://s3.glbimg.com/v1/AUTH_63b422c2caee4269b8b34177e8876b93/"
        "valorri-uploads/bs/2026/5/e/UXkrknS4Sp23N0L6P8Bw/hypera1588156716032026.pdf",
        LeaseBalances(1_393_636_000, 7_986_405_000, 207_665_000),
        LeaseBalances(1_311_422_000, 8_000_041_000, 178_857_000),
        (
            LiabilityBalance("2.01.05.02.05", "Outros Passivos", 409_688_000, 432_385_000),
            LiabilityBalance("2.02.02.02.07", "Outros Passivos", 184_070_000, 173_264_000),
        ),
    ),
    ("021610", "2025-12-31", "154935", "1"): LeaseReview(
        "9", "https://vipfiles.valor.com.br/BDEmpresas/bfc245c3-7342-4b02-a2ff-96206f033415.pdf",
        LeaseBalances(1_947_492_000, 11_281_327_000, 33_715_000),
        LeaseBalances(870_588_000, 14_073_716_000, 30_563_000),
    ),
    # Os saldos analíticos de arrendamento da nota 23 são publicados em milhões.
    # O cálculo usa os subtotais exatos da DFP, que já incluem esses arrendamentos.
    ("023264", "2025-12-31", "154733", "1"): LeaseReview(
        "23", "https://www.sec.gov/Archives/edgar/data/1565025/000129281426000640/abevform20f_2025.htm",
        LeaseBalances(1_276_391_000, 2_176_337_000, 2_965_100_000),
        LeaseBalances(1_167_325_000, 2_219_599_000, 2_975_700_000),
    ),
}


SUBTOTAL_REVIEWS = {
    # ENGIE, nota 12(a). Fornecedores e arrendamentos circulantes somam
    # o subtotal 2.01.02. As duas subcontas da DFP estão zeradas.
    ("017329", "2025-12-31", "155137", "2"): SubtotalReview(
        ENGIE_NOTES,
        (ReviewedSubtotal(
            LiabilityBalance("2.01.02", "Fornecedores", 1_099_881_000, 965_883_000),
            ("2.01.02.01", "2.01.02.02"),
        ),),
    ),
    # Orizon, nota 13.1. Os subtotais consolidados do BPP estão preenchidos
    # na DFP, mas todas as subcontas padronizadas dos financiamentos estão zeradas.
    ("025550", "2025-12-31", "155710", "1"): SubtotalReview(
        "https://s3.glbimg.com/v1/AUTH_63b422c2caee4269b8b34177e8876b93/"
        "valorri-uploads/bs/2026/B/J/FM69NZR6q0cYQrnkrlfQ/orizon1588484430032026.pdf",
        (
            ReviewedSubtotal(
                LiabilityBalance("2.01.04", "Empréstimos e Financiamentos", 140_957_000, 178_483_000),
                ("2.01.04.01", "2.01.04.02", "2.01.04.03"),
            ),
            ReviewedSubtotal(
                LiabilityBalance("2.02.01", "Empréstimos e Financiamentos", 1_726_341_000, 1_943_929_000),
                ("2.02.01.01", "2.02.01.02", "2.02.01.03"),
            ),
        ),
    ),
}
