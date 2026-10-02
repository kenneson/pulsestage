"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { firstIssue, formValues, safeNextPath } from "@/lib/action-result";

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
      data: { name: parsed.data.name },
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
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: translateAuthError(error.message) };

  redirect(safeNextPath(values.next));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
