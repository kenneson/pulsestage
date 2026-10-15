"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { formValues, safeNextPath } from "@/lib/action-result";
import { isValidTimeZone } from "@/lib/datetime";
import { localeOrDefault } from "@/lib/domain/locale";
import { getRequestLocale } from "@/i18n/locale.server";
import { setLocaleCookie } from "@/i18n/cookie";
import { getMessageTranslator } from "@/i18n/server";

/** Fuso do navegador (campo escondido): vira o fuso do perfil no cadastro. */
const SIGNUP_TZ_COOKIE = "ps_signup_tz";

function browserTimeZone(formData: FormData): string | null {
  const tz = formData.get("timeZone");
  return typeof tz === "string" && tz.length <= 64 && isValidTimeZone(tz) ? tz : null;
}

/** Depois do login, o painel segue o idioma salvo no perfil. */
async function applyProfileLocale(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("profiles").select("locale").eq("id", userId).maybeSingle();
  if (data) await setLocaleCookie(localeOrDefault(data.locale));
}

export type AuthFormState = { error?: string; message?: string };

// Mensagens como chaves completas da área "auth": traduzidas com getMessageTranslator() no idioma da requisição.
const emailSchema = z.email({ error: "auth.errors.invalidEmail" });
const passwordSchema = z.string({ error: "auth.errors.passwordRequired" }).min(8, "auth.errors.passwordTooShort");

const signUpSchema = z.object({
  name: z
    .string({ error: "auth.errors.nameRequired" })
    .trim()
    .min(2, "auth.errors.nameRequired")
    .max(120, "auth.errors.nameTooLong"),
  email: emailSchema,
  password: passwordSchema,
});

const signInSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "auth.errors.passwordRequired" }).min(1, "auth.errors.passwordRequired"),
});

/** Erro do Supabase Auth (em inglês) → chave da mensagem. */
function authErrorKey(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "auth.errors.invalidCredentials";
  if (m.includes("already registered") || m.includes("already been registered")) return "auth.errors.emailTaken";
  if (m.includes("email not confirmed")) return "auth.errors.emailNotConfirmed";
  if (m.includes("rate limit")) return "errors.tooManyRequests";
  return "auth.errors.generic";
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const tr = await getMessageTranslator();
  const parsed = signUpSchema.safeParse(formValues(formData, ["name", "email", "password"] as const));
  if (!parsed.success) return { error: tr.issue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Idioma e fuso do navegador vão para o perfil (trigger handle_new_user).
      data: { name: parsed.data.name, locale: await getRequestLocale(), time_zone: browserTimeZone(formData) },
      emailRedirectTo: `${publicEnv.appUrl}/auth/callback?next=/dashboard`,
    },
  });
  if (error) return { error: tr.message(authErrorKey(error.message)) };
  if (!data.session) return { message: (await getTranslations("auth.signup"))("checkEmail") };

  redirect("/dashboard");
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = formValues(formData, ["email", "password", "next"] as const);
  const tr = await getMessageTranslator();
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return { error: tr.issue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: tr.message(authErrorKey(error.message)) };
  await applyProfileLocale(supabase, data.user.id);

  redirect(safeNextPath(values.next));
}

export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  const next = safeNextPath(formValues(formData, ["next"] as const).next);
  // Origem real da requisição (localhost, preview ou produção). O Supabase só aceita
  // redirectTo que esteja nas Redirect URLs do projeto.
  const origin = (await headers()).get("origin") ?? publicEnv.appUrl;
  // Se for o primeiro acesso, o retorno (/auth/callback) usa o fuso do navegador no perfil novo.
  const tz = browserTimeZone(formData);
  if (tz) (await cookies()).set(SIGNUP_TZ_COOKIE, tz, { path: "/", maxAge: 600, sameSite: "lax", httpOnly: true });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=google");

  redirect(data.url);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
