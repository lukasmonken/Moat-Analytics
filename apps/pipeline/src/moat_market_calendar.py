"""Calendário do mercado à vista da B3 para a coleta após o pregão."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

SAO_PAULO = ZoneInfo("America/Sao_Paulo")
COLLECTION_START = time(20, 20)
# Pré-abertura do mercado à vista no Ofício Circular 055/2026-VNC.
PRE_OPEN = time(9, 45)

# Quadro A dos Ofícios Circulares 041/2026-VNC (2026) e 057/2026-VNC (2027).
CLOSED_DAYS = {
    2026: frozenset({
        (1, 1), (2, 16), (2, 17), (4, 3), (4, 21), (5, 1), (6, 4),
        (9, 7), (10, 12), (11, 2), (11, 20), (12, 24), (12, 25), (12, 31),
    }),
    2027: frozenset({
        (1, 1), (2, 8), (2, 9), (3, 26), (4, 21), (5, 27),
        (9, 7), (10, 12), (11, 2), (11, 15), (12, 24), (12, 31),
    }),
}


def _is_trade_date(day: date) -> bool:
    holidays = CLOSED_DAYS.get(day.year)
    if holidays is None:
        raise ValueError(f"Calendário de negociação da B3 indisponível para {day.year}.")
    return day.weekday() < 5 and (day.month, day.day) not in holidays


def completed_b3_trade_date(now: datetime) -> date | None:
    """Seleciona o fechamento de hoje ou, antes da pré-abertura, o último concluído."""
    if now.utcoffset() is None:
        raise ValueError("Informe a hora da coleta com fuso horário.")

    local = now.astimezone(SAO_PAULO)
    today = local.date()
    today_is_trade_date = _is_trade_date(today)
    if local.time() < PRE_OPEN:
        previous = today - timedelta(days=1)
        while not _is_trade_date(previous):
            previous -= timedelta(days=1)
        return previous
    if not today_is_trade_date:
        return None
    if local.time() < COLLECTION_START:
        raise ValueError("A coleta diária começa às 20h20 no horário de Brasília.")
    return today
