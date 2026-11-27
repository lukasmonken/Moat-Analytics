import type {
  BacktestHistory,
  DailyBacktestHistory,
  TotalReturnObservation,
} from '@moat/data-contracts';

export interface DailyReturnPeriod {
  id: string;
  label: string;
  start: string | null;
  end: string | null;
}

const maxCalendarGap = 7 * 24 * 60 * 60 * 1000;

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sessionDates(history: DailyBacktestHistory) {
  const dates = new Set<string>();
  for (const { observations } of [...history.assets, ...(history.benchmarks ?? [])]) {
    for (const { date } of observations) dates.add(date);
  }
  return [...dates].sort();
}

function atOrBefore<T>(entries: readonly T[], cutoff: string, dateOf: (entry: T) => string) {
  let left = 0;
  let right = entries.length;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    const entry = entries[middle];
    if (entry !== undefined && dateOf(entry) <= cutoff) left = middle + 1;
    else right = middle;
  }
  return entries[left - 1];
}

function nearCutoff(date: string, cutoff: string) {
  return Date.parse(cutoff) - Date.parse(date) <= maxCalendarGap;
}

function priorMonthEnd(date: string) {
  const cutoff = new Date(date);
  cutoff.setUTCDate(0);
  return dateString(cutoff);
}

function priorYearEnd(date: string) {
  const cutoff = new Date(date);
  cutoff.setUTCMonth(0, 0);
  return dateString(cutoff);
}

function monthAnniversary(date: string, months: number) {
  const cutoff = new Date(date);
  const day = cutoff.getUTCDate();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months + 1, 0);
  cutoff.setUTCDate(Math.min(day, cutoff.getUTCDate()));
  return dateString(cutoff);
}

export function dailyReturnPeriods(history: DailyBacktestHistory): DailyReturnPeriod[] {
  const { asOf } = history;
  const sessions = sessionDates(history);
  const beforeWeek = new Date(asOf);
  // O dia anterior à segunda-feira dá a base para incluir a primeira sessão da semana.
  beforeWeek.setUTCDate(beforeWeek.getUTCDate() - ((beforeWeek.getUTCDay() + 6) % 7) - 1);
  const lastMonthEnd = priorMonthEnd(asOf);
  const lastYearEnd = priorYearEnd(asOf);

  function sessionAt(cutoff: string) {
    const day = atOrBefore(sessions, cutoff, (session) => session);
    return day && nearCutoff(day, cutoff) ? day : null;
  }

  function period(id: string, label: string, from: string, until = asOf): DailyReturnPeriod {
    const start = sessionAt(from);
    const end = sessionAt(until);
    return { id, label, start: start === end ? null : start, end };
  }

  return [
    period('week', 'Semana atual', dateString(beforeWeek)),
    period('month', 'Mês atual', lastMonthEnd),
    period('last-month', 'Último mês fechado', priorMonthEnd(lastMonthEnd), lastMonthEnd),
    period('year', 'Ano atual', lastYearEnd),
    period('last-year', 'Último ano fechado', priorYearEnd(lastYearEnd), lastYearEnd),
    period('1m', '1 mês', monthAnniversary(asOf, 1)),
    period('12m', '12 meses (1 ano)', monthAnniversary(asOf, 12)),
    ...[2, 3, 4, 5].map((years) =>
      period(`${years}y`, `${years} anos`, monthAnniversary(asOf, years * 12)),
    ),
  ];
}

export function dailyAssetReturn(
  observations: readonly TotalReturnObservation[],
  period: DailyReturnPeriod,
): number | null {
  const { start, end } = period;
  if (!start || !end || start >= end) return null;
  const first = atOrBefore(observations, start, (entry) => entry.date);
  const last = atOrBefore(observations, end, (entry) => entry.date);
  if (first?.date !== start || last?.date !== end) return null;
  const value = last.level / first.level - 1;
  return Number.isFinite(value) ? value : null;
}

export function monthlyHistoryFromDaily(history: DailyBacktestHistory): BacktestHistory {
  const { schemaVersion, basis, source, asOf, assets, benchmarks } = history;
  const lastSessions = new Map<string, string>();
  for (const date of sessionDates(history)) lastSessions.set(date.slice(0, 7), date);

  const nextWeekday = new Date(asOf);
  do {
    nextWeekday.setUTCDate(nextWeekday.getUTCDate() + 1);
  } while (nextWeekday.getUTCDay() === 0 || nextWeekday.getUTCDay() === 6);
  const nextPossibleSession = dateString(nextWeekday);

  const closingSessions = new Set<string>();
  for (const date of lastSessions.values()) {
    const end = new Date(date);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    const cutoff = dateString(end);
    if (cutoff < nextPossibleSession && nearCutoff(date, cutoff)) closingSessions.add(date);
  }

  function monthCloses<T extends { observations: TotalReturnObservation[] }>(series: T): T {
    return {
      ...series,
      observations: series.observations.filter(({ date }) => closingSessions.has(date)),
    };
  }

  return {
    schemaVersion,
    basis,
    source,
    assets: assets.map(monthCloses),
    ...(benchmarks && { benchmarks: benchmarks.map(monthCloses) }),
  };
}
