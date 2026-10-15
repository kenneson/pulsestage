"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LOCALES } from "@/lib/domain/locale";
import { setLocaleCookie } from "@/i18n/cookie";
import { fail, ok, type ActionResult } from "@/lib/action-result";

/** Seletor de idioma: cookie e, com login, o perfil (padrão das sessões novas e dos e-mails). */
export async function setLocaleAction(raw: unknown): Promise<ActionResult> {
  const parsed = z.enum(LOCALES).safeParse(raw);
  if (!parsed.success) return fail("invalid_locale");
  await setLocaleCookie(parsed.data);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ locale: parsed.data }).eq("id", user.id);
  return ok(null);
}
