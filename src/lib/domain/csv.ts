// CSV para o Excel em português: separador ";", BOM UTF-8 e proteção contra injeção de fórmula.

export type CsvCell = string | number | boolean | null | undefined;

/** Respostas da plateia são texto livre: "=HYPERLINK(...)" não pode virar fórmula ao abrir no Excel. */
function neutralizeFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

/** Sim/não no idioma de quem exporta. */
export type CsvLabels = { yes: string; no: string };
const PT_LABELS: CsvLabels = { yes: "sim", no: "não" };

export function csvCell(value: CsvCell, labels: CsvLabels = PT_LABELS): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value).replace(".", ",") : "";
  if (typeof value === "boolean") return value ? labels.yes : labels.no;
  const text = neutralizeFormula(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[], labels: CsvLabels = PT_LABELS): string {
  const lines = [header, ...rows].map((row) => row.map((cell) => csvCell(cell, labels)).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Nome de arquivo seguro a partir do título da sessão. */
export function csvFileName(title: string, suffix: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "sessao"}-${suffix}.csv`;
}
