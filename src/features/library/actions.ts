"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnedSession } from "@/lib/data/sessions";
import { isEditable } from "@/lib/domain/session";
import { fail, isUuid, ok, type ActionResult } from "@/lib/action-result";
import { getMessageTranslator } from "@/i18n/server";
import { messageKey } from "@/lib/domain/message-key";
import { cloneSession, copyInteractions } from "./core";
import { getSpeakerProfile } from "@/lib/data/profile";
import { zonedToUtcIso } from "@/lib/datetime";

const MAX_COPY = 50;

const copySchema = z.object({
  targetSessionId: z.uuid({ error: "builder.library.errors.invalidSession" }),
  interactionIds: z.array(z.uuid()).min(1, "builder.library.errors.chooseAtLeastOne").max(MAX_COPY, messageKey("builder.library.errors.maxPerCopy", { max: MAX_COPY })),
});

/** "Usar em uma sessão" / "Da biblioteca": copia perguntas para o fim do roteiro. */
export async function copyToSessionAction(raw: unknown): Promise<ActionResult<{ copied: number }>> {
  const [tr, t] = await Promise.all([getMessageTranslator(), getTranslations("builder.library.errors")]);
  const parsed = copySchema.safeParse(raw);
  if (!parsed.success) return fail(tr.issue(parsed.error));
  const { targetSessionId, interactionIds } = parsed.data;

  const supabase = await createClient();
  const target = await getOwnedSession(supabase, targetSessionId);
  if (!target) return fail(t("sessionNotFound"));
  if (!isEditable(target.status)) return fail(t("sessionEnded"));

  try {
    const copied = await copyInteractions(supabase, [...new Set(interactionIds)], targetSessionId);
    if (copied === 0) return fail(t("questionsNotFound"));
    revalidatePath(`/dashboard/sessions/${targetSessionId}`, "layout");
    return ok({ copied });
  } catch {
    return fail(t("copyFailed"));
  }
}

const duplicateSchema = z.object({
  title: z.string().trim().min(1, "builder.library.errors.titleRequired").max(200, "builder.library.errors.titleTooLong").optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "builder.library.errors.invalidDate")
    .optional()
    .or(z.literal("")),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "builder.library.errors.invalidTime")
    .optional()
    .or(z.literal("")),
});

/**
 * Nova sessão em rascunho com as mesmas informações, perguntas, slides, pesquisa e prêmios do sorteio.
 * Nome e data opcionais (sem nome: "… (cópia)"; sem data: sem agendamento).
 */
export async function duplicateSessionAction(sessionId: string, raw: unknown = {}): Promise<ActionResult> {
  const [tr, t] = await Promise.all([getMessageTranslator(), getTranslations("builder.library")]);
  if (!isUuid(sessionId)) return fail(t("errors.invalidSession"));
  const options = duplicateSchema.safeParse(raw);
  if (!options.success) return fail(tr.issue(options.error));
  const supabase = await createClient();
  const source = await getOwnedSession(supabase, sessionId);
  if (!source) return fail(t("errors.sessionNotFound"));

  let scheduledAt: string | null = null;
  if (options.data.date) {
    scheduledAt = zonedToUtcIso(options.data.date, options.data.time || "00:00", (await getSpeakerProfile()).timeZone);
    if (!scheduledAt) return fail(t("errors.invalidDateTime"));
  }

  const cloned = await cloneSession(supabase, source, {
    // Sufixo no idioma do painel de quem duplica.
    title: options.data.title ?? t("copySuffix", { title: source.title }).slice(0, 200),
    scheduledAt,
  });
  if (!cloned.ok) return fail(tr.message(cloned.error));
  const createdId = cloned.data.id;

  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/sessions/${createdId}`);
}
