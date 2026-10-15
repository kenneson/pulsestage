// Filtro de palavrões por idioma da sessão (português, espanhol latino e inglês). Regra pura (sem I/O).

import type { Locale } from "./locale.ts";
// Usado na nuvem de palavras, nas respostas abertas e nas perguntas da plateia: o que for barrado
// é gravado oculto (o palestrante vê e pode liberar), sem avisar quem enviou, para não ensinar a burlar.
// Listas curtas e conservadoras (detalhes abaixo).

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };

type Lang = "pt" | "es" | "en";
type WordList = { exact: string[]; prefix: string[] };

/**
 * exact: barra só a palavra inteira. prefix: começos que pegam variações ("merdinha", "fodase", "putaria").
 * Palavras com outro sentido comum ficam de fora: em português "rola", "pau", "veado"; em espanhol "pico"
 * ("y pico"), "concha", "polla" (loteria no Chile), "coger" (comum na Colômbia), "zorra", "verga" só inteira
 * (o começo pegaria "vergüenza"), "pinche" (grampo no Chile) e "hp" (marca de impressora). Em inglês, palavras curtas só inteiras ("ass" não barra "class").
 */
const LISTS: Record<Lang, WordList> = {
  pt: {
    exact: [
      "cu", "cus", "cuzao", "cuzinho", "crl", "krl", "pqp", "vsf", "vtnc", "tnc", "fdp", "porra", "porras", "caralho",
      "caralhos", "merda", "merdas", "bosta", "bostas", "puta", "putas", "puto", "putos", "buceta", "boceta", "xoxota",
      "xereca", "piroca", "pica", "punheta", "siririca", "cacete", "arrombado", "arrombada", "desgracado", "desgracada",
      "vagabunda", "vadia", "corno", "escroto", "escrota", "babaca", "otario", "otaria", "retardado", "retardada",
    ],
    prefix: ["caralh", "porra", "merd", "fod", "fud", "puta", "puto", "bucet", "bocet", "punhet", "arromb", "vagabund"],
  },
  es: {
    exact: [
      "puta", "putas", "puto", "putos", "mierda", "mierdas", "carajo", "carajos", "verga", "vergas", "pendejo", "pendeja",
      "pendejos", "pendejas", "culiao", "culiaos", "culiado", "culiada", "culiados", "weon", "weona", "weones", "weonas",
      "hueon", "hueona", "huevon", "huevona", "huevones", "aweonao", "aweonado", "conchetumare", "conchetumadre",
      "conchesumadre", "ctm", "csm", "chucha", "maricon", "maricones", "marica", "maricas", "gonorrea", "gonorreas",
      "malparido", "malparida", "malparidos", "hijueputa", "hijueputas", "hdp", "cabron", "cabrona", "cabrones",
      "culo", "culos", "pija", "pajero", "pajera", "chingada", "chingado", "chingar", "imbecil", "imbeciles",
      "retrasado", "retrasada", "estupido", "estupida",
    ],
    prefix: ["mierd", "hijueput", "hijodeput", "malparid", "gonorre", "conchetu", "conchesu", "pendej", "chingad"],
  },
  en: {
    exact: [
      "fuck", "shit", "bitch", "asshole", "cunt", "pussy", "bastard", "motherfucker", "whore", "slut",
      "bullshit", "dumbass", "jackass", "dipshit", "fag", "faggot", "retard", "twat", "wanker",
    ],
    prefix: ["fuck", "shit", "bitch", "nigg", "fagg", "motherfuck"],
  },
};

/** Só em sessões em inglês: curtas demais para valer em outros idiomas. */
const EN_ONLY_EXACT = ["ass", "asses", "dick", "dicks", "cock", "cocks", "tits", "piss"];

/** Palavrões em inglês aparecem em qualquer plateia; os demais seguem o idioma da sessão. */
const LANGS_BY_LOCALE: Record<Locale, Lang[]> = { "pt-BR": ["pt", "en"], "es-419": ["es", "en"], "en-US": ["en"] };

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[0-9@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]+/g, " ")
    .trim();
}

/** "poooorra" → "porra" (3 ou mais letras iguais viram uma). */
const collapseRuns = (word: string) => word.replace(/(.)\1{2,}/g, "$1");
/** "porrrra" → "pora" (todas as repetições), comparado com a lista na mesma forma. */
const collapseAll = (word: string) => word.replace(/(.)\1+/g, "$1");

type Compiled = { exact: Set<string>; collapsed: Set<string>; prefix: string[] };

function compile(locale: Locale): Compiled {
  const langs = LANGS_BY_LOCALE[locale];
  const exact = [...langs.flatMap((l) => LISTS[l].exact), ...(locale === "en-US" ? EN_ONLY_EXACT : [])];
  return {
    exact: new Set(exact),
    collapsed: new Set(exact.map(collapseAll)),
    prefix: langs.flatMap((l) => LISTS[l].prefix),
  };
}

const COMPILED: Record<Locale, Compiled> = {
  "pt-BR": compile("pt-BR"),
  "es-419": compile("es-419"),
  "en-US": compile("en-US"),
};

/** Junta letras soltas: "p o r r a" ou "p.o.r.r.a" vira "porra". */
function words(text: string): string[] {
  const tokens = normalize(text).split(" ").filter(Boolean);
  const out: string[] = [];
  let run = "";
  for (const token of tokens) {
    if (token.length === 1) {
      run += token;
      continue;
    }
    if (run) out.push(run);
    run = "";
    out.push(token);
  }
  if (run) out.push(run);
  return out;
}

function isBad(word: string, list: Compiled): boolean {
  const forms = [word, collapseRuns(word)];
  if (forms.some((w) => list.exact.has(w)) || list.collapsed.has(collapseAll(word))) return true;
  return forms.some((w) => list.prefix.some((p) => w.startsWith(p)));
}

export function containsProfanity(text: string, locale: Locale = "pt-BR"): boolean {
  const list = COMPILED[locale];
  return words(text).some((w) => isBad(w, list));
}
