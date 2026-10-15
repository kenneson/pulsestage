import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// As três traduções têm as mesmas chaves e os mesmos {parâmetros}; nenhuma fica vazia.

const ROOT = join(import.meta.dirname, "..", "messages");
const LOCALES = ["pt-BR", "es-419", "en-US"] as const;

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

function load(locale: string): Map<string, string> {
  const all = new Map<string, string>();
  for (const file of readdirSync(join(ROOT, locale)).filter((f) => f.endsWith(".json"))) {
    const tree = JSON.parse(readFileSync(join(ROOT, locale, file), "utf8")) as Tree;
    for (const [k, v] of flatten(tree, file.replace(/\.json$/, ""))) all.set(k, v);
  }
  return all;
}

/** Nomes dos argumentos do ICU ({name}, {count, plural, ...}, inclusive dentro dos ramos) e das tags (<b>...</b>). */
function argsOf(message: string): string[] {
  const names = new Set<string>();
  // Lê o conteúdo até o "}" que fecha o ramo atual; devolve a posição depois dele.
  function content(i: number): number {
    while (i < message.length) {
      const c = message[i];
      if (c === "}") return i + 1;
      if (c === "{") i = argument(i + 1);
      else i++;
    }
    return i;
  }
  function argument(i: number): number {
    const end = message.slice(i).search(/[,}]/);
    if (end < 0) return message.length;
    names.add(`{${message.slice(i, i + end).trim()}}`);
    i += end;
    if (message[i] === "}") return i + 1;
    const typeEnd = message.slice(i + 1).search(/[,}]/);
    const type = message.slice(i + 1, i + 1 + typeEnd).trim();
    i += 1 + typeEnd;
    if (message[i] === "}") return i + 1;
    if (type === "plural" || type === "select" || type === "selectordinal") {
      // Ramos: "one {…} other {…}" até o "}" do argumento.
      i++;
      while (i < message.length && message[i] !== "}") {
        const open = message.indexOf("{", i);
        const close = message.indexOf("}", i);
        if (open < 0 || (close >= 0 && close < open)) return close + 1;
        i = content(open + 1);
      }
      return i + 1;
    }
    return content(i + 1);
  }
  content(0);
  for (const m of message.matchAll(/<([A-Za-z][\w]*)>/g)) names.add(`<${m[1]}>`);
  return [...names].sort();
}

const messages = Object.fromEntries(LOCALES.map((l) => [l, load(l)])) as Record<(typeof LOCALES)[number], Map<string, string>>;

test("espanhol e inglês têm exatamente as chaves do português", () => {
  const base = [...messages["pt-BR"].keys()].sort();
  for (const locale of ["es-419", "en-US"] as const) {
    const keys = [...messages[locale].keys()].sort();
    const missing = base.filter((k) => !messages[locale].has(k));
    const extra = keys.filter((k) => !messages["pt-BR"].has(k));
    assert.deepEqual({ locale, missing, extra }, { locale, missing: [], extra: [] });
  }
});

test("argsOf entende plural e ramos", () => {
  assert.deepEqual(argsOf("{count, plural, one {# pessoa} other {# pessoas}} em {city}"), ["{city}", "{count}"]);
  assert.deepEqual(argsOf("Veja o <link>guia</link>, {name}"), ["<link>", "{name}"]);
  assert.deepEqual(argsOf("{n, plural, =0 {nada} other {{who} e mais #}}"), ["{n}", "{who}"]);
});

test("os mesmos parâmetros e tags em todos os idiomas, e nenhuma mensagem vazia", () => {
  const problems: string[] = [];
  for (const [key, pt] of messages["pt-BR"]) {
    for (const locale of LOCALES) {
      const text = messages[locale].get(key);
      if (text === undefined) continue;
      if (!text.trim()) problems.push(`${locale} ${key}: vazia`);
      if (argsOf(text).join() !== argsOf(pt).join()) problems.push(`${locale} ${key}: ${argsOf(text)} ≠ ${argsOf(pt)}`);
    }
  }
  assert.deepEqual(problems, []);
});
