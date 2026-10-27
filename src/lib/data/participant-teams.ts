import "server-only";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { smallestTeam, teamColor, type PublicTeam } from "@/lib/domain/participant-answers";

// Equipes na entrada da plateia (secret key; a tabela session_teams só é legível pelo dono via RLS).
// Sai daqui só nome e cor, nunca quem está em cada equipe.

export type JoinTeam = PublicTeam;

/** Equipes para escolher na entrada; vazio quando a sessão não usa equipes. */
export async function getJoinTeams(admin: AdminSupabase, sessionId: string): Promise<JoinTeam[]> {
  const { data: session, error } = await admin.from("sessions").select("teams_enabled").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!session?.teams_enabled) return [];
  const { data, error: teamsError } = await admin
    .from("session_teams")
    .select("id, name, color, position")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  if (teamsError) throw new Error(teamsError.message);
  return data.map((t) => ({ id: t.id, name: t.name, color: teamColor(t.color) }));
}

/**
 * Equipe de quem está entrando: a escolhida (se for desta sessão) ou, sem escolha, a com menos gente.
 * Null quando a sessão não usa equipes ou não tem nenhuma.
 */
export async function assignTeam(admin: AdminSupabase, sessionId: string, chosen: string | null): Promise<string | null> {
  const { data: session, error } = await admin.from("sessions").select("teams_enabled").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!session?.teams_enabled) return null;
  const { data: teams, error: teamsError } = await admin
    .from("session_teams")
    .select("id, position")
    .eq("session_id", sessionId);
  if (teamsError) throw new Error(teamsError.message);
  if (teams.length === 0) return null;
  if (chosen && teams.some((t) => t.id === chosen)) return chosen;

  const sizes = await Promise.all(
    teams.map(async (team) => {
      const { count, error: countError } = await admin
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("team_id", team.id);
      if (countError) throw new Error(countError.message);
      return { id: team.id, position: team.position, members: count ?? 0 };
    }),
  );
  return smallestTeam(sizes);
}

/** Equipe do próprio participante, para o cabeçalho do celular. */
export async function getParticipantTeam(admin: AdminSupabase, participantId: string): Promise<JoinTeam | null> {
  const { data, error } = await admin.from("participants").select("team_id").eq("id", participantId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.team_id) return null;
  const { data: team, error: teamError } = await admin
    .from("session_teams")
    .select("id, name, color")
    .eq("id", data.team_id)
    .maybeSingle();
  if (teamError) throw new Error(teamError.message);
  return team ? { id: team.id, name: team.name, color: teamColor(team.color) } : null;
}
