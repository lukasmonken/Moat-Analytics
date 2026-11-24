import { useId, useState } from 'react';
import { ExportWorkbookButton } from '../../shared/export/ExportWorkbookButton';
import type { WorkbookReport } from '../../shared/export/report';
import { Button, Select } from '../../shared/ui';

export type ScreenerExportScope = 'filtered' | 'all';

export function ScreenerExport({
  filename,
  filteredCount,
  build,
}: {
  filename: string;
  filteredCount: number;
  build: (scope: ScreenerExportScope) => WorkbookReport;
}) {
  const scopeId = useId();
  const [scope, setScope] = useState<ScreenerExportScope>('filtered');
  const emptyScope = scope === 'filtered' && filteredCount === 0;

  return (
    <div className="screener-export">
      <Select
        id={scopeId}
        label="Linhas para exportar"
        value={scope}
        onChange={(event) => setScope(event.currentTarget.value === 'all' ? 'all' : 'filtered')}
      >
        <option value="filtered">Companhias filtradas</option>
        <option value="all">Todas as companhias</option>
      </Select>
      {emptyScope ? (
        <Button disabled>Exportar Excel</Button>
      ) : (
        <ExportWorkbookButton
          filename={filename}
          label="Exportar Excel"
          build={() => build(scope)}
        />
      )}
    </div>
  );
}
