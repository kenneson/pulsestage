// Filtro de palavrões (português e inglês). Regra pura (sem I/O).
// Usado na nuvem de palavras, nas respostas abertas e nas perguntas da plateia: o que for barrado
// é gravado oculto (o palestrante vê e pode liberar), sem avisar quem enviou, para não ensinar a burlar.
// Lista curta e conservadora: palavras com outro sentido comum (ex.: "rola", "pau", "veado") ficam de fora.

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };

/** Palavras que barram só quando aparecem inteiras. */
const EXACT = [
  "cu", "cus", "cuzao", "cuzinho", "crl", "krl", "pqp", "vsf", "vtnc", "tnc", "fdp", "porra", "porras", "caralho",
  "caralhos", "merda", "merdas", "bosta", "bostas", "puta", "putas", "puto", "putos", "buceta", "boceta", "xoxota",
  "xereca", "piroca", "pica", "punheta", "siririca", "cacete", "arrombado", "arrombada", "desgracado", "desgracada",
  "vagabunda", "vadia", "corno", "escroto", "escrota", "babaca", "otario", "otaria", "retardado", "retardada",
  "fuck", "shit", "bitch", "asshole", "cunt", "pussy", "bastard", "motherfucker", "whore", "slut",
];

/** Começos de palavra que barram (pegam variações como "merdinha", "fodase", "putaria"). */
const PREFIX = [
  "caralh", "porra", "merd", "fod", "fud", "puta", "puto", "bucet", "bocet", "punhet", "arromb", "vagabund",
  "fuck", "shit", "bitch", "nigg", "fagg",
];

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

const EXACT_SET = new Set(EXACT);
const EXACT_COLLAPSED = new Set(EXACT.map(collapseAll));

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

function isBad(word: string): boolean {
  const forms = [word, collapseRuns(word)];
  if (forms.some((w) => EXACT_SET.has(w)) || EXACT_COLLAPSED.has(collapseAll(word))) return true;
  return forms.some((w) => PREFIX.some((p) => w.startsWith(p)));
}

export function containsProfanity(text: string): boolean {
  return words(text).some(isBad);
}
