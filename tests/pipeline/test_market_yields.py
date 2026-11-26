import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "apps/pipeline"))
sys.path.insert(0, str(REPO / "packages/finance-core/src"))

from src.moat_market_yields import attach_market_yields

SOURCE = "https://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx?NumeroSequencialDocumento=1"
AS_OF = "2026-11-18"


def snapshot(*companies):
    return {
        "manifest": {
            "tradeDate": "2026-11-25",
            "selectionAsOf": AS_OF,
            "coverage": {"includedCompanies": len(companies)},
        },
        "companies": [
            {"companyId": f"cvm:{index}", "name": name, "marketCapBrl": cap}
            for index, (name, cap) in enumerate(companies, 1)
        ],
    }


def funding(reference, short=30, long=20, cash=10):
    return [
        {"key": key, "statement": statement, "code": code, "referenceDate": reference, "amountBrl": value}
        for (key, statement, code, value) in (
            ("closingShortBorrowings", "BPP", "2.01.04", short),
            ("closingLongBorrowings", "BPP", "2.02.01", long),
            ("closingCash", "BPA", "1.01.01", cash),
        )
    ]


def dfp(inputs, year=2025, received="2026-03-01"):
    return {
        "year": year,
        "filing": {"referenceDate": f"{year}-12-31", "receivedAt": received, "filingUrl": SOURCE},
        "inputs": inputs,
    }


def annual(metric="roic", **companies):
    return {
        "manifest": {
            "asOf": AS_OF,
            "methodologyVersion": f"{metric}-dfp-comparisons.v{'2' if metric == 'roic' else '1'}",
        },
        "companies": [{"name": name, "observations": observations} for name, observations in companies.items()],
    }


class MarketYieldsTest(unittest.TestCase):
    def test_uses_stored_annual_nopat_and_parent_income_over_matching_denominators(self):
        caps = snapshot(("EMPRESA", 200), ("SEGURADORA", 100))
        result = attach_market_yields(
            caps,
            roic=annual(EMPRESA=[dfp({"nopatBrl": 24, "accounts": funding("2025-12-31")})]),
            roe=annual("roe", SEGURADORA=[dfp({"netIncomeBrl": -12})]),
        )
        issuer, insurer = [company["valuation"] for company in result["companies"]]
        self.assertEqual((issuer["metric"], issuer["numeratorBrl"]), ("operatingYield", 24))
        self.assertEqual((issuer["netDebtBrl"], issuer["enterpriseValueBrl"], issuer["value"]), (40, 240, 0.10))
        self.assertEqual((insurer["metric"], insurer["numeratorBrl"], insurer["value"]), ("earningsYield", -12, -0.12))
        self.assertIsNone(insurer["enterpriseValueBrl"])
        self.assertEqual(issuer["accounting"], {
            "referenceDate": "2025-12-31", "receivedAt": "2026-03-01",
            "sourceUrl": SOURCE, "supportingDocumentUrl": None,
        })
        self.assertEqual(result["manifest"]["coverage"]["availableYields"], 2)
        self.assertNotIn("valuation", caps["companies"][0])

    def test_does_not_use_a_dfp_received_after_the_trade_date(self):
        joined = attach_market_yields(
            snapshot(("EMPRESA", 100)),
            roic=annual(EMPRESA=[
                dfp({"nopatBrl": 10, "accounts": funding("2024-12-31")}, 2024, "2025-03-01"),
                dfp({"nopatBrl": 99, "accounts": funding("2025-12-31")}, received="2026-11-26"),
            ]),
            roe=annual("roe"),
        )["companies"][0]["valuation"]
        self.assertEqual(joined["numeratorBrl"], 10)
        self.assertEqual(joined["accounting"]["referenceDate"], "2024-12-31")

    def test_distinguishes_missing_company_pricing_and_fundamentals(self):
        accounts = funding("2025-12-31")
        accounts[-1]["referenceDate"] = "2024-12-31"
        result = attach_market_yields(
            snapshot(("EMPRESA", 100), ("BANCO", None), ("sem identidade", 100)),
            roic=annual(EMPRESA=[dfp({"nopatBrl": 10, "accounts": accounts})]),
            roe=annual("roe", BANCO=[dfp({"netIncomeBrl": 9})]),
        )
        issuer, bank, unmatched = [company["valuation"] for company in result["companies"]]
        self.assertIsNone(issuer["value"])
        self.assertIn("Insumos anuais", issuer["reason"])
        self.assertIsNone(bank["value"])
        self.assertEqual(bank["numeratorBrl"], 9)
        self.assertIn("Valor de mercado", bank["reason"])
        self.assertIsNone(unmatched["metric"])
        self.assertIn("correspondência", unmatched["reason"])

    def test_zero_nopat_valid_but_nonpositive_ev_not_used(self):
        inputs = {"nopatBrl": 0, "accounts": funding("2025-12-31", short=0, long=0, cash=20)}
        rows = attach_market_yields(
            snapshot(("EMPRESA", 25), ("OUTRA", 20)),
            roic=annual(EMPRESA=[dfp(inputs)], OUTRA=[dfp(inputs)]),
            roe=annual("roe"),
        )["companies"]
        self.assertEqual(rows[0]["valuation"]["netDebtBrl"], -20)
        self.assertEqual(rows[0]["valuation"]["value"], 0)
        self.assertIsNone(rows[1]["valuation"]["value"])
        self.assertIsNone(rows[1]["valuation"]["enterpriseValueBrl"])

    def test_rejects_universe_or_methodology_mismatch(self):
        other = annual("roe")
        other["manifest"]["asOf"] = "2026-11-17"
        with self.assertRaises(ValueError):
            attach_market_yields(snapshot(), roic=annual(), roe=other)
        with self.assertRaises(ValueError):
            attach_market_yields(snapshot(), roic=annual("roe"), roe=annual("roe"))


if __name__ == "__main__":
    unittest.main()
