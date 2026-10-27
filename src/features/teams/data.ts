import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

// Leitura das equipes para o cartão "Equipes" (cliente do palestrante: o RLS garante o dono).

export type TeamView = { id: string; name: string; color: number; position: number; members: number };
export type TeamsState = { enabled: boolean; teams: TeamView[] };

/** Equipes da sessão, na ordem, com quantas pessoas entraram em cada uma. */
export async function getSessionTeams(supabase: ServerSupabase, sessionId: string): Promise<TeamView[]> {
  const { data, error } = await supabase
    .from("session_teams")
    .select("id, name, color, position")
    .eq("session_id", sessionId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return Promise.all(
    data.map(async (team) => {
      const { count } = await supabase
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("team_id", team.id);
      return { ...team, members: count ?? 0 };
    }),
  );
}

export async function getTeamsState(supabase: ServerSupabase, sessionId: string, enabled: boolean): Promise<TeamsState> {
  return { enabled, teams: await getSessionTeams(supabase, sessionId) };
}
