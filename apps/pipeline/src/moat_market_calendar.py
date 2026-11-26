"""Calendário do mercado à vista da B3 para a coleta após o pregão."""

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

SAO_PAULO = ZoneInfo("America/Sao_Paulo")
COLLECTION_START = time(20, 20)

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


def completed_b3_trade_date(now: datetime) -> date | None:
    """Retorna o pregão da data local após a janela de fechamento."""
    if now.utcoffset() is None:
        raise ValueError("Informe a hora da coleta com fuso horário.")

    local = now.astimezone(SAO_PAULO)
    today = local.date()
    if today.year not in CLOSED_DAYS:
        raise ValueError(f"Calendário de negociação da B3 indisponível para {today.year}.")
    if today.weekday() >= 5 or (today.month, today.day) in CLOSED_DAYS[today.year]:
        return None
    if local.time() < COLLECTION_START:
        raise ValueError("A coleta diária começa às 20h20 no horário de Brasília.")
    return today
