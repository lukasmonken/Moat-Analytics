"""Coleta o histórico diário ajustado da seleção anual em um JSON privado."""

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

from src.moat_cvm.archives import write_snapshot
from src.moat_market_calendar import completed_b3_trade_date
from src.moat_market_history import HISTORY_RANGES, ProviderError, brapi_history_reader, collect_market_history
from src.moat_market_identity import parse_market_cap_universe

REPO = Path(__file__).resolve().parents[2]
PROCESSED = REPO / "data/processed/market-history"
DEFAULT_UNIVERSE = REPO / "data/processed/market-caps/universe.json"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--universe", type=Path, help="Mapa privado da seleção anual.")
    parser.add_argument("--range", choices=HISTORY_RANGES, default="3mo", help="Janela inicial de histórico.")
    parser.add_argument("--previous", type=Path, help="Histórico privado anterior para atualização incremental.")
    parser.add_argument("--output", type=Path, default=PROCESSED / "latest.json")
    args = parser.parse_args()

    try:
        trade_date = completed_b3_trade_date(datetime.now(UTC))
        if trade_date is None:
            print("Sem pregão da B3 hoje. O último histórico continua disponível.")
            return 0

        supplied = Path(os.path.abspath(args.output))
        output = supplied.resolve()
        if any(
            path.is_relative_to(REPO) and not path.is_relative_to(PROCESSED)
            for path in (supplied, output)
        ):
            raise ValueError("A saída no repositório deve ficar em data/processed/market-history.")
        universe_path = args.universe or DEFAULT_UNIVERSE
        if output == universe_path.resolve():
            raise ValueError("Use caminhos diferentes para a seleção privada e o histórico diário.")
        token = os.getenv("BRAPI_TOKEN", "").strip()
        if not token:
            raise ValueError("Configure BRAPI_TOKEN no ambiente privado de coleta.")

        secret = os.getenv("MOAT_MARKET_CAP_UNIVERSE") if args.universe is None else None
        try:
            raw_universe = secret or universe_path.read_text(encoding="utf-8")
            universe = parse_market_cap_universe(json.loads(raw_universe))
        except (OSError, ValueError):
            raise ValueError("Mapa privado da seleção anual ausente ou inválido.") from None

        previous_path = args.previous or (output if output.exists() else None)
        previous = None
        if previous_path is not None:
            try:
                previous = json.loads(previous_path.read_text(encoding="utf-8"))
                if not isinstance(previous, dict):
                    raise ValueError
            except (OSError, ValueError):
                raise ValueError("Histórico privado anterior ausente ou inválido.") from None

        snapshot = collect_market_history(
            universe, trade_date, brapi_history_reader(token), history_range=args.range, previous=previous,
        )
        write_snapshot(output, snapshot)
    except (OSError, RuntimeError, ValueError) as error:
        reason = str(error) if isinstance(error, (ProviderError, ValueError)) else "Falha ao gravar o arquivo privado."
        print(f"Coleta de histórico interrompida. Último histórico preservado. {reason}", file=sys.stderr)
        return 1

    current = sum(asset["observations"][-1]["date"] == snapshot["asOf"] for asset in snapshot["assets"])
    stored = len(snapshot["assets"])
    print(
        f"Pregão {trade_date:%d/%m/%Y}. Fechamento ajustado para {current} de {len(universe['companies'])} "
        f"companhias. Séries anteriores mantidas sem atualização: {stored - current}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
