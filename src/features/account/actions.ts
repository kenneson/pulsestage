"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidTimeZone } from "@/lib/datetime";
import { firstIssue, formValues, fail, ok, type ActionResult } from "@/lib/action-result";

export type AccountFormState = { error?: string; success?: string };

const AVATAR_BUCKET = "avatars";
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function refresh() {
  revalidatePath("/dashboard", "layout");
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

const profileSchema = z.object({
  name: z.string({ error: "Informe seu nome." }).trim().min(2, "Informe seu nome.").max(120, "Nome muito longo."),
  bio: z.string().trim().max(400, "A mini-bio pode ter até 400 caracteres.").optional(),
});

export async function updateProfileAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const parsed = profileSchema.safeParse(formValues(formData, ["name", "bio"] as const));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ name: parsed.data.name, bio: parsed.data.bio ?? null })
    .eq("id", user.id);
  if (error) return { error: "Não foi possível salvar o perfil." };
  refresh();
  return { success: "Perfil salvo." };
}

/** Remove arquivos antigos da pasta do usuário (mantém `keep`, se informado). */
async function cleanAvatarFolder(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, keep?: string) {
  const { data } = await supabase.storage.from(AVATAR_BUCKET).list(userId);
  const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((path) => path !== keep);
  if (old.length > 0) await supabase.storage.from(AVATAR_BUCKET).remove(old);
}

export async function uploadAvatarAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha uma imagem." };
  const ext = AVATAR_TYPES[file.type];
  if (!ext) return { error: "Use uma imagem PNG, JPG ou WebP." };
  if (file.size > AVATAR_MAX_BYTES) return { error: "A imagem pode ter até 2 MB." };

  const { supabase, user } = await requireUser();
  // Nome novo a cada envio: evita que navegador ou CDN mostrem a foto antiga.
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const uploaded = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploaded.error) return { error: "Não foi possível enviar a imagem." };

  const publicUrl = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
  if (error) return { error: "Não foi possível salvar a foto." };

  await cleanAvatarFolder(supabase, user.id, path);
  refresh();
  return { success: "Foto atualizada." };
}

export async function removeAvatarAction(): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  await cleanAvatarFolder(supabase, user.id);
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return fail("Não foi possível remover a foto.");
  refresh();
  return ok(null);
}

// ---------------------------------------------------------------------------
// Preferências
// ---------------------------------------------------------------------------

const preferencesSchema = z.object({
  timeZone: z.string().refine(isValidTimeZone, "Fuso horário inválido."),
  defaultSurveyTemplateId: z.uuid({ error: "Modelo de pesquisa inválido." }).optional(),
  defaultDuration: z.coerce.number().int().min(1, "Duração inválida.").max(1440, "Duração inválida.").optional(),
});

export async function updatePreferencesAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const parsed = preferencesSchema.safeParse(
    formValues(formData, ["timeZone", "defaultSurveyTemplateId", "defaultDuration"] as const),
  );
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { supabase, user } = await requireUser();

  const templateId = parsed.data.defaultSurveyTemplateId ?? null;
  if (templateId) {
    // RLS: só aparece se for da plataforma ou do próprio speaker.
    const { data } = await supabase.from("survey_templates").select("id").eq("id", templateId).maybeSingle();
    if (!data) return { error: "Modelo de pesquisa inválido." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      time_zone: parsed.data.timeZone,
      default_survey_template_id: templateId,
      default_duration_minutes: parsed.data.defaultDuration ?? null,
    })
    .eq("id", user.id);
  if (error) return { error: "Não foi possível salvar as preferências." };
  refresh();
  return { success: "Preferências salvas." };
}

// ---------------------------------------------------------------------------
// Segurança
// ---------------------------------------------------------------------------

const passwordSchema = z
  .object({
    password: z.string({ error: "Informe a nova senha." }).min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72),
    confirm: z.string({ error: "Confirme a nova senha." }),
  })
  .refine((v) => v.password === v.confirm, { error: "As senhas não conferem." });

export async function changePasswordAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const parsed = passwordSchema.safeParse(formValues(formData, ["password", "confirm"] as const));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("different from the old")) return { error: "A nova senha precisa ser diferente da atual." };
    if (message.includes("reauthentication")) return { error: "Por segurança, entre de novo e repita a troca." };
    return { error: "Não foi possível trocar a senha." };
  }
  return { success: "Senha trocada." };
}

export async function signOutOthersAction(): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return fail("Não foi possível encerrar as outras sessões.");
  return ok(null);
}

// ---------------------------------------------------------------------------
// Privacidade: excluir conta
// ---------------------------------------------------------------------------

export async function deleteAccountAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  if (formData.get("confirm") !== "EXCLUIR") return { error: "Digite EXCLUIR para confirmar." };
  const { supabase, user } = await requireUser();

  // Excluir um usuário do Auth exige a secret key. O cascade do banco apaga perfil, sessões,
  // respostas, pesquisas, contatos de participantes e insights.
  const admin = createAdminClient();
  const { data: files } = await admin.storage.from(AVATAR_BUCKET).list(user.id);
  if (files && files.length > 0) {
    await admin.storage.from(AVATAR_BUCKET).remove(files.map((f) => `${user.id}/${f.name}`));
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: "Não foi possível excluir a conta. Tente de novo." };

  await supabase.auth.signOut();
  redirect("/?conta=excluida");
}
