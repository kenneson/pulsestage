import { authorizationServer } from "@/lib/mcp/auth";
import { corsPreflight, metadataResponse } from "@/lib/mcp/metadata";

// Compatibilidade com clientes MCP antigos, que procuram os metadados OAuth na origem do próprio
// servidor MCP: repassa os do Supabase Auth (o servidor de autorização de verdade).
export async function GET() {
  const res = await fetch(`${authorizationServer()}/.well-known/oauth-authorization-server`, { next: { revalidate: 300 } });
  if (!res.ok) return Response.json({ error: "oauth_server_unavailable" }, { status: 503 });
  return metadataResponse(await res.json());
}

export const OPTIONS = corsPreflight;
