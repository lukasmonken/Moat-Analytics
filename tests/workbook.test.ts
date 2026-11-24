import { fromArrayBuffer, loadWorkbook } from '@office-kit/xlsx/io';
import { getSheet, sheetNames } from '@office-kit/xlsx/workbook';
import { getAutoFilter, getCell, getFreezePanes } from '@office-kit/xlsx/worksheet';
import { describe, expect, it } from 'vitest';
import { renderWorkbook } from '../apps/web/src/shared/export/workbook';

describe('Geração de arquivos Excel', () => {
  it('preserva texto literal, valores e datas, com filtro e cabeçalho fixo', async () => {
    const strings = [
      '=1+1',
      '+2+2',
      '-2+2',
      '@SUM(1)',
      '\t=1+2',
      '  =TODAY()',
      '_x003d_1',
      'A & B <C>',
    ];
    const bytes = await renderWorkbook(
      {
        sheets: [
          {
            name: 'Amostra',
            columns: [
              { label: 'Texto' },
              { label: 'Reais', format: 'currency' },
              { label: 'Percentual', format: 'percent' },
              { label: 'Data', format: 'date' },
            ],
            rows: strings.map((entry) => [entry, 12.5, 0.1365, new Date('2026-11-24')]),
          },
        ],
        notes: [['Fonte', 'Teste com textos literais']],
      },
      new Date('2026-11-24T18:25:00Z'),
    );
    const reopened = await loadWorkbook(fromArrayBuffer(bytes));
    expect(sheetNames(reopened)).toEqual(['Amostra', 'Metodologia e fontes']);
    const sheet = getSheet(reopened, 'Amostra');
    if (!sheet) throw new Error('Aba ausente.');
    expect(getAutoFilter(sheet)?.ref).toBe('A1:D9');
    expect(getFreezePanes(sheet)).toBe('A2');
    expect(strings.map((_, index) => getCell(sheet, index + 2, 1)?.value)).toEqual(strings);
    expect(getCell(sheet, 2, 2)?.value).toBe(12.5);
    expect(getCell(sheet, 2, 3)?.value).toBe(0.1365);
    expect(getCell(sheet, 2, 4)?.value).toBe(46350);
  });
});
