import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { getOwnedSession, getSessionInteractions } from "@/lib/data/sessions";
import { generalTemplateId, listSurveyTemplates } from "@/lib/data/surveys";
import { localeOrDefault } from "@/lib/domain/locale";
import { getSpeakerProfile } from "@/lib/data/profile";
import { toPublicInteraction } from "@/lib/domain/interactions";
import { utcToZonedParts, formatDateTime } from "@/lib/datetime";
import { isUuid } from "@/lib/action-result";
import { EngagementSettings } from "@/components/engagement/engagement-settings";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/sessions/status-badge";
import { SessionForm } from "@/components/sessions/session-form";
import { DeleteSessionButton, DuplicateSessionButton, StartSessionButton } from "@/components/sessions/session-controls";
import { loadLibrary } from "@/lib/data/library";
import { isAIConfigured } from "@/lib/ai";
import { QrDownloadButton } from "@/components/sessions/qr-download-button";
import { joinUrl } from "@/lib/env";
import { InteractionsEditor, type EditorItem } from "@/components/builder/interactions-editor";
import { SlidesEditor, type SlideDeckInteraction } from "@/components/slides/slides-editor";
import { getSlideUrls } from "@/lib/data/slides";
import { getRaffleState } from "@/lib/data/raffle";
import { RaffleEditor } from "@/components/raffle/raffle-editor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("session.page");
  return { title: t("metaTitle") };
}

const TAB_ALIASES: Record<string, string> = {
  sorteio: "raffle",
  slides: "slides",
  informacoes: "info",
  participacao: "engagement",
};

export default async function SessionBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string | string[] }>;
}) {
  const { id } = await params;
  const { aba } = await searchParams;
  const initialTab = (typeof aba === "string" && TAB_ALIASES[aba]) || "interactions";
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, id);
  if (!session) notFound();

  const [interactions, responses, templates, snapshot, slideUrls, raffle] = await Promise.all([
    getSessionInteractions(supabase, id),
    fetchAllRows<{ interaction_id: string }>((from, to) =>
      supabase.from("responses").select("interaction_id").eq("session_id", id).range(from, to),
    ),
    listSurveyTemplates(supabase),
    supabase.from("session_surveys").select("name").eq("session_id", id).maybeSingle(),
    getSlideUrls(supabase, session),
    getRaffleState(supabase, id, session.raffle_eligibility),
  ]);
  // Biblioteca sem as perguntas que já estão nesta sessão.
  const ownIds = new Set(interactions.map((i) => i.id));
  const library = (await loadLibrary(supabase)).filter((item) => !ownIds.has(item.sourceId));
  const surveyOptions = templates.map((t) => ({ id: t.id, name: t.name, isPlatform: t.isPlatform, locale: t.locale, slug: t.slug }));
  const surveyTemplateId = session.survey_template_id ?? generalTemplateId(templates, localeOrDefault(session.locale)) ?? "";

  const responseCounts = new Map<string, number>();
  for (const r of responses) responseCounts.set(r.interaction_id, (responseCounts.get(r.interaction_id) ?? 0) + 1);

  const items: EditorItem[] = interactions.flatMap((row) => {
    const pub = toPublicInteraction(row, row.options);
    if (!pub) return [];
    return [
      {
        interaction: pub,
        isActive: row.is_active,
        responses: responseCounts.get(row.id) ?? 0,
        draft: {
          id: row.id,
          type: pub.type,
          title: row.title,
          description: row.description ?? "",
          settings: pub.settings,
          options: row.options.map((o) => ({
            id: o.id,
            label: o.label,
            isCorrect: o.is_correct,
            points: o.points,
            imagePath: o.image_path,
          })),
        },
      },
    ];
  });

  const deckInteractions: SlideDeckInteraction[] = items.map(({ interaction }) => ({
    id: interaction.id,
    type: interaction.type,
    title: interaction.title,
    afterSlide: interaction.afterSlide,
  }));

  const [{ timeZone }, locale, t, tTabs, tCards] = await Promise.all([
    getSpeakerProfile(),
    getLocale(),
    getTranslations("session.page"),
    getTranslations("session.tabs"),
    getTranslations("session.cards"),
  ]);
  const when = utcToZonedParts(session.scheduled_at, timeZone);
  const status = session.status;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            <span className="text-sm text-muted-foreground">
              {t("joinCode")} <span className="font-display font-semibold text-foreground">{session.join_code}</span>
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{session.title}</h1>
          <p className="text-sm text-muted-foreground">{formatDateTime(session.scheduled_at, timeZone, locale)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DeleteSessionButton sessionId={id} title={session.title} />
          <DuplicateSessionButton sessionId={id} title={session.title} />
          {status !== "completed" ? <QrDownloadButton joinUrl={joinUrl(session.join_code)} code={session.join_code} /> : null}
          {status === "draft" ? <StartSessionButton sessionId={id} hasInteractions={items.length > 0} /> : null}
          {status === "live" || status === "paused" ? (
            <Link href={`/dashboard/sessions/${id}/live`} className={buttonVariants()}>
              {t("openLive")}
            </Link>
          ) : null}
          {status === "completed" && session.raffle_eligibility ? (
            <Link href={`/dashboard/sessions/${id}/live`} className={buttonVariants({ variant: "outline" })}>
              {t("raffleRoom")}
            </Link>
          ) : null}
          {status === "completed" ? (
            <Link href={`/dashboard/sessions/${id}/analytics`} className={buttonVariants()}>
              {t("viewAnalytics")}
            </Link>
          ) : null}
        </div>
      </div>

      <Tabs
        defaultTab={initialTab}
        tabs={[
          {
            id: "interactions",
            label: tTabs("interactions", { count: items.length }),
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>{tCards("interactionsTitle")}</CardTitle>
                  <CardDescription>{tCards("interactionsDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <InteractionsEditor
                    sessionId={id}
                    items={items}
                    readOnly={status === "completed"}
                    library={library}
                    aiEnabled={isAIConfigured()}
                    slideCount={slideUrls.length}
                  />
                </CardContent>
              </Card>
            ),
          },
          {
            id: "slides",
            label: slideUrls.length > 0 ? tTabs("slidesCount", { count: slideUrls.length }) : tTabs("slides"),
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>{tCards("slidesTitle")}</CardTitle>
                  <CardDescription>{tCards("slidesDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <SlidesEditor
                    sessionId={id}
                    speakerId={session.speaker_id}
                    slideUrls={slideUrls}
                    interactions={deckInteractions}
                    readOnly={status === "completed"}
                  />
                </CardContent>
              </Card>
            ),
          },
          {
            id: "engagement",
            label: tTabs("engagement"),
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>{tCards("engagementTitle")}</CardTitle>
                  <CardDescription>{tCards("engagementDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <EngagementSettings
                    sessionId={id}
                    initial={{
                      qa_enabled: session.qa_enabled,
                      qa_moderated: session.qa_moderated,
                      reactions_enabled: session.reactions_enabled,
                      profanity_filter: session.profanity_filter,
                      moderate_open_text: session.moderate_open_text,
                    }}
                  />
                </CardContent>
              </Card>
            ),
          },
          {
            id: "raffle",
            label: raffle.eligibility ? tTabs("raffleCount", { count: raffle.prizes.length }) : tTabs("raffle"),
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>{tCards("raffleTitle")}</CardTitle>
                  <CardDescription>{tCards("raffleDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <RaffleEditor sessionId={id} state={raffle} />
                </CardContent>
              </Card>
            ),
          },
          {
            id: "info",
            label: tTabs("info"),
            content: (
              <Card>
                <CardContent>
                  <SessionForm
                    sessionId={id}
                    canEditCode={status === "draft"}
                    surveyOptions={surveyOptions}
                    lockedSurveyName={snapshot.data?.name ?? null}
                    defaults={{
                      title: session.title,
                      description: session.description ?? "",
                      date: when.date,
                      time: when.time,
                      duration: session.estimated_duration_minutes ? String(session.estimated_duration_minutes) : "",
                      joinCode: session.join_code,
                      surveyTemplateId,
                      locale: localeOrDefault(session.locale),
                    }}
                  />
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
