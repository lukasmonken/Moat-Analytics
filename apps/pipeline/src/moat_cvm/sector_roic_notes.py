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
    # Ferbasa. A DFP registra o saldo da aquisição de BW Guirapá.
    # O informe seguinte confirma a quitação do principal e da atualização.
    ("003069", "2025-12-31", "155153", "1"): FilingReview(
        "https://filemanager-cdn.mziq.com/published/e71f73d4-4d0a-41fb-8e5b-8d7f3660b6ad/"
        "8ae66756-4990-4c23-93bc-ed92ade88e68",
        (ReviewedAccount("2.02.02.02.06", "Obrigações com aquisição de controlada", 4_978_000, 4_978_000),),
    ),
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
    # Tupy, nota 20. Os saldos dependem da realização de créditos fiscais
    # e do ressarcimento de CSLL pela vendedora da MWM.
    ("006343", "2025-12-31", "155493", "1"): FilingReview(
        "https://s3.glbimg.com/v1/AUTH_63b422c2caee4269b8b34177e8876b93/"
        "valorri-uploads/bs/2026/p/P/HKWA55Sxyc8CKT7gPtWg/tupy1588252920032026.pdf",
        (
            ReviewedAccount(
                "2.01.05.02.08", "Obrigações de Combinação de Negócios", 34_311_000, 19_485_000, False,
            ),
            ReviewedAccount(
                "2.02.02.02.07", "Obrigações de Combinação de Negócios", 19_384_000, 36_693_000, False,
            ),
        ),
    ),
    # MAHLE, nota 11. A controlada tem saldo a pagar em contrato remunerado
    # de gestão de disponibilidades com uma parte relacionada.
    ("008575", "2025-12-31", "155377", "1"): FilingReview(
        "https://api.mziq.com/mzfilemanager/v2/d/6b90b8ef-4914-4021-8296-c5aca7b388eb/"
        "332513a1-ba6f-da78-df8f-6c5de67a33d1?origin=2",
        (ReviewedAccount("2.01.02.02.02", "Mútuo a pagar a partes relacionadas", 0, 43_119_000),),
    ),
    # Energisa, notas 20 e 21. Os encargos no circulante integram a dívida
    # divulgada e têm conta separada dos empréstimos e das debêntures.
    ("015253", "2025-12-31", "155361", "3"): FilingReview(
        "https://www.rad.cvm.gov.br/ENET/frmGerenciaPaginaFRE.aspx?"
        "CodigoTipoInstituicao=1&NumeroSequencialDocumento=155361",
        (ReviewedAccount("2.01.05.02.09", "Encargos de dívidas", 400_180_000, 333_662_000),),
    ),
    # Telefônica, nota de provisões. As multas por cancelamento são segregadas
    # dos passivos de arrendamento já incluídos em financiamentos.
    ("017671", "2025-12-31", "154821", "1"): FilingReview(
        "https://api.mziq.com/mzfilemanager/v2/d/24165f81-24d6-4648-bf9f-66712905d5a2/"
        "197836af-54b5-cff0-af1e-de97ad340f36?origin=2",
        (
            ReviewedAccount(
                "2.01.06.02.06", "Provisão para Multas de Cancelamento de Contratos de Arrendamento",
                41_005_000, 41_950_000, False,
            ),
        ),
    ),
    # EcoRodovias, notas 6(b) e 33. O FIDC e o risco sacado mantêm
    # as condições comerciais originais de pagamento aos fornecedores.
    ("019453", "2025-12-31", "155429", "1"): FilingReview(
        "https://api.mziq.com/mzfilemanager/v2/d/7c109ecb-88c9-441f-91cb-66a8db417120/"
        "297cd69b-7cfb-d469-55f1-3d8418bf4b76?origin=2",
        (
            ReviewedAccount("2.01.02.01.02", "Fornecedores - Risco sacado", 2_412_000, 0, False),
            ReviewedAccount("2.01.02.01.03", "Fornecedores FIDC", 6_217_000, 27_624_000, False),
        ),
    ),
    # Embraer, nota 17. Os prazos e valores originais são mantidos, sem
    # encargos ou garantias da companhia; a DFP divide o saldo em dois grupos.
    ("020087", "2025-12-31", "155126", "1"): FilingReview(
        "https://www.sec.gov/Archives/edgar/data/1355444/000162828026021824/erj-20251231.htm",
        (
            ReviewedAccount(
                "2.01.02.01.02", "Fornecedores - Acordos de financiamento", 126_285_000, 181_063_000, False,
            ),
            ReviewedAccount(
                "2.01.02.02.02", "Fornecedores - Acordos de financiamento", 141_741_000, 165_164_000, False,
            ),
        ),
    ),
    # ALLOS, notas de gestão de capital, 13 e 15.1. A dívida divulgada inclui
    # as obrigações por compra e venda de ativos. Ambos os grupos aparecem
    # fora dos subtotais padronizados de empréstimos na DFP.
    ("022357", "2025-12-31", "155236", "1"): FilingReview(
        "https://api.mziq.com/mzfilemanager/v2/d/330c258b-6212-45ce-8c13-557ea46cc23a/"
        "ec0bffc6-8050-2a0b-1e23-5a3890c7c7d5?origin=2",
        (
            ReviewedAccount(
                "2.01.05.02.05", "Empréstimos, financiamentos e debêntures", 1_123_404_000, 325_357_000,
            ),
            ReviewedAccount(
                "2.02.02.02.07", "Empréstimos, financiamentos e debêntures", 5_521_620_000, 5_553_953_000,
            ),
            ReviewedAccount(
                "2.01.05.02.04", "Obrigações por compra e venda de ativos", 407_484_000, 3_384_000,
            ),
            ReviewedAccount(
                "2.02.02.02.03", "Obrigações por compra e venda de ativos", 19_752_000, 14_503_000,
            ),
        ),
    ),
    # Vivara, nota 28. As obrigações por despesas variáveis e condomínio
    # ficam separadas dos arrendamentos de direito de uso.
    ("024805", "2025-12-31", "155474", "1"): FilingReview(
        "https://api.mziq.com/mzfilemanager/v2/d/61a4df2d-a461-44d6-9128-da74058019db/"
        "0cfe19b8-158f-39a5-8750-42ffc2c71a54?origin=2",
        (ReviewedAccount("2.01.05.02.04", "Arrendamentos a pagar", 14_933_497, 14_487_029, False),),
    ),
    # OceanPact, BPP consolidado. Os credores por financiamento aparecem
    # em Outras Obrigações, separados dos subtotais de empréstimos nos dois prazos.
    ("025534", "2025-12-31", "155072", "1"): FilingReview(
        "https://www.rad.cvm.gov.br/ENET/frmGerenciaPaginaFRE.aspx?"
        "CodigoTipoInstituicao=1&NumeroSequencialDocumento=155072",
        (
            ReviewedAccount("2.01.05.02.06", "Credores por financiamento", 5_418_000, 1_925_000),
            ReviewedAccount("2.02.02.02.07", "Credores por financiamento", 4_772_000, 2_851_000),
        ),
    ),
    # RD Saúde. O FIDC capta por cotas seniores remuneradas na nota 15.
    # A compra de participação em controlada é registrada a valor presente,
    # com juros no resultado. O fluxo operacional separa aluguéis a pagar.
    ("005258", "2025-12-31", "155035", "1"): FilingReview(
        "https://ri.rdsaude.com.br/Download.aspx?Arquivo=pvBQW9Dgna5MufaSF4UDNQ%3D%3D",
        (
            ReviewedAccount(
                "2.01.02.01.03", "Passivos com Cotistas Seniores - FIDC", 200_267_000, 228_549_000,
            ),
            ReviewedAccount(
                "2.02.02.02.04", "Contas a Pagar por Aquisição de Controladas", 13_573_000, 15_518_000,
            ),
            ReviewedAccount("2.01.05.02.04", "Aluguéis", 113_933_000, 132_470_000, False),
        ),
    ),
    # Frasle, notas 6, 21 e 24.6. A dívida inclui os compromissos de
    # aquisição e o mútuo. O risco sacado mantém os termos comerciais.
    ("006211", "2025-12-31", "155265", "1"): FilingReview(
        "https://ads.clicrbs.com.br/PUBLICIDADE-LEGAL/PIO/Publicidade_Legal_PIO_190326_2%20ass.pdf"
        "?project=rbs-gauchazh-prd",
        (
            ReviewedAccount("2.01.02.01.02", "Risco Sacado", 5_212_000, 7_532_000, False),
            ReviewedAccount("2.01.05.02.06", "Contas a Pagar de Combinação de Negócio", 26_042_000, 11_954_000),
            ReviewedAccount("2.02.02.01.04", "Débitos com Outras Partes Relacionadas", 5_692_000, 3_480_000),
            ReviewedAccount("2.02.02.02.05", "Contas a Pagar por Combinação de Negócios", 100_896_000, 164_909_000),
        ),
    ),
    # Metalúrgica Gerdau, nota 14 do consolidado do próprio emissor. Os
    # fornecedores optam pela antecipação e arcam com o custo financeiro.
    ("008656", "2025-12-31", "154833", "1"): FilingReview(
        "https://api.mziq.com/mzfilemanager/v2/d/0e58d869-d438-4c13-9d23-c24d27e72c47/"
        "5a4823f5-8d3a-e293-d50e-1d0a3f3fd666?origin=2",
        (ReviewedAccount("2.01.02.01.02", "Fornecedores risco sacado", 459_899_000, 381_415_000, False),),
    ),
    # ENGIE, nota 14(a) da DFP. As preferenciais têm resgate obrigatório e
    # remuneração financeira. Os saldos aparecem em outras obrigações.
    ("017329", "2025-12-31", "155137", "2"): FilingReview(
        "https://www.engie.com.br/wp-content/uploads/2026/02/260225-Release-de-Resultados-4T25.pdf",
        (
            ReviewedAccount("2.01.05.02.08", "Ações preferenciais resgatáveis", 10_142_000, 22_873_000),
            ReviewedAccount("2.02.02.02.05", "Ações preferenciais resgatáveis", 477_145_000, 466_375_000),
        ),
    ),
    # Dexco, nota 20.1. O fornecedor arca com o custo da antecipação.
    # Os instrumentos atrelados à dívida ainda exigem revisão na nota 4.6.
    ("021091", "2025-12-31", "155065", "1"): FilingReview(
        "https://docs.publicnow.com/viewDoc?filename=85349%5CEXT%5C"
        "FBC144C4C0601722BEC776F76C9910DD5CDF3F7D_D5D7C8F688930DF450A247A54F552E819054A777.PDF",
        (ReviewedAccount("2.01.02.01.02", "Fornecedores Risco Sacado", 273_347_000, 180_465_000, False),),
    ),
    # Hypera, notas 4 e 19. Os títulos a pagar integram o endividamento.
    # As cessões fazem parte das operações comerciais dos fornecedores.
    ("021431", "2025-12-31", "155321", "1"): FilingReview(
        "https://s3.glbimg.com/v1/AUTH_63b422c2caee4269b8b34177e8876b93/"
        "valorri-uploads/bs/2026/5/e/UXkrknS4Sp23N0L6P8Bw/hypera1588156716032026.pdf",
        (
            ReviewedAccount("2.01.05.02.04", "Títulos a Pagar", 15_367_000, 18_486_000),
            ReviewedAccount("2.01.05.02.07", "Cessão de Créditos no País", 327_262_000, 340_492_000, False),
            ReviewedAccount("2.01.05.02.08", "Cessão de Créditos no Exterior", 208_345_000, 149_051_000, False),
            ReviewedAccount("2.02.02.02.04", "Títulos a Pagar", 1_959_000, 7_500_000),
        ),
    ),
    # Fleury, nota 19. As obrigações de aquisição, registradas a valor
    # presente, têm atualização mensal principalmente pelo CDI e IPCA.
    ("021881", "2025-12-31", "155089", "1"): FilingReview(
        "https://s3.glbimg.com/v1/AUTH_63b422c2caee4269b8b34177e8876b93/"
        "valorri-uploads/bs/2026/i/O/BTns0RTJmg2u8z8TMWmQ/fleury1587954506032026.pdf",
        (
            ReviewedAccount(
                "2.01.05.02.04", "Contas a Pagar - aquisição de empresas", 42_573_000, 79_339_000,
            ),
            ReviewedAccount(
                "2.02.02.02.03", "Contas a Pagar aquisição de empresas", 301_810_000, 348_031_000,
            ),
        ),
    ),
    # Grupo SBF, nota 18. A adesão cabe ao fornecedor. O grupo paga o
    # valor nominal na data de vencimento da obrigação original.
    ("024694", "2025-12-31", "155192", "1"): FilingReview(
        "https://docs.publicnow.com/viewDoc?filename=181596%5CEXT%5C"
        "68E8D496F18E08B133AA0A4DBD124B4F1E75E8E4_F89C0AE6A61C8E006DF1ED9EB03E1BF7DBFFBAAA.PDF",
        (ReviewedAccount("2.01.02.01.02", "Risco sacado", 52_217_000, 84_325_000, False),),
    ),
}
