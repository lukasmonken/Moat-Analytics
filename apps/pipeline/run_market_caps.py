"""Coleta o valor de mercado de fechamento da seleção anual em um JSON privado."""

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

from src.moat_cvm.archives import write_snapshot
from src.moat_market_calendar import completed_b3_trade_date
from src.moat_market_caps import brapi_quote_reader, collect_market_caps
from src.moat_market_identity import parse_market_cap_universe

REPO = Path(__file__).resolve().parents[2]
PROCESSED = REPO / "data/processed/market-caps"
PUBLIC = REPO / "data/public"


def main() -> int:
    sys.path.insert(0, str(REPO / "packages/finance-core/src"))
    from src.moat_market_yields import attach_market_yields

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--universe", type=Path, help="Mapa privado da seleção anual.")
    parser.add_argument("--output", type=Path, default=PROCESSED / "latest.json")
    args = parser.parse_args()

    try:
        trade_date = completed_b3_trade_date(datetime.now(UTC))
        if trade_date is None:
            print("Sem pregão da B3 hoje. O último lote continua disponível.")
            return 0
        universe_path = args.universe or PROCESSED / "universe.json"
        supplied = Path(os.path.abspath(args.output))
        output = supplied.resolve()
        if any(
            path.is_relative_to(REPO) and not path.is_relative_to(PROCESSED)
            for path in (supplied, output)
        ):
            raise ValueError("A saída dentro do repositório deve ficar em data/processed/market-caps.")
        if output == universe_path.resolve():
            raise ValueError("Use caminhos diferentes para a seleção privada e o lote diário.")
        secret = os.getenv("MOAT_MARKET_CAP_UNIVERSE") if args.universe is None else None
        raw_universe = secret or universe_path.read_text(encoding="utf-8")
        universe = parse_market_cap_universe(json.loads(raw_universe))
        token = os.getenv("BRAPI_TOKEN", "").strip()
        if not token:
            raise ValueError("Configure BRAPI_TOKEN no ambiente privado de coleta.")
        snapshot = collect_market_caps(universe, trade_date, brapi_quote_reader(token))
        coverage = snapshot["manifest"]["coverage"]
        available, total = coverage["availableCompanies"], coverage["includedCompanies"]
        compared = coverage["comparedCompanies"]
        disagreeing = coverage["disagreeingCompanies"]
        if available == 0:
            raise ValueError(
                f"Sem valores válidos para as {total} empresas do pregão. "
                f"Empresas com valores divergentes entre códigos: {disagreeing}."
            )
        snapshot = attach_market_yields(
            snapshot,
            roic=json.loads((PUBLIC / "cvm-sector-roic.json").read_text(encoding="utf-8")),
            roe=json.loads((PUBLIC / "cvm-sector-comparison.json").read_text(encoding="utf-8")),
        )
        yields = snapshot["manifest"]["coverage"]["availableYields"]
        write_snapshot(output, snapshot, ignore_generated_at=True)
    except (KeyError, OSError, TypeError, ValueError) as error:
        print(f"Coleta de valor de mercado interrompida. Último lote preservado. {error}", file=sys.stderr)
        return 1
    print(
        f"Pregão {trade_date:%d/%m/%Y}. Estimativas de valor de mercado para {available} de "
        f"{total} empresas e rendimento implícito para {yields}. "
        f"Códigos comparados em {compared} empresas, com {disagreeing} divergências."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
