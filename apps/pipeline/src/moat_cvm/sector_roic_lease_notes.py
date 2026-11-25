"""Arrendamentos já incluídos nos financiamentos, conferidos em nota auditada."""

from typing import NamedTuple


class LeaseBalances(NamedTuple):
    short_borrowings_brl: int
    long_borrowings_brl: int
    leases_brl: int


class LeaseReview(NamedTuple):
    note: str
    url: str
    opening: LeaseBalances
    closing: LeaseBalances


TUPY_DFP = (
    "https://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx"
    "?CodigoInstituicao=1&NumeroSequencialDocumento=155493"
)

EMBEDDED_LEASE_REVIEWS = {
    # A nota 17 apresenta o total de arrendamentos por moeda, dentro do financiamento.
    # Os subtotais da DFP incluem também as debêntures da nota 17.
    ("006343", "2025-12-31", "155493", "1"): LeaseReview(
        "17", TUPY_DFP,
        LeaseBalances(638_123_000, 4_132_189_000, 56_734_000),
        LeaseBalances(212_756_000, 3_881_960_000, 39_142_000),
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
