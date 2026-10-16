import { DEFAULT_LOCALE, type Locale } from "@/lib/domain/locale";

// Números no idioma de quem lê. Componentes passam useLocale() (cliente) ou getLocale() (servidor).

const decimals = new Map<string, Intl.NumberFormat>();
const integers = new Map<string, Intl.NumberFormat>();

function decimal(locale: Locale) {
  let f = decimals.get(locale);
  if (!f) decimals.set(locale, (f = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })));
  return f;
}

function integer(locale: Locale) {
  let f = integers.get(locale);
  if (!f) integers.set(locale, (f = new Intl.NumberFormat(locale)));
  return f;
}

export function formatScore(value: number | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  return typeof value === "number" && Number.isFinite(value) ? decimal(locale).format(value) : "—";
}

export function formatPercent(rate: number | null | undefined): string {
  return typeof rate === "number" && Number.isFinite(rate) ? `${Math.round(rate * 100)}%` : "—";
}

export function formatInt(value: number, locale: Locale = DEFAULT_LOCALE): string {
  return integer(locale).format(value);
}

export function formatSeconds(ms: number | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  return typeof ms === "number" && Number.isFinite(ms) ? `${decimal(locale).format(ms / 1000)} s` : "—";
}
