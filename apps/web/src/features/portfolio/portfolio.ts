import { useState } from 'react';

type Rebalance = 'hold' | 'monthly';

export interface PortfolioDraft {
  target: '10' | '15' | '20' | 'custom';
  customTarget: string;
  method: 'equal' | 'custom';
  positions: { name: string; weight: string }[];
  capital: string;
  contribution: string;
  rebalance: Rebalance;
  cost: string;
  gainTax: string;
  maxWeight: string;
}

export interface SavedPortfolio {
  positions: { name: string; weightUnits: number }[];
  capital: number;
  contribution: number;
  rebalance: Rebalance;
  costRate: number;
  gainTaxRate: number;
}

export const totalWeightUnits = 1_000_000;
const storageKey = 'moat-portfolio-v1';
const defaultDraft: PortfolioDraft = {
  target: '10',
  customTarget: '',
  method: 'equal',
  positions: [],
  capital: '',
  contribution: '0',
  rebalance: 'hold',
  cost: '0',
  gainTax: '0',
  maxWeight: '',
};

export function equalWeightUnits(count: number, index: number) {
  return Math.floor(totalWeightUnits / count) + Number(index < totalWeightUnits % count);
}

function decimalUnits(raw: string, places: number): number | null {
  const match = /^(\d+)(?:[.,](\d+))?$/.exec(raw.trim());
  if (!match?.[1] || (match[2]?.length ?? 0) > places) return null;
  const units = Number(match[1]) * 10 ** places + Number((match[2] ?? '').padEnd(places, '0'));
  return Number.isSafeInteger(units) ? units : null;
}

export function portfolioTargetSize(draft: PortfolioDraft) {
  const target = decimalUnits(draft.target === 'custom' ? draft.customTarget : draft.target, 0);
  return target !== null && target >= 1 && target <= 50 ? target : null;
}

export function validatePortfolio(draft: PortfolioDraft): {
  portfolio: SavedPortfolio | null;
  errors: string[];
  weightUnits: number | null;
} {
  const errors: string[] = [];
  const target = portfolioTargetSize(draft);
  const count = draft.positions.length;
  if (target === null) {
    errors.push('Informe uma quantidade de companhias entre 1 e 50.');
  } else if (target !== count) {
    errors.push(`Selecione ${target} ${target === 1 ? 'companhia' : 'companhias'} para salvar.`);
  }

  const capital = decimalUnits(draft.capital, 2);
  const contribution = decimalUnits(draft.contribution, 2);
  const cost = decimalUnits(draft.cost, 4);
  const gainTax = decimalUnits(draft.gainTax, 4);
  const maximum = draft.maxWeight.trim() ? decimalUnits(draft.maxWeight, 4) : totalWeightUnits;
  if (capital === null || capital <= 0) errors.push('Informe capital inicial positivo em reais.');
  if (contribution === null) errors.push('Informe o aporte em reais, com até duas casas decimais.');
  if (cost === null || cost >= totalWeightUnits)
    errors.push('O custo deve estar entre 0% e menos de 100%.');
  if (gainTax === null || gainTax >= totalWeightUnits)
    errors.push('O tributo deve estar entre 0% e menos de 100%.');
  if (maximum === null || maximum <= 0 || maximum > totalWeightUnits) {
    errors.push('O limite por companhia deve ser positivo e de até 100%.');
  }

  const weights = draft.positions.map(({ weight }, index) =>
    draft.method === 'equal' ? equalWeightUnits(count, index) : decimalUnits(weight, 4),
  );
  const complete = weights.every(
    (weight) => weight !== null && weight > 0 && weight <= totalWeightUnits,
  );
  const weightUnits = complete
    ? weights.reduce<number>((sum, weight) => sum + (weight ?? 0), 0)
    : null;
  if (!complete || (count > 0 && weightUnits !== totalWeightUnits)) {
    errors.push('Os pesos devem ser positivos e somar exatamente 100%.');
  }
  if (maximum !== null && weights.some((weight) => weight !== null && weight > maximum)) {
    errors.push('Uma ou mais posições excedem o limite por companhia.');
  }
  const names = new Set(draft.positions.map(({ name }) => name));
  if (names.size !== count || draft.positions.some(({ name }) => !name.trim())) {
    errors.push('Escolha companhias diferentes para cada posição.');
  }

  const portfolio =
    errors.length === 0 &&
    capital !== null &&
    contribution !== null &&
    cost !== null &&
    gainTax !== null
      ? {
          positions: draft.positions.map(({ name }, index) => ({
            name,
            weightUnits: weights[index] ?? 0,
          })),
          capital: capital / 100,
          contribution: contribution / 100,
          rebalance: draft.rebalance,
          costRate: cost / totalWeightUnits,
          gainTaxRate: gainTax / totalWeightUnits,
        }
      : null;
  return { portfolio, errors, weightUnits };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 250;
}

function isDraft(value: unknown): value is PortfolioDraft {
  return (
    isObject(value) &&
    (value.target === '10' ||
      value.target === '15' ||
      value.target === '20' ||
      value.target === 'custom') &&
    (value.method === 'equal' || value.method === 'custom') &&
    (value.rebalance === 'hold' || value.rebalance === 'monthly') &&
    ['customTarget', 'capital', 'contribution', 'cost', 'gainTax', 'maxWeight'].every((key) =>
      isText(value[key]),
    ) &&
    Array.isArray(value.positions) &&
    value.positions.length <= 50 &&
    value.positions.every((row: unknown) => isObject(row) && isText(row.name) && isText(row.weight))
  );
}

function readDraft(): PortfolioDraft | null {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
    if (isObject(stored) && stored.schemaVersion === '1.0.0' && isDraft(stored.draft)) {
      return stored.draft;
    }
  } catch {
    // O acesso ao armazenamento depende do navegador.
  }
  return null;
}

export function readSavedPortfolio() {
  const draft = readDraft();
  return draft === null ? null : validatePortfolio(draft).portfolio;
}

export function useSavedPortfolio() {
  const [draft, setDraft] = useState(() => readDraft() ?? { ...defaultDraft, positions: [] });
  function save() {
    if (validatePortfolio(draft).portfolio === null) return false;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ schemaVersion: '1.0.0', draft }));
      return true;
    } catch {
      return false;
    }
  }
  return { draft, setDraft, save };
}
