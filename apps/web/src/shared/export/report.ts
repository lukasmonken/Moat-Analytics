export type ReportValue = string | number | Date | null;
export type ReportFormat = 'integer' | 'number' | 'currency' | 'percent' | 'date' | 'datetime';

export interface ReportSheet {
  name: string;
  columns: readonly { label: string; format?: ReportFormat; width?: number }[];
  rows: readonly (readonly ReportValue[])[];
}

export interface WorkbookReport {
  sheets: ReportSheet[];
  notes: readonly (readonly [string, ReportValue])[];
}
