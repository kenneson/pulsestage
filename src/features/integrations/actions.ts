"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getMessageTranslator } from "@/i18n/server";

// Consentimento OAuth (Claude, ChatGPT e outros clientes MCP) e acessos concedidos.

const authorizationIdSchema = z.string().trim().min(1).max(200);

async function decide(formData: FormData, approve: boolean): Promise<never> {
  const parsed = authorizationIdSchema.safeParse(formData.get("authorization_id"));
  if (!parsed.success) redirect("/oauth/consent?erro=pedido");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${parsed.data}`)}`);

  const { data, error } = approve
    ? await supabase.auth.oauth.approveAuthorization(parsed.data, { skipBrowserRedirect: true })
    : await supabase.auth.oauth.denyAuthorization(parsed.data, { skipBrowserRedirect: true });
  if (error || !data?.redirect_url) redirect("/oauth/consent?erro=expirado");
  revalidatePath("/dashboard/integracoes");
  // Volta para o assistente (com o código de autorização ou com a recusa).
  redirect(data.redirect_url);
}

export async function approveAuthorizationAction(formData: FormData): Promise<void> {
  await decide(formData, true);
}

export async function denyAuthorizationAction(formData: FormData): Promise<void> {
  await decide(formData, false);
}

export async function revokeGrantAction(clientId: string): Promise<ActionResult> {
  const tr = await getMessageTranslator();
  const parsed = z.string().trim().min(1).max(200).safeParse(clientId);
  if (!parsed.success) return fail(tr.message("errors.invalidData"));
  const supabase = await createClient();
  const { error } = await supabase.auth.oauth.revokeGrant({ clientId: parsed.data });
  if (error) return fail(tr.message("integrations.errors.revokeFailed"));
  revalidatePath("/dashboard/integracoes");
  return ok(null);
}

/** "Entrar com outra conta" no consentimento: sai e volta ao mesmo pedido depois do login. */
export async function switchAccountAction(formData: FormData): Promise<void> {
  const parsed = authorizationIdSchema.safeParse(formData.get("authorization_id"));
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(
    parsed.success
      ? `/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${parsed.data}`)}`
      : "/login",
  );
}
