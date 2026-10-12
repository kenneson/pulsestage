import "server-only";
import { cache } from "react";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/supabase/types";
import {
  AUDIENCES,
  FORMATS,
  inDirectory,
  profileStats,
  publicSessions,
  toSessionFacts,
  type Audience,
  type DirectoryEntry,
  type Format,
  type ProfileStats,
  type PublicSession,
  type SessionFacts,
} from "@/lib/domain/speaker-profile";

// Perfil público do palestrante. As configurações e os fatos do próprio speaker são lidos com o
// cliente dele (RLS); o perfil público e o diretório usam a secret key e devolvem só o que a página
// mostra (nada de e-mail, ids de usuário ou números brutos de cada sessão).

const formatsOf = (list: readonly string[]): Format[] => list.filter((f): f is Format => (FORMATS as readonly string[]).includes(f));
const audiencesOf = (list: readonly string[]): Audience[] =>
  list.filter((a): a is Audience => (AUDIENCES as readonly string[]).includes(a));

export type PublicProfileSettings = {
  publicEnabled: boolean;
  slug: string | null;
  headline: string | null;
  topics: string[];
  city: string | null;
  state: string | null;
  formats: Format[];
  audiences: Audience[];
  experience: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  contactEnabled: boolean;
  showRatings: boolean;
  promoteOnSurvey: boolean;
};

function toSettings(row: ProfileRow): PublicProfileSettings {
  return {
    publicEnabled: row.public_enabled,
    slug: row.public_slug,
    headline: row.headline,
    topics: row.topics,
    city: row.city,
    state: row.state,
    formats: formatsOf(row.formats),
    audiences: audiencesOf(row.audiences),
    experience: row.experience,
    websiteUrl: row.website_url,
    linkedinUrl: row.linkedin_url,
    contactEnabled: row.contact_enabled,
    showRatings: row.show_ratings,
    promoteOnSurvey: row.promote_on_survey,
  };
}

/** Configurações do perfil público do speaker logado. */
export async function getOwnPublicProfile(supabase: ServerSupabase, userId: string): Promise<PublicProfileSettings | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toSettings(data) : null;
}

async function sessionFacts(client: ServerSupabase | AdminSupabase, speakerIds: string[]): Promise<SessionFacts[]> {
  if (speakerIds.length === 0) return [];
  const { data, error } = await client.rpc("speaker_session_facts", { p_speaker_ids: speakerIds });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toSessionFacts);
}

/** Sessões encerradas do speaker logado, com os fatos usados na verificação (RLS). */
export function getOwnSessionFacts(supabase: ServerSupabase, userId: string): Promise<SessionFacts[]> {
  return sessionFacts(supabase, [userId]);
}

export type PublicProfile = {
  slug: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  headline: string | null;
  topics: string[];
  city: string | null;
  state: string | null;
  formats: Format[];
  audiences: Audience[];
  experience: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  contactEnabled: boolean;
  stats: ProfileStats;
  sessions: PublicSession[];
  /** Aparece no diretório (e pode ser indexado por buscadores). */
  listed: boolean;
};

export const FALLBACK_NAME = "Palestrante";

/** Perfil público pelo endereço. null quando não existe ou está desligado. */
export const getPublicProfile = cache(async (admin: AdminSupabase, slug: string): Promise<PublicProfile | null> => {
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("public_slug", slug)
    .eq("public_enabled", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.public_slug) return null;

  const facts = await sessionFacts(admin, [data.id]);
  const stats = profileStats(facts, data.show_ratings);
  return {
    slug: data.public_slug,
    name: data.name?.trim() || FALLBACK_NAME,
    avatarUrl: data.avatar_url,
    bio: data.bio,
    headline: data.headline,
    topics: data.topics,
    city: data.city,
    state: data.state,
    formats: formatsOf(data.formats),
    audiences: audiencesOf(data.audiences),
    experience: data.experience,
    websiteUrl: data.website_url,
    linkedinUrl: data.linkedin_url,
    contactEnabled: data.contact_enabled,
    stats,
    sessions: publicSessions(facts, data.show_ratings),
    listed: inDirectory(stats),
  };
});

/** Para o formulário de contato: quem recebe o pedido. */
export async function getContactTarget(
  admin: AdminSupabase,
  slug: string,
): Promise<{ speakerId: string; name: string; email: string | null } | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, name, public_enabled, contact_enabled")
    .eq("public_slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.public_enabled || !data.contact_enabled) return null;
  const { data: user } = await admin.auth.admin.getUserById(data.id);
  return { speakerId: data.id, name: data.name?.trim() || FALLBACK_NAME, email: user.user?.email ?? null };
}

// O diretório lê todos os perfis públicos e filtra no servidor (lib/domain/speaker-profile.ts).
// Basta para alguns milhares de perfis; acima disso, mover os filtros para o banco.
const DIRECTORY_MAX = 2000;

/** Perfis públicos com estatísticas (inclusive os que ainda não entram no diretório). */
export const listPublicProfiles = cache(async (admin: AdminSupabase): Promise<DirectoryEntry[]> => {
  const { data, error } = await admin
    .from("profiles")
    .select("id, name, avatar_url, headline, topics, city, state, formats, audiences, public_slug, show_ratings")
    .eq("public_enabled", true)
    .not("public_slug", "is", null)
    .limit(DIRECTORY_MAX);
  if (error) throw new Error(error.message);
  if (data.length === 0) return [];

  const facts = await sessionFacts(
    admin,
    data.map((p) => p.id),
  );
  const bySpeaker = new Map<string, SessionFacts[]>();
  for (const f of facts) bySpeaker.set(f.speakerId, [...(bySpeaker.get(f.speakerId) ?? []), f]);

  return data.map((p) => ({
    slug: p.public_slug ?? "",
    name: p.name?.trim() || FALLBACK_NAME,
    avatarUrl: p.avatar_url,
    headline: p.headline,
    topics: p.topics,
    city: p.city,
    state: p.state,
    formats: formatsOf(p.formats),
    audiences: audiencesOf(p.audiences),
    stats: profileStats(bySpeaker.get(p.id) ?? [], p.show_ratings),
  }));
});

export type SurveyPromo = { slug: string; name: string; avatarUrl: string | null; headline: string | null };

/** Card "Conheça o palestrante" na pesquisa: só com perfil público e a opção ligada. */
export async function getSurveyPromo(admin: AdminSupabase, sessionId: string): Promise<SurveyPromo | null> {
  const { data, error } = await admin
    .from("sessions")
    .select("profiles!sessions_speaker_id_fkey(name, avatar_url, headline, public_slug, public_enabled, promote_on_survey)")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const p = data?.profiles;
  if (!p || !p.public_enabled || !p.promote_on_survey || !p.public_slug) return null;
  return { slug: p.public_slug, name: p.name?.trim() || FALLBACK_NAME, avatarUrl: p.avatar_url, headline: p.headline };
}

export type ContactRequest = {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  orgKind: string | null;
  message: string;
  eventDate: string | null;
  eventCity: string | null;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
};

/** Caixa de entrada de convites do speaker logado (RLS). */
export async function listContactRequests(supabase: ServerSupabase): Promise<ContactRequest[]> {
  const { data, error } = await supabase
    .from("contact_requests")
    .select("id, name, email, organization, org_kind, message, event_date, event_city, created_at, read_at, archived_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    organization: r.organization,
    orgKind: r.org_kind,
    message: r.message,
    eventDate: r.event_date,
    eventCity: r.event_city,
    createdAt: r.created_at,
    readAt: r.read_at,
    archivedAt: r.archived_at,
  }));
}

/** Convites não lidos (selo na navegação). */
export async function countUnreadContacts(supabase: ServerSupabase): Promise<number> {
  const { count } = await supabase
    .from("contact_requests")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
    .is("archived_at", null);
  return count ?? 0;
}
