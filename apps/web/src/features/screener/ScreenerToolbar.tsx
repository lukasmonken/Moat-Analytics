import { Button } from '../../shared/ui';
import { formatNumber } from './presentation';

interface ScreenerToolbarProps {
  count: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  paginationLabel: string;
}

export function ScreenerToolbar({
  count,
  currentPage,
  totalPages,
  onPageChange,
  paginationLabel,
}: ScreenerToolbarProps) {
  return (
    <div className="screener-results__toolbar">
      <p role="status">{count}</p>
      <nav className="screener-pagination" aria-label={paginationLabel}>
        <Button disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
          Página anterior
        </Button>
        <p aria-live="polite">
          Página {formatNumber(currentPage)} de {formatNumber(totalPages)}
        </p>
        <Button disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
          Próxima página
        </Button>
      </nav>
    </div>
  );
}
