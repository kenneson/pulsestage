"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { getMessageTranslator } from "@/i18n/server";
import { localeOrDefault } from "@/lib/domain/locale";
import {
  canAddTeam,
  canRemoveTeam,
  defaultTeams,
  nextTeamColor,
  sameTeams,
  teamColorSchema,
  teamNameSchema,
} from "@/lib/domain/team-settings";
import { fail, isUuid, ok, type ActionResult } from "@/lib/action-result";
import { getTeamsState, type TeamsState } from "./data";

// Equipes da sessão (cliente do palestrante; o RLS de session_teams confere o dono).
// Cada ação devolve o estado atualizado do cartão (equipes na ordem, com quantas pessoas cada uma tem).

type OwnedSession = { id: string; status: string; locale: string; teams_enabled: boolean };

async function loadSession(supabase: ServerSupabase, sessionId: string): Promise<OwnedSession | null> {
  if (!isUuid(sessionId)) return null;
  const { data } = await supabase
    .from("sessions")
    .select("id, status, locale, teams_enabled")
    .eq("id", sessionId)
    .maybeSingle();
  return data;
}

async function failKey(key: "saveFailed" | "notFound" | "tooMany" | "tooFew") {
  return fail((await getTranslations("session.teams.errors"))(key));
}

async function failEnded() {
  return fail((await getMessageTranslator()).message("core.sessionEnded"));
}

async function done(supabase: ServerSupabase, session: OwnedSession, enabled = session.teams_enabled): Promise<ActionResult<TeamsState>> {
  revalidatePath(`/dashboard/sessions/${session.id}`, "layout");
  return ok(await getTeamsState(supabase, session.id, enabled));
}

/** Nomes das equipes padrão no idioma da sessão (é a plateia que vê). */
async function defaultNames(locale: string): Promise<string[]> {
  const t = await getTranslations({ locale: localeOrDefault(locale), namespace: "session.teams.defaults" });
  return [t("red"), t("blue"), t("yellow"), t("green")];
}

/** Liga ou desliga as equipes. Ao ligar sem equipe nenhuma, cria as 4 padrão (cores das formas 1–4). */
export async function setTeamsEnabledAction(sessionId: string, enabled: boolean): Promise<ActionResult<TeamsState>> {
  if (typeof enabled !== "boolean") return failKey("notFound");
  const supabase = await createClient();
  const session = await loadSession(supabase, sessionId);
  if (!session) return failKey("notFound");
  if (session.status === "completed") return failEnded();

  if (enabled) {
    const { count, error } = await supabase
      .from("session_teams")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);
    if (error) return failKey("saveFailed");
    if ((count ?? 0) === 0) {
      const rows = defaultTeams(await defaultNames(session.locale)).map((t) => ({ ...t, session_id: sessionId }));
      const { error: insertError } = await supabase.from("session_teams").insert(rows);
      if (insertError) return failKey("saveFailed");
    }
  }

  const { error } = await supabase.from("sessions").update({ teams_enabled: enabled }).eq("id", sessionId);
  if (error) return failKey("saveFailed");
  return done(supabase, session, enabled);
}

/** Equipe nova no fim, com a primeira cor livre. */
export async function addTeamAction(sessionId: string): Promise<ActionResult<TeamsState>> {
  const supabase = await createClient();
  const session = await loadSession(supabase, sessionId);
  if (!session) return failKey("notFound");
  if (session.status === "completed") return failEnded();

  const { data: teams, error } = await supabase.from("session_teams").select("color, position").eq("session_id", sessionId);
  if (error) return failKey("saveFailed");
  if (!canAddTeam(teams.length)) return failKey("tooMany");

  const t = await getTranslations({ locale: localeOrDefault(session.locale), namespace: "session.teams" });
  const { error: insertError } = await supabase.from("session_teams").insert({
    session_id: sessionId,
    name: t("newName", { number: teams.length + 1 }),
    color: nextTeamColor(teams.map((x) => x.color)),
    position: teams.reduce((max, x) => Math.max(max, x.position + 1), 0),
  });
  if (insertError) return failKey("saveFailed");
  return done(supabase, session);
}

const teamChangeSchema = z
  .object({ name: teamNameSchema, color: teamColorSchema })
  .partial()
  .refine((v) => v.name !== undefined || v.color !== undefined);

/** Renomeia ou troca a cor (também durante a sessão: o celular e o telão leem o nome atual). */
export async function updateTeamAction(
  sessionId: string,
  teamId: string,
  change: { name?: string; color?: number },
): Promise<ActionResult<TeamsState>> {
  const parsed = teamChangeSchema.safeParse(change);
  if (!parsed.success) return fail((await getMessageTranslator()).issue(parsed.error));
  if (!isUuid(teamId)) return failKey("notFound");
  const supabase = await createClient();
  const session = await loadSession(supabase, sessionId);
  if (!session) return failKey("notFound");
  if (session.status === "completed") return failEnded();

  const { data, error } = await supabase
    .from("session_teams")
    .update(parsed.data)
    .eq("id", teamId)
    .eq("session_id", sessionId)
    .select("id")
    .maybeSingle();
  if (error) return failKey("saveFailed");
  if (!data) return failKey("notFound");
  return done(supabase, session);
}

const orderSchema = z.array(z.uuid()).min(1).max(64);

/** Grava a ordem (a do seletor na entrada e a do ranking em caso de empate). */
export async function reorderTeamsAction(sessionId: string, order: string[]): Promise<ActionResult<TeamsState>> {
  const parsed = orderSchema.safeParse(order);
  if (!parsed.success) return failKey("notFound");
  const supabase = await createClient();
  const session = await loadSession(supabase, sessionId);
  if (!session) return failKey("notFound");
  if (session.status === "completed") return failEnded();

  const { data: teams, error } = await supabase.from("session_teams").select("id").eq("session_id", sessionId);
  if (error) return failKey("saveFailed");
  if (!sameTeams(teams.map((t) => t.id), parsed.data)) return failKey("notFound");

  const results = await Promise.all(
    parsed.data.map((id, position) => supabase.from("session_teams").update({ position }).eq("id", id).eq("session_id", sessionId)),
  );
  if (results.some((r) => r.error)) return failKey("saveFailed");
  return done(supabase, session);
}

/** Exclui a equipe; quem estava nela fica sem equipe (o banco solta a referência). */
export async function deleteTeamAction(sessionId: string, teamId: string): Promise<ActionResult<TeamsState>> {
  if (!isUuid(teamId)) return failKey("notFound");
  const supabase = await createClient();
  const session = await loadSession(supabase, sessionId);
  if (!session) return failKey("notFound");
  if (session.status === "completed") return failEnded();

  const { count, error } = await supabase
    .from("session_teams")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);
  if (error) return failKey("saveFailed");
  if (!canRemoveTeam(count ?? 0, session.teams_enabled)) return failKey("tooFew");

  const { data, error: deleteError } = await supabase
    .from("session_teams")
    .delete()
    .eq("id", teamId)
    .eq("session_id", sessionId)
    .select("id")
    .maybeSingle();
  if (deleteError) return failKey("saveFailed");
  if (!data) return failKey("notFound");
  return done(supabase, session);
}
