"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { firstIssue, formValues, safeNextPath } from "@/lib/action-result";
import { isValidTimeZone } from "@/lib/datetime";
import { localeOrDefault } from "@/lib/domain/locale";
import { getRequestLocale } from "@/i18n/locale.server";
import { setLocaleCookie } from "@/i18n/cookie";

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

const emailSchema = z.email({ error: "Informe um e-mail válido." });
const passwordSchema = z.string({ error: "Informe a senha." }).min(8, "A senha precisa ter pelo menos 8 caracteres.");

const signUpSchema = z.object({
  name: z.string({ error: "Informe seu nome." }).trim().min(2, "Informe seu nome.").max(120),
  email: emailSchema,
  password: passwordSchema,
});

const signInSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Informe a senha." }).min(1, "Informe a senha."),
});

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Esse e-mail já tem uma conta.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  return "Não foi possível concluir. Tente novamente.";
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(formValues(formData, ["name", "email", "password"] as const));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

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
  if (error) return { error: translateAuthError(error.message) };
  if (!data.session) return { message: "Conta criada! Confira seu e-mail para confirmar o cadastro." };

  redirect("/dashboard");
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = formValues(formData, ["email", "password", "next"] as const);
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: translateAuthError(error.message) };
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
