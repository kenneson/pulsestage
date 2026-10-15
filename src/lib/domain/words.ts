// Normalização simples para nuvem de palavras (sem NLP), com as palavras vazias do idioma da sessão.

import type { Locale } from "./locale.ts";

const words = (list: string) => new Set(list.split(/\s+/));

/** Palavras que não entram na nuvem, por idioma da sessão. */
const STOPWORDS: Record<Locale, Set<string>> = {
  "pt-BR": words(
    "a à ao aos as às o os um uma uns umas de da do das dos dum duma em na no nas nos num numa " +
      "por pela pelo pelas pelos para pra pro com sem sob sobre entre até após ante e é ou mas nem que se " +
      "como quando onde quem qual quais porque pois já não sim mais menos muito muita muitos muitas pouco " +
      "eu tu ele ela nós vós eles elas me te lhe nos vos lhes meu minha meus minhas seu sua seus suas " +
      "este esta estes estas esse essa esses essas aquele aquela isso isto aquilo ser estar ter haver " +
      "foi era são está estão tem têm há também só ainda bem mal tipo coisa coisas acho",
  ),
  "es-419": words(
    "a al ante bajo con contra de del desde durante en entre hacia hasta para por según sin sobre tras " +
      "el la los las lo un una unos unas y e o u ni que se no sí si más menos muy mucho mucha muchos muchas poco " +
      "como cuando donde quien quienes cual cuales porque pues ya también solo sólo aún todavía bien mal pero " +
      "yo tú él ella usted nosotros nosotras ustedes ellos ellas me te le nos les mi mis tu tus su sus " +
      "este esta estos estas ese esa esos esas aquel aquella eso esto aquello ser estar tener haber " +
      "es son está están fue era hay tiene tienen cosa cosas creo tipo",
  ),
  "en-US": words(
    "a an the of to in on at by for with without from into about over under as and or but nor so if " +
      "not no yes more less very much many few how when where who whom which what why because " +
      "is are was were be been being am do does did have has had i you he she it we they me him her us them " +
      "my your his its our their this that these those there here also just only still well thing things " +
      "think like really",
  ),
};

const MAX_TERM_LENGTH = 40;
const MAX_TOKENS = 3;

/**
 * Normaliza a resposta: minúsculas, sem pontuação, espaços colapsados, sem stopwords.
 * Acentos são preservados ("ansiedade" ≠ "ansiedáde" é raro; "não" ≠ "nao" importa).
 * Retorna null quando nada relevante sobra.
 */
export function normalizeTerm(raw: string, locale: Locale = "pt-BR"): string | null {
  const stopwords = STOPWORDS[locale];
  const tokens = raw
    .normalize("NFC")
    .toLocaleLowerCase(locale)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length > 0 && !stopwords.has(t));

  if (tokens.length === 0) return null;
  const term = tokens.slice(0, MAX_TOKENS).join(" ").slice(0, MAX_TERM_LENGTH).trim();
  return term.length > 0 ? term : null;
}
