"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUniqueViolation } from "@/lib/supabase/errors";
import { fail, formValues, isUuid, ok, type ActionResult } from "@/lib/action-result";
import { getMessageTranslator } from "@/i18n/server";
import { getContactTarget } from "@/lib/data/speaker-profile";
import { notifySpeakerByEmail, requesterIpHash } from "@/lib/data/contact-email";
import {
  CONTACT_LIMIT_PER_DAY,
  CONTACT_LIMIT_PER_HOUR,
  contactRequestSchema,
  publicProfileSchema,
  SLUG_RE,
} from "@/lib/domain/speaker-profile";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function refreshPublic(slug: string | null) {
  revalidatePath("/dashboard/perfil-publico");
  revalidatePath("/palestrantes", "layout");
  if (slug) revalidatePath(`/p/${slug}`);
}

// ---------------------------------------------------------------------------
// Perfil público
// ---------------------------------------------------------------------------

const TEXT_FIELDS = ["slug", "headline", "topics", "city", "state", "experience", "websiteUrl", "linkedinUrl"] as const;
const FLAG_FIELDS = ["publicEnabled", "contactEnabled", "showRatings", "promoteOnSurvey"] as const;

export type PublicProfileFormValues = Record<(typeof TEXT_FIELDS)[number], string> &
  Record<(typeof FLAG_FIELDS)[number], boolean> & { formats: string[]; audiences: string[] };

export type PublicProfileFormState = { error?: string; success?: string; values?: PublicProfileFormValues };

export async function savePublicProfileAction(
  _prev: PublicProfileFormState,
  formData: FormData,
): Promise<PublicProfileFormState> {
  const text = formValues(formData, TEXT_FIELDS);
  const flags = Object.fromEntries(FLAG_FIELDS.map((k) => [k, formData.get(k) === "on"])) as Record<
    (typeof FLAG_FIELDS)[number],
    boolean
  >;
  const lists = {
    formats: formData.getAll("formats").filter((v): v is string => typeof v === "string"),
    audiences: formData.getAll("audiences").filter((v): v is string => typeof v === "string"),
  };
  const values: PublicProfileFormValues = {
    ...(Object.fromEntries(TEXT_FIELDS.map((k) => [k, text[k] ?? ""])) as Record<(typeof TEXT_FIELDS)[number], string>),
    ...flags,
    ...lists,
  };

  const [tr, t] = await Promise.all([getMessageTranslator(), getTranslations("profile")]);
  const parsed = publicProfileSchema.safeParse({ ...text, ...flags, ...lists });
  if (!parsed.success) return { error: tr.issue(parsed.error), values };
  const input = parsed.data;

  const { supabase, user } = await requireUser();
  const { data: current } = await supabase.from("profiles").select("name, public_slug").eq("id", user.id).maybeSingle();
  if (input.publicEnabled && !current?.name?.trim()) {
    return { error: t("errors.nameMissing"), values };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      public_enabled: input.publicEnabled,
      public_slug: input.slug,
      headline: input.headline ?? null,
      topics: input.topics,
      city: input.city ?? null,
      state: input.state ?? null,
      formats: input.formats,
      audiences: input.audiences,
      experience: input.experience ?? null,
      website_url: input.websiteUrl,
      linkedin_url: input.linkedinUrl,
      contact_enabled: input.contactEnabled,
      show_ratings: input.showRatings,
      promote_on_survey: input.promoteOnSurvey,
    })
    .eq("id", user.id);
  if (isUniqueViolation(error)) return { error: t("errors.slugTaken"), values };
  if (error) return { error: t("errors.saveFailed"), values };

  refreshPublic(input.slug);
  if (current?.public_slug && current.public_slug !== input.slug) refreshPublic(current.public_slug);
  return { success: input.publicEnabled ? t("form.savedPublished") : t("form.savedDraft") };
}

/** Mostra ou esconde uma sessão encerrada na lista do perfil público. */
export async function setSessionListedAction(sessionId: string, listed: boolean): Promise<ActionResult> {
  const [tErrors, t] = await Promise.all([getTranslations("errors"), getTranslations("profile.errors")]);
  if (!isUuid(sessionId) || typeof listed !== "boolean") return fail(tErrors("invalidData"));
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("sessions")
    .update({ public_listed: listed })
    .eq("id", sessionId)
    .eq("status", "completed")
    .select("id")
    .maybeSingle();
  if (error || !data) return fail(t("sessionUpdateFailed"));
  const { data: profile } = await supabase.from("profiles").select("public_slug").eq("id", user.id).maybeSingle();
  refreshPublic(profile?.public_slug ?? null);
  return ok(null);
}

// ---------------------------------------------------------------------------
// Convites recebidos
// ---------------------------------------------------------------------------

const contactUpdateSchema = z.object({
  id: z.uuid(),
  read: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export async function updateContactAction(raw: z.input<typeof contactUpdateSchema>): Promise<ActionResult> {
  const [tErrors, t] = await Promise.all([getTranslations("errors"), getTranslations("profile.errors")]);
  const parsed = contactUpdateSchema.safeParse(raw);
  if (!parsed.success) return fail(tErrors("invalidData"));
  const { id, read, archived } = parsed.data;
  const now = new Date().toISOString();
  const patch: { read_at?: string | null; archived_at?: string | null } = {};
  if (read !== undefined) patch.read_at = read ? now : null;
  if (archived !== undefined) patch.archived_at = archived ? now : null;
  if (Object.keys(patch).length === 0) return ok(null);

  const { supabase } = await requireUser();
  const { error } = await supabase.from("contact_requests").update(patch).eq("id", id);
  if (error) return fail(t("inviteUpdateFailed"));
  revalidatePath("/dashboard", "layout");
  return ok(null);
}

export async function deleteContactAction(id: string): Promise<ActionResult> {
  const [tErrors, t] = await Promise.all([getTranslations("errors"), getTranslations("profile.errors")]);
  if (!isUuid(id)) return fail(tErrors("invalidData"));
  const { supabase } = await requireUser();
  const { error } = await supabase.from("contact_requests").delete().eq("id", id);
  if (error) return fail(t("inviteDeleteFailed"));
  revalidatePath("/dashboard", "layout");
  return ok(null);
}

// ---------------------------------------------------------------------------
// Formulário público "Convidar para palestrar"
// ---------------------------------------------------------------------------

const CONTACT_FIELDS = ["name", "email", "organization", "orgKind", "message", "eventDate", "eventCity"] as const;

export type ContactFormState = {
  error?: string;
  sent?: boolean;
  values?: Partial<Record<(typeof CONTACT_FIELDS)[number], string>>;
};

export async function sendContactRequestAction(
  slug: string,
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const raw = formValues(formData, CONTACT_FIELDS);
  const values = Object.fromEntries(CONTACT_FIELDS.map((k) => [k, raw[k] ?? ""]));

  // Campo invisível: pessoas não preenchem, robôs sim. Responde como se tivesse dado certo.
  const trap = formData.get("website");
  if (typeof trap === "string" && trap.trim() !== "") return { sent: true };

  const [tr, t] = await Promise.all([getMessageTranslator(), getTranslations("profile.errors")]);
  if (typeof slug !== "string" || !SLUG_RE.test(slug)) return { error: t("profileNotFound") };
  const parsed = contactRequestSchema.safeParse(raw);
  if (!parsed.success) return { error: tr.issue(parsed.error), values };

  const admin = createAdminClient();
  const target = await getContactTarget(admin, slug);
  if (!target) return { error: t("notReceiving"), values };

  const ipHash = await requesterIpHash();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [byOrigin, bySpeaker] = await Promise.all([
    ipHash
      ? admin
          .from("contact_requests")
          .select("id", { count: "exact", head: true })
          .eq("ip_hash", ipHash)
          .gte("created_at", hourAgo)
      : Promise.resolve({ count: 0 }),
    admin
      .from("contact_requests")
      .select("id", { count: "exact", head: true })
      .eq("speaker_id", target.speakerId)
      .gte("created_at", dayAgo),
  ]);
  if ((byOrigin.count ?? 0) >= CONTACT_LIMIT_PER_HOUR) {
    return { error: t("tooManyFromYou"), values };
  }
  if ((bySpeaker.count ?? 0) >= CONTACT_LIMIT_PER_DAY) {
    return { error: t("tooManyForSpeaker"), values };
  }

  const input = parsed.data;
  const { error } = await admin.from("contact_requests").insert({
    speaker_id: target.speakerId,
    name: input.name,
    email: input.email,
    organization: input.organization ?? null,
    org_kind: input.orgKind ?? null,
    message: input.message,
    event_date: input.eventDate ?? null,
    event_city: input.eventCity ?? null,
    ip_hash: ipHash,
  });
  if (error) return { error: t("sendFailed"), values };

  if (target.email) await notifySpeakerByEmail(target.email, target.name, target.locale, input);
  return { sent: true };
}
