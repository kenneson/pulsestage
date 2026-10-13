import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSpeakerProfile } from "@/lib/data/profile";
import { authorizationServer, mcpUrl } from "@/lib/mcp/auth";
import { formatDate } from "@/lib/datetime";
import { MCP_EXAMPLE_PROMPTS } from "@/lib/domain/mcp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { CopyField } from "@/components/copy-field";
import { ConnectedApps, type ConnectedApp } from "@/components/integrations/connected-apps";

export const metadata: Metadata = { title: "Integrações" };

/** O servidor OAuth do Supabase está ligado? Sem ele, nenhum assistente consegue conectar. */
async function oauthReady(): Promise<boolean> {
  try {
    const res = await fetch(`${authorizationServer()}/.well-known/oauth-authorization-server`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return false;
    const body: unknown = await res.json();
    return typeof body === "object" && body !== null && "registration_endpoint" in body;
  } catch {
    return false;
  }
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2 text-sm [&>li]:ml-5 [&>li]:list-decimal">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}

export default async function IntegrationsPage() {
  const profile = await getSpeakerProfile();
  const supabase = await createClient();
  const url = mcpUrl();
  const [ready, grants] = await Promise.all([oauthReady(), supabase.auth.oauth.listGrants()]);
  const apps: ConnectedApp[] = (grants.data ?? []).map((g) => ({
    clientId: g.client.id,
    name: g.client.name || "Assistente sem nome",
    site: g.client.uri || null,
    grantedAt: formatDate(g.granted_at, profile.timeZone),
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
        <p className="text-muted-foreground">
          Use o PulseStage de dentro do Claude, do ChatGPT e de outros assistentes compatíveis com MCP. Anexe os slides
          da sua apresentação no chat e peça as perguntas: o assistente cria a sessão e coloca cada interação depois do
          slide certo.
        </p>
      </div>

      {!ready ? (
        <Alert tone="info">
          A conexão com assistentes ainda não está ativa neste servidor. Quem administra o PulseStage precisa ligar o
          servidor OAuth no Supabase (veja o README).
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Endereço do servidor MCP</CardTitle>
          <CardDescription>
            É o mesmo para todos os assistentes. Na primeira vez, ele abre o PulseStage para você entrar e permitir o
            acesso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CopyField value={url} label="endereço do servidor MCP" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conectar</CardTitle>
          <CardDescription>Os nomes dos menus podem mudar um pouco conforme a versão de cada aplicativo.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            tabs={[
              {
                id: "claude",
                label: "Claude",
                content: (
                  <Steps
                    items={[
                      <>
                        No Claude (site ou app), abra <strong>Configurações → Conectores</strong> e clique em{" "}
                        <strong>Adicionar conector personalizado</strong>.
                      </>,
                      <>
                        Nome: <strong>PulseStage</strong>. URL: o endereço acima. Salve e clique em{" "}
                        <strong>Conectar</strong>.
                      </>,
                      <>
                        Entre com sua conta PulseStage e clique em <strong>Permitir acesso</strong>.
                      </>,
                      <>Numa conversa, ative o PulseStage no menu de ferramentas e anexe o PDF da apresentação.</>,
                    ]}
                  />
                ),
              },
              {
                id: "chatgpt",
                label: "ChatGPT",
                content: (
                  <Steps
                    items={[
                      <>
                        No ChatGPT, abra <strong>Configurações → Apps e conectores → Configurações avançadas</strong> e
                        ligue o <strong>Modo desenvolvedor</strong> (conectores próprios dependem do seu plano).
                      </>,
                      <>
                        Em <strong>Apps e conectores</strong>, clique em <strong>Criar</strong>. Nome:{" "}
                        <strong>PulseStage</strong>; URL do servidor MCP: o endereço acima; autenticação:{" "}
                        <strong>OAuth</strong>.
                      </>,
                      <>
                        Entre com sua conta PulseStage e clique em <strong>Permitir acesso</strong>.
                      </>,
                      <>Numa conversa, escolha o PulseStage no menu “+” e anexe o PDF da apresentação.</>,
                    ]}
                  />
                ),
              },
              {
                id: "code",
                label: "Claude Code",
                content: (
                  <div className="flex flex-col gap-3 text-sm">
                    <p>No terminal:</p>
                    <CopyField value={`claude mcp add --transport http pulsestage ${url}`} label="comando" />
                    <p>
                      Depois, dentro do Claude Code, rode <code className="rounded bg-muted px-1">/mcp</code>, escolha{" "}
                      <strong>pulsestage</strong> e autentique no navegador.
                    </p>
                  </div>
                ),
              },
              {
                id: "outros",
                label: "Outros",
                content: (
                  <p className="text-sm">
                    Qualquer cliente MCP com servidor remoto (HTTP) e login OAuth funciona, como Cursor e VS Code: adicione
                    um servidor com o endereço acima. O cliente descobre sozinho onde fazer login.
                  </p>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como usar com uma apresentação pronta</CardTitle>
          <CardDescription>O assistente lê os slides no chat; o PulseStage recebe só as perguntas.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Steps
            items={[
              <>Anexe o PDF da apresentação na conversa e diga o público e a duração.</>,
              <>
                O assistente propõe as perguntas e <strong>depois de qual slide</strong> cada uma entra (pela numeração das
                páginas do PDF). Ajuste o que quiser e aprove.
              </>,
              <>Ele cria a sessão (ou usa uma que você indicar) e grava as perguntas no lugar certo.</>,
              <>
                Abra a sessão no PulseStage, vá à aba <strong>“Slides”</strong> e envie <strong>o mesmo PDF</strong>: as
                perguntas já aparecem entre os slides. Dá para arrastar e editar como sempre.
              </>,
            ]}
          />
          <p className="text-sm text-muted-foreground">
            O assistente não inicia nem encerra a sessão ao vivo: isso continua no PulseStage. Sessões encerradas não são
            editadas, mas ele pode ler os resultados para analisar a apresentação com você.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos de exemplo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {MCP_EXAMPLE_PROMPTS.map((p) => (
            <div key={p.title} className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">{p.title}</p>
              <CopyField value={p.text} label={`pedido “${p.title}”`} multiline />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assistentes conectados</CardTitle>
          <CardDescription>
            Cada um age como você, com acesso às suas sessões. Revogue o que não usar mais. Detalhes em{" "}
            <Link href="/privacidade#assistentes" className="font-medium text-primary hover:underline">
              Privacidade
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectedApps apps={apps} />
        </CardContent>
      </Card>
    </div>
  );
}
