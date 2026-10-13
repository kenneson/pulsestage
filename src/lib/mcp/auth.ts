import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";

// O assistente (Claude, ChatGPT…) chega com um access token emitido pelo servidor OAuth do Supabase.
// O token é validado no próprio Supabase Auth (vale para chaves simétricas e assimétricas e respeita
// acessos revogados) e as consultas rodam como aquele usuário: o RLS do painel vale igual.

export const MCP_PATH = "/api/mcp";

export function mcpUrl(): string {
  return `${publicEnv.appUrl}${MCP_PATH}`;
}

export function resourceMetadataUrl(): string {
  return `${publicEnv.appUrl}/.well-known/oauth-protected-resource${MCP_PATH}`;
}

/** Emissor dos tokens (servidor de autorização). */
export function authorizationServer(): string {
  return `${publicEnv.supabaseUrl.replace(/\/+$/, "")}/auth/v1`;
}

export type McpContext = { supabase: ServerSupabase; userId: string; clientId: string | null };

function bearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/** client_id do token (só leitura do payload; a assinatura é validada pelo getUser). */
function clientIdOf(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as unknown;
    if (payload && typeof payload === "object" && "client_id" in payload && typeof payload.client_id === "string") {
      return payload.client_id;
    }
  } catch {
    // token sem payload legível: getUser já recusa
  }
  return null;
}

export async function authenticate(req: Request): Promise<McpContext | null> {
  const token = bearer(req);
  if (!token) return null;
  const client = createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase: client, userId: data.user.id, clientId: clientIdOf(token) };
}

/** 401 com o ponteiro para os metadados OAuth (é assim que o cliente MCP descobre onde fazer login). */
export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized", error_description: "Conecte sua conta PulseStage." }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadataUrl()}"`,
    },
  });
}
