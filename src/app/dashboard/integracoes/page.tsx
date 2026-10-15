import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSpeakerProfile } from "@/lib/data/profile";
import { authorizationServer, mcpUrl } from "@/lib/mcp/auth";
import { formatDate } from "@/lib/datetime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { CopyField } from "@/components/copy-field";
import { ConnectedApps, type ConnectedApp } from "@/components/integrations/connected-apps";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("integrations");
  return { title: t("metaTitle") };
}

/** Pedidos de exemplo (chaves de integrations.examples), no idioma do painel; os de lib/domain/mcp.ts ficam em português. */
const EXAMPLES = ["fromSlides", "fromScratch", "adjust", "afterTalk"] as const;

const b = (chunks: React.ReactNode) => <strong>{chunks}</strong>;

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
  const [ready, grants, t, locale] = await Promise.all([
    oauthReady(),
    supabase.auth.oauth.listGrants(),
    getTranslations("integrations"),
    getLocale(),
  ]);
  const apps: ConnectedApp[] = (grants.data ?? []).map((g) => ({
    clientId: g.client.id,
    name: g.client.name || t("connected.unnamed"),
    site: g.client.uri || null,
    grantedAt: formatDate(g.granted_at, profile.timeZone, locale),
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>

      {!ready ? <Alert tone="info">{t("notReady")}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("server.title")}</CardTitle>
          <CardDescription>{t("server.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CopyField value={url} label={t("server.copyLabel")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("connect.title")}</CardTitle>
          <CardDescription>{t("connect.description")}</CardDescription>
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
                      t.rich("connect.claude.step1", { b }),
                      t.rich("connect.claude.step2", { b }),
                      t.rich("connect.allowStep", { b }),
                      t("connect.claude.step4"),
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
                      t.rich("connect.chatgpt.step1", { b }),
                      t.rich("connect.chatgpt.step2", { b }),
                      t.rich("connect.allowStep", { b }),
                      t("connect.chatgpt.step4"),
                    ]}
                  />
                ),
              },
              {
                id: "code",
                label: "Claude Code",
                content: (
                  <div className="flex flex-col gap-3 text-sm">
                    <p>{t("connect.code.terminal")}</p>
                    <CopyField value={`claude mcp add --transport http pulsestage ${url}`} label={t("connect.code.commandLabel")} />
                    <p>
                      {t.rich("connect.code.after", {
                        b,
                        code: (chunks) => <code className="rounded bg-muted px-1">{chunks}</code>,
                      })}
                    </p>
                  </div>
                ),
              },
              {
                id: "outros",
                label: t("connect.others.tab"),
                content: <p className="text-sm">{t("connect.others.text")}</p>,
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("usage.title")}</CardTitle>
          <CardDescription>{t("usage.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Steps
            items={[
              t("usage.step1"),
              t.rich("usage.step2", { b }),
              t("usage.step3"),
              t.rich("usage.step4", { b }),
            ]}
          />
          <p className="text-sm text-muted-foreground">{t("usage.note")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("examples.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {EXAMPLES.map((key) => {
            const title = t(`examples.${key}.title`);
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">{title}</p>
                <CopyField value={t(`examples.${key}.text`)} label={t("examples.copyLabel", { title })} multiline />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("connected.title")}</CardTitle>
          <CardDescription>
            {t.rich("connected.description", {
              link: (chunks) => (
                <Link href="/privacidade#assistentes" className="font-medium text-primary hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectedApps apps={apps} />
        </CardContent>
      </Card>
    </div>
  );
}
