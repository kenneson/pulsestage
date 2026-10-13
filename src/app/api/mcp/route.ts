import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticate, unauthorized } from "@/lib/mcp/auth";
import { buildMcpServer } from "@/lib/mcp/server";

// Servidor MCP remoto (Streamable HTTP, sem estado): cada requisição cria o servidor já com o
// usuário do token OAuth. Claude, ChatGPT e outros clientes MCP se conectam aqui.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ponytail: limite em memória, por instância do servidor; mover para o banco se houver abuso.
const WINDOW_MS = 60_000;
const MAX_CALLS = 60;
const calls = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (calls.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  calls.set(userId, recent);
  return recent.length > MAX_CALLS;
}

async function handle(req: Request): Promise<Response> {
  const ctx = await authenticate(req);
  if (!ctx) return unauthorized();
  if (req.method === "POST" && rateLimited(ctx.userId)) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Muitas chamadas seguidas. Aguarde um minuto." }, id: null },
      { status: 429 },
    );
  }

  const server = buildMcpServer(ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    void server.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };
