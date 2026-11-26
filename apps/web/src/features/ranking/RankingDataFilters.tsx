export function RankingDataFilters({
  requireHistory,
  hideUnavailable,
  onHistoryChange,
  onUnavailableChange,
}: {
  requireHistory: boolean;
  hideUnavailable: boolean;
  onHistoryChange: (checked: boolean) => void;
  onUnavailableChange: (checked: boolean) => void;
}) {
  return (
    <div className="ranking-data-filters" role="group" aria-label="Qualidade dos dados">
      <label>
        <input
          type="checkbox"
          checked={requireHistory}
          onChange={(event) => onHistoryChange(event.currentTarget.checked)}
        />
        Somente empresas com 5 anos de histórico
      </label>
      <label>
        <input
          type="checkbox"
          checked={hideUnavailable}
          onChange={(event) => onUnavailableChange(event.currentTarget.checked)}
        />
        Ocultar empresas com indicadores indisponíveis
      </label>
    </div>
  );
}
