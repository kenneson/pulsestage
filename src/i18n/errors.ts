import { parseMessageKey } from "@/lib/domain/message-key";

/** Um `t` qualquer do next-intl (servidor ou cliente). Chaves dinâmicas: conferidas com `has` antes de traduzir. */
export type AnyTranslator = {
  (key: never, values?: never): string;
  has(key: never): boolean;
};
/** Mesmo tipo, para o `t` da área "errors". */
export type ErrorsTranslator = AnyTranslator;

type Loose = { (key: string, values?: Record<string, string>): string; has(key: string): boolean };

/**
 * Traduz uma mensagem vinda das regras puras ("validation.questionRequired", "verify.needResponders|min=5")
 * com o `t` da área "errors". Mensagem que não é chave conhecida (ex.: padrão do Zod) vira "Dados inválidos.".
 */
export function translateMessage(t: ErrorsTranslator, message: string | null | undefined): string {
  const loose = t as unknown as Loose;
  const parsed = message ? parseMessageKey(message) : null;
  if (parsed && loose.has(parsed.key)) return loose(parsed.key, parsed.params);
  return loose("invalidData");
}

/**
 * Igual, com o `t` da raiz (sem área): aceita chaves completas ("session.errors.titleRequired") e, sem área,
 * as da área "errors" ("validation.questionRequired", "core.joinCodeTaken").
 */
export function translateAnyMessage(root: AnyTranslator, message: string | null | undefined): string {
  const loose = root as unknown as Loose;
  const parsed = message ? parseMessageKey(message) : null;
  if (parsed) {
    if (loose.has(parsed.key)) return loose(parsed.key, parsed.params);
    if (loose.has(`errors.${parsed.key}`)) return loose(`errors.${parsed.key}`, parsed.params);
  }
  return loose("errors.invalidData");
}
