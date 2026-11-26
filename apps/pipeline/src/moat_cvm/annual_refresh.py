"""Atualiza juntos os cinco lotes contábeis da seleção anual publicada."""

import os
from datetime import datetime
from pathlib import Path

from ..moat_sector_reinvestment import create_sector_reinvestment
from .archives import acquire_archive, archive_sha256
from .dfp import ORIGIN as DFP_ORIGIN
from .fca import ORIGIN as FCA_ORIGIN
from .refresh_selection import build_refresh_selection
from .sector_comparison import annual_window, create_sector_comparison
from .sector_leverage import create_sector_leverage
from .sector_margins import create_sector_margins
from .sector_roic import create_sector_roic

ROE = "cvm-sector-comparison.json"
ROIC = "cvm-sector-roic.json"
LEV = "cvm-sector-leverage.json"
REINVESTMENT = "cvm-sector-reinvestment.json"
MARGINS = "cvm-sector-margins.json"
SNAPSHOTS = (ROE, ROIC, LEV, REINVESTMENT, MARGINS)


def _has_observation(snapshot: dict, metric: str, year: int | None = None) -> bool:
    return any(
        observation[metric] is not None and (year is None or observation["year"] == year)
        for company in snapshot["companies"] for observation in company["observations"]
    )


def _validate_cohort(directory: dict, roe: dict, roic: dict) -> None:
    company_names = [company["name"] for company in roe["companies"] + roic["companies"]]
    if len(company_names) != len(directory["companies"]) or set(company_names) != set(directory["companies"]):
        raise ValueError("O lote contábil não cobre a seleção anual publicada.")
    if not _has_observation(roe, "roe") or not _has_observation(roic, "roic"):
        raise ValueError("A janela ficou sem observações válidas de ROE ou de ROIC.")


def _keep_source_date(path: Path, source: dict | None) -> None:
    if source is None or source["sha256"] != archive_sha256(path):
        return
    verified_at = datetime.fromisoformat(source["retrievedAt"]).timestamp()
    if path.stat().st_mtime != verified_at:
        os.utime(path, (verified_at, verified_at))


def refresh_annual_snapshots(
    directory: dict,
    previous: dict,
    raw_dir: Path,
    *,
    target_year: int,
    offline: bool,
    verified_on: str | None = None,
) -> dict:
    floor = previous[ROIC]["manifest"]["years"][-1]
    if (
        target_year < floor
        or previous[ROE]["manifest"]["years"] != previous[ROIC]["manifest"]["years"]
    ):
        raise ValueError("As janelas publicadas são incompatíveis ou o exercício solicitado é anterior.")
    sources = {
        (item["kind"], item["year"]): item for item in previous[ROIC]["manifest"]["archives"]
    }
    archives = {}

    def prepare(kind: str, year: int) -> Path:
        key = kind, year
        if key not in archives:
            filename = f"{kind}_cia_aberta_{year}.zip"
            origin = FCA_ORIGIN if kind == "fca" else DFP_ORIGIN
            path = acquire_archive(
                raw_dir,
                filename,
                f"{origin}{filename}",
                offline=offline,
                refresh=not offline,
            )
            _keep_source_date(path, sources.get(key))
            archives[key] = path
        return archives[key]

    fca = [prepare("fca", int(directory["asOf"][:4]))]
    selection = build_refresh_selection(directory, fca)
    for end_year in range(target_year, floor - 1, -1):
        dfp = {year: prepare("dfp", year) for year in annual_window(end_year)}
        roe = create_sector_comparison(selection, directory, fca, dfp)
        roic = create_sector_roic(selection, directory, fca, dfp)
        _validate_cohort(directory, roe, roic)
        if _has_observation(roe, "roe", end_year) or _has_observation(roic, "roic", end_year):
            break
    else:
        raise ValueError("A CVM não retornou dados válidos para o exercício publicado.")

    for name, snapshot in ((ROE, roe), (ROIC, roic)):
        last_check = previous[name]["manifest"].get("verifiedOn")
        if verified_on is not None or last_check is not None:
            snapshot["manifest"]["verifiedOn"] = verified_on or last_check

    updated = {
        ROE: roe,
        ROIC: roic,
        LEV: create_sector_leverage(selection, directory, roic, raw_dir),
        REINVESTMENT: create_sector_reinvestment(selection, directory, roic, raw_dir),
        MARGINS: create_sector_margins(selection, directory, roic, raw_dir),
    }
    return updated
