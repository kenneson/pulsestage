import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { InteractionOptionRow, InteractionRow, SessionRow } from "@/lib/supabase/types";

// Acesso a dados do speaker. Usa o cliente com sessão: o RLS garante o ownership.

export async function getOwnedSession(supabase: ServerSupabase, sessionId: string): Promise<SessionRow | null> {
  const { data, error } = await supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listOwnedSessions(supabase: ServerSupabase, limit?: number): Promise<SessionRow[]> {
  let query = supabase.from("sessions").select("*").order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export type InteractionWithOptions = InteractionRow & { options: InteractionOptionRow[] };

export async function getSessionInteractions(
  supabase: ServerSupabase,
  sessionId: string,
): Promise<InteractionWithOptions[]> {
  const { data: interactions, error } = await supabase
    .from("interactions")
    .select("*")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  if (interactions.length === 0) return [];

  const { data: options, error: optionsError } = await supabase
    .from("interaction_options")
    .select("*")
    .in(
      "interaction_id",
      interactions.map((i) => i.id),
    )
    .order("position", { ascending: true });
  if (optionsError) throw new Error(optionsError.message);

  return interactions.map((i) => ({ ...i, options: options.filter((o) => o.interaction_id === i.id) }));
}
