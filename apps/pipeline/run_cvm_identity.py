"""Gera a evidência cadastral da amostra com o FCA da CVM."""

import argparse
import sys
from datetime import date
from pathlib import Path
from zipfile import BadZipFile
from zoneinfo import ZoneInfoNotFoundError

from src.moat_cvm.archives import acquire_archive, write_snapshot
from src.moat_cvm.fca import ORIGIN, create_identity_snapshot

REPO = Path(__file__).resolve().parents[2]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--raw-dir", type=Path, default=REPO / "data/raw/cvm")
    parser.add_argument("--output", type=Path, default=REPO / "data/public/cvm-identity.json")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--offline", action="store_true", help="Usar somente o ZIP local.")
    mode.add_argument("--refresh", action="store_true", help="Conferir reapresentações na CVM.")
    options = parser.parse_args()
    if not 2010 <= options.year <= date.today().year:
        parser.error("Informe um ano de formulário entre 2010 e o ano atual.")

    try:
        filename = f"fca_cia_aberta_{options.year}.zip"
        archive = acquire_archive(
            options.raw_dir,
            filename,
            ORIGIN + filename,
            offline=options.offline,
            refresh=options.refresh,
        )
        payload = create_identity_snapshot(archive, options.year)
        wrote = write_snapshot(options.output, payload)
    except (BadZipFile, KeyError, OSError, ValueError, ZoneInfoNotFoundError) as error:
        print(f"Lote FCA rejeitado. Snapshot anterior preservado. {error}", file=sys.stderr)
        return 1

    count = sum(len(company["tickers"]) for company in payload["companies"])
    state = "Snapshot gravado" if wrote else "Snapshot já atualizado"
    print(f"{state} em {options.output}. {count} códigos declarados.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
