import { saveWorkbook, toBlob, workbookToBytes } from '@office-kit/xlsx/io';
import {
  ensureBuiltinStyle,
  makeAlignment,
  makeFont,
  makePatternFill,
  registerCellStyle,
} from '@office-kit/xlsx/styles';
import { columnLetterFromIndex } from '@office-kit/xlsx/utils';
import { addWorksheet, createWorkbook } from '@office-kit/xlsx/workbook';
import {
  makeAutoFilter,
  setAutoFilter,
  setCell,
  setColumnWidth,
  setFreezePanes,
  setRowHeight,
} from '@office-kit/xlsx/worksheet';
import type { ReportFormat, ReportSheet, ReportValue, WorkbookReport } from './report';

const workbookType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const formats: Record<ReportFormat, string> = {
  integer: '#,##0',
  number: '#,##0.00##',
  currency: '"R$" #,##0.00;-"R$" #,##0.00',
  percent: '0.00##%',
  date: 'dd/mm/yyyy',
  datetime: 'dd/mm/yyyy hh:mm:ss',
};

function cleanValue(value: ReportValue): ReportValue {
  if (typeof value === 'string') {
    // Strings go straight to the XLSX string type, never through formula construction.
    return Array.from(value, (character) => {
      const code = character.codePointAt(0) ?? 0;
      return code === 9 ||
        code === 10 ||
        code === 13 ||
        (code >= 32 && (code < 0xd800 || code > 0xdfff) && code !== 0xfffe && code !== 0xffff)
        ? character
        : '\ufffd';
    })
      .join('')
      .slice(0, 32_767)
      .replace(/[\uD800-\uDBFF]$/u, '\ufffd');
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('Valor numérico inválido para exportação.');
  }
  if (value instanceof Date && !Number.isFinite(value.getTime())) {
    throw new Error('Data inválida para exportação.');
  }
  return value;
}

function workbookFor(report: WorkbookReport, generatedAt: Date) {
  const workbook = createWorkbook();
  ensureBuiltinStyle(workbook.styles, 'Normal');
  const header = registerCellStyle(workbook, {
    font: makeFont({ bold: true, color: { rgb: 'FFFFFFFF' } }),
    fill: makePatternFill({ patternType: 'solid', fgColor: { rgb: 'FF27343F' } }),
    alignment: makeAlignment({ vertical: 'center', wrapText: true }),
  });
  const bodyText = registerCellStyle(workbook, {
    alignment: makeAlignment({ vertical: 'center', wrapText: true }),
  });
  const styles = Object.fromEntries(
    Object.entries(formats).map(([format, code]) => [
      format,
      registerCellStyle(workbook, { numberFormat: code }),
    ]),
  );

  const notes: ReportSheet = {
    name: 'Metodologia e fontes',
    columns: [
      { label: 'Item', width: 42 },
      { label: 'Descrição ou valor', width: 92 },
    ],
    rows: [...report.notes, ['Exportado em (UTC)', generatedAt]],
  };
  for (const specification of [...report.sheets, notes]) {
    const sheet = addWorksheet(workbook, specification.name);
    setFreezePanes(sheet, 'A2');
    setRowHeight(sheet, 1, 34);
    specification.columns.forEach(({ label, width }, index) => {
      setColumnWidth(sheet, index + 1, width ?? Math.max(19, Math.min(33, label.length + 5)));
      setCell(sheet, 1, index + 1, cleanValue(label), header);
    });
    if (specification.columns.length && specification.rows.length) {
      const lastColumn = columnLetterFromIndex(specification.columns.length);
      setAutoFilter(
        sheet,
        makeAutoFilter({ ref: `A1:${lastColumn}${specification.rows.length + 1}` }),
      );
    }
    specification.rows.forEach((row, index) => {
      if (row.length !== specification.columns.length) {
        throw new Error(`Número de colunas incompatível na aba ${specification.name}.`);
      }
      const rowNumber = index + 2;
      let lines = 1;
      row.forEach((raw, columnIndex) => {
        const column = specification.columns[columnIndex];
        const value = cleanValue(raw);
        if (value === null || !column) return;
        if (typeof value === 'string') {
          const width = column.width ?? Math.max(19, Math.min(33, column.label.length + 5));
          const wrapped = value
            .split('\n')
            .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / (width - 2))), 0);
          lines = Math.max(lines, Math.min(20, wrapped));
        }
        const inferred =
          value instanceof Date
            ? value.getTime() % 86_400_000 === 0
              ? 'date'
              : 'datetime'
            : undefined;
        const format = column.format ?? inferred;
        setCell(
          sheet,
          rowNumber,
          columnIndex + 1,
          value,
          typeof value === 'string' ? bodyText : format ? styles[format] : undefined,
        );
      });
      if (lines > 1) setRowHeight(sheet, rowNumber, Math.min(300, lines * 16));
    });
  }

  return workbook;
}

export function renderWorkbook(report: WorkbookReport, generatedAt = new Date()) {
  return workbookToBytes(workbookFor(report, generatedAt));
}

export async function downloadWorkbook(filename: string, report: WorkbookReport) {
  const sink = toBlob(workbookType);
  await saveWorkbook(workbookFor(report, new Date()), sink);
  const url = URL.createObjectURL(sink.result());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xlsx') ? filename : filename + '.xlsx';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}
