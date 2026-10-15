"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { getMessageTranslator } from "@/i18n/server";
import { setLocaleCookie } from "@/i18n/cookie";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeAllOptionImages } from "@/lib/data/option-images";
import { removeSlideFiles } from "@/lib/data/slides";
import { isValidTimeZone } from "@/lib/datetime";
import { LOCALES } from "@/lib/domain/locale";
import { formValues, fail, ok, type ActionResult } from "@/lib/action-result";

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

// Mensagens como chaves (traduzidas por tr.issue): "validation.*" vêm da área errors, as demais de account.errors.
const profileSchema = z.object({
  name: z
    .string({ error: "validation.nameRequired" })
    .trim()
    .min(2, "validation.nameRequired")
    .max(120, "validation.nameTooLong"),
  bio: z.string().trim().max(400, "account.errors.bioTooLong").optional(),
});

export async function updateProfileAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const [t, tr] = await Promise.all([getTranslations("account"), getMessageTranslator()]);
  const parsed = profileSchema.safeParse(formValues(formData, ["name", "bio"] as const));
  if (!parsed.success) return { error: tr.issue(parsed.error) };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ name: parsed.data.name, bio: parsed.data.bio ?? null })
    .eq("id", user.id);
  if (error) return { error: t("errors.profileSaveFailed") };
  refresh();
  return { success: t("success.profileSaved") };
}

/** Remove arquivos antigos da pasta do usuário (mantém `keep`, se informado). */
async function cleanAvatarFolder(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, keep?: string) {
  const { data } = await supabase.storage.from(AVATAR_BUCKET).list(userId);
  const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((path) => path !== keep);
  if (old.length > 0) await supabase.storage.from(AVATAR_BUCKET).remove(old);
}

export async function uploadAvatarAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const t = await getTranslations("account");
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: t("errors.chooseImage") };
  const ext = AVATAR_TYPES[file.type];
  if (!ext) return { error: t("errors.imageType") };
  if (file.size > AVATAR_MAX_BYTES) return { error: t("errors.imageTooLarge") };

  const { supabase, user } = await requireUser();
  // Nome novo a cada envio: evita que navegador ou CDN mostrem a foto antiga.
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const uploaded = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploaded.error) return { error: t("errors.uploadFailed") };

  const publicUrl = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
  if (error) return { error: t("errors.photoSaveFailed") };

  await cleanAvatarFolder(supabase, user.id, path);
  refresh();
  return { success: t("success.photoUpdated") };
}

export async function removeAvatarAction(): Promise<ActionResult> {
  const t = await getTranslations("account.errors");
  const { supabase, user } = await requireUser();
  await cleanAvatarFolder(supabase, user.id);
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return fail(t("photoRemoveFailed"));
  refresh();
  return ok(null);
}

// ---------------------------------------------------------------------------
// Preferências
// ---------------------------------------------------------------------------

const preferencesSchema = z.object({
  locale: z.enum(LOCALES, { error: "account.errors.invalidLocale" }),
  timeZone: z.string({ error: "account.errors.invalidTimeZone" }).refine(isValidTimeZone, "account.errors.invalidTimeZone"),
  defaultSurveyTemplateId: z.uuid({ error: "account.errors.invalidSurvey" }).optional(),
  defaultDuration: z.coerce
    .number({ error: "account.errors.invalidDuration" })
    .int("account.errors.invalidDuration")
    .min(1, "account.errors.invalidDuration")
    .max(1440, "account.errors.invalidDuration")
    .optional(),
});

export async function updatePreferencesAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const [t, tr] = await Promise.all([getTranslations("account.errors"), getMessageTranslator()]);
  const parsed = preferencesSchema.safeParse(
    formValues(formData, ["locale", "timeZone", "defaultSurveyTemplateId", "defaultDuration"] as const),
  );
  if (!parsed.success) return { error: tr.issue(parsed.error) };
  const { supabase, user } = await requireUser();

  const templateId = parsed.data.defaultSurveyTemplateId ?? null;
  if (templateId) {
    // RLS: só aparece se for da plataforma ou do próprio speaker.
    const { data } = await supabase.from("survey_templates").select("id").eq("id", templateId).maybeSingle();
    if (!data) return { error: t("invalidSurvey") };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      locale: parsed.data.locale,
      time_zone: parsed.data.timeZone,
      default_survey_template_id: templateId,
      default_duration_minutes: parsed.data.defaultDuration ?? null,
    })
    .eq("id", user.id);
  if (error) return { error: t("preferencesSaveFailed") };
  // O idioma vale já: cookie para as próximas páginas e o app inteiro renderizado de novo.
  await setLocaleCookie(parsed.data.locale);
  revalidatePath("/", "layout");
  const tSuccess = await getTranslations({ locale: parsed.data.locale, namespace: "account.success" });
  return { success: tSuccess("preferencesSaved") };
}

// ---------------------------------------------------------------------------
// Segurança
// ---------------------------------------------------------------------------

const passwordSchema = z
  .object({
    password: z
      .string({ error: "account.errors.passwordRequired" })
      .min(8, "account.errors.passwordTooShort")
      .max(72, "account.errors.passwordTooLong"),
    confirm: z.string({ error: "account.errors.confirmRequired" }),
  })
  .refine((v) => v.password === v.confirm, { error: "account.errors.passwordMismatch" });

export async function changePasswordAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const [t, tr] = await Promise.all([getTranslations("account"), getMessageTranslator()]);
  const parsed = passwordSchema.safeParse(formValues(formData, ["password", "confirm"] as const));
  if (!parsed.success) return { error: tr.issue(parsed.error) };
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("different from the old")) return { error: t("errors.passwordSame") };
    if (message.includes("reauthentication")) return { error: t("errors.reauthenticate") };
    return { error: t("errors.passwordChangeFailed") };
  }
  return { success: t("success.passwordChanged") };
}

export async function signOutOthersAction(): Promise<ActionResult> {
  const t = await getTranslations("account.errors");
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return fail(t("signOutOthersFailed"));
  return ok(null);
}

// ---------------------------------------------------------------------------
// Privacidade: excluir conta
// ---------------------------------------------------------------------------

export async function deleteAccountAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const t = await getTranslations("account");
  // Mesma palavra que o formulário pede, no idioma da requisição ("EXCLUIR", "ELIMINAR", "DELETE").
  const word = t("delete.confirmWord");
  if (formData.get("confirm") !== word) return { error: t("errors.typeToConfirm", { word }) };
  const { supabase, user } = await requireUser();

  // Excluir um usuário do Auth exige a secret key. O cascade do banco apaga perfil, sessões,
  // respostas, pesquisas, contatos de participantes e insights.
  const admin = createAdminClient();
  const { data: files } = await admin.storage.from(AVATAR_BUCKET).list(user.id);
  if (files && files.length > 0) {
    await admin.storage.from(AVATAR_BUCKET).remove(files.map((f) => `${user.id}/${f.name}`));
  }
  await removeSlideFiles(admin, user.id);
  await removeAllOptionImages(admin, user.id);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: t("errors.deleteFailed") };

  await supabase.auth.signOut();
  redirect("/?conta=excluida");
}
