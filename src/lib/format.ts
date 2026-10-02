const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("pt-BR");

export function formatScore(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? decimal.format(value) : "—";
}

export function formatPercent(rate: number | null | undefined): string {
  return typeof rate === "number" && Number.isFinite(rate) ? `${Math.round(rate * 100)}%` : "—";
}

export function formatInt(value: number): string {
  return integer.format(value);
}

export function formatSeconds(ms: number | null | undefined): string {
  return typeof ms === "number" && Number.isFinite(ms) ? `${decimal.format(ms / 1000)} s` : "—";
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatInt(count)} ${count === 1 ? singular : pluralForm}`;
}
