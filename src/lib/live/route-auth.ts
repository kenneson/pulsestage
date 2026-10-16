import "server-only";
import { NextResponse } from "next/server";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { getOwnedSession } from "@/lib/data/sessions";
import { isUuid } from "@/lib/action-result";
import type { SessionRow } from "@/lib/supabase/types";

// Leituras periódicas da sala ao vivo (perguntas, moderação, reações, sorteio). São GET, não Server
// Actions: ações rodam uma de cada vez no navegador, e a leitura entraria na fila na frente de
// "Próxima" ou "Sortear". Só o dono da sessão lê (cookie do painel + RLS).

export const noStore = { "Cache-Control": "no-store" };

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

/** Sessão do speaker logado, ou a resposta de erro pronta (400, 401 ou 404). */
export async function ownedLiveSession(
  sessionId: string,
): Promise<{ supabase: ServerSupabase; session: SessionRow } | { response: NextResponse }> {
  if (!isUuid(sessionId)) return { response: jsonError("invalid_session", 400) };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: jsonError("unauthorized", 401) };
  try {
    const session = await getOwnedSession(supabase, sessionId);
    if (!session) return { response: jsonError("not_found", 404) };
    return { supabase, session };
  } catch {
    return { response: jsonError("unavailable", 503) };
  }
}
