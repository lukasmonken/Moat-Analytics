import { useState } from 'react';
import { Button } from '../ui';
import type { WorkbookReport } from './report';

export function ExportWorkbookButton({
  filename,
  build,
  label = 'Exportar Excel',
  disabled = false,
}: {
  filename: string;
  build: () => WorkbookReport;
  label?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save() {
    setBusy(true);
    setFailed(false);
    try {
      const report = build();
      const { downloadWorkbook } = await import('./workbook');
      await downloadWorkbook(filename, report);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button disabled={disabled || busy} onClick={() => void save()}>
        {busy ? 'Gerando Excel…' : label}
      </Button>
      {failed && <p role="alert">Falha ao exportar para Excel. Tente de novo.</p>}
    </>
  );
}
