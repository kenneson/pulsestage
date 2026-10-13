import "server-only";
import { authorizationServer, mcpUrl } from "./auth";

/** Metadados do recurso protegido (RFC 9728): dizem ao cliente MCP onde fazer login. */
export function protectedResourceMetadata() {
  return {
    resource: mcpUrl(),
    authorization_servers: [authorizationServer()],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid", "email", "profile"],
    resource_name: "PulseStage",
    resource_documentation: mcpUrl().replace(/\/api\/mcp$/, "/dashboard/integracoes"),
  };
}

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export function metadataResponse(body: unknown): Response {
  return Response.json(body, { headers: { ...CORS, "Cache-Control": "public, max-age=300" } });
}

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Headers": "*" } });
}
