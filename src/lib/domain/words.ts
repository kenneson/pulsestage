// Normalização simples para nuvem de palavras (sem NLP).

const STOPWORDS = new Set(
  (
    "a à ao aos as às o os um uma uns umas de da do das dos dum duma em na no nas nos num numa " +
    "por pela pelo pelas pelos para pra pro com sem sob sobre entre até após ante e é ou mas nem que se " +
    "como quando onde quem qual quais porque pois já não sim mais menos muito muita muitos muitas pouco " +
    "eu tu ele ela nós vós eles elas me te lhe nos vos lhes meu minha meus minhas seu sua seus suas " +
    "este esta estes estas esse essa esses essas aquele aquela isso isto aquilo ser estar ter haver " +
    "foi era são está estão tem têm há também só ainda bem mal tipo coisa coisas acho"
  ).split(/\s+/),
);

const MAX_TERM_LENGTH = 40;
const MAX_TOKENS = 3;

/**
 * Normaliza a resposta: minúsculas, sem pontuação, espaços colapsados, sem stopwords.
 * Acentos são preservados ("ansiedade" ≠ "ansiedáde" é raro; "não" ≠ "nao" importa).
 * Retorna null quando nada relevante sobra.
 */
export function normalizeTerm(raw: string): string | null {
  const tokens = raw
    .normalize("NFC")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));

  if (tokens.length === 0) return null;
  const term = tokens.slice(0, MAX_TOKENS).join(" ").slice(0, MAX_TERM_LENGTH).trim();
  return term.length > 0 ? term : null;
}
