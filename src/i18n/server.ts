import "server-only";
import { getLocale, getTranslations } from "next-intl/server";
import type { z } from "zod";
import type { Locale } from "@/lib/domain/locale";
import { translateAnyMessage, type AnyTranslator } from "./errors";

/**
 * Para Server Actions e Route Handlers: traduz mensagens que viajam como chave no idioma da requisição, ou no
 * `locale` dado (o da sessão, para a plateia). Aceita chaves da área "errors" ("validation.questionRequired",
 * "core.joinCodeTaken") e chaves completas de outra área ("session.errors.titleRequired"). Texto que não é
 * chave conhecida vira "Dados inválidos.".
 *
 *   const tr = await getMessageTranslator();
 *   if (!parsed.success) return fail(tr.issue(parsed.error));
 *   if (!created.ok) return fail(tr.message(created.error));
 */
export async function getMessageTranslator(locale?: Locale) {
  const t = await getTranslations({ locale: locale ?? (await getLocale()) });
  const translate = (message: string | null | undefined) => translateAnyMessage(t as unknown as AnyTranslator, message);
  return {
    message: translate,
    issue: (error: z.ZodError) => translate(error.issues[0]?.message),
  };
}
