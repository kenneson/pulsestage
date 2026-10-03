import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { getOwnedSession, getSessionInteractions } from "@/lib/data/sessions";
import { listSurveyTemplates } from "@/lib/data/surveys";
import { getSpeakerProfile } from "@/lib/data/profile";
import { toPublicInteraction } from "@/lib/domain/interactions";
import { utcToZonedParts, formatDateTime } from "@/lib/datetime";
import { isUuid } from "@/lib/action-result";
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

export const metadata: Metadata = { title: "Editar sessão" };

export default async function SessionBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, id);
  if (!session) notFound();

  const [interactions, responses, templates, snapshot] = await Promise.all([
    getSessionInteractions(supabase, id),
    fetchAllRows<{ interaction_id: string }>((from, to) =>
      supabase.from("responses").select("interaction_id").eq("session_id", id).range(from, to),
    ),
    listSurveyTemplates(supabase),
    supabase.from("session_surveys").select("name").eq("session_id", id).maybeSingle(),
  ]);
  // Biblioteca sem as perguntas que já estão nesta sessão.
  const ownIds = new Set(interactions.map((i) => i.id));
  const library = (await loadLibrary(supabase)).filter((item) => !ownIds.has(item.sourceId));
  const surveyOptions = templates.map((t) => ({ id: t.id, name: t.name, isPlatform: t.isPlatform }));
  const surveyTemplateId = session.survey_template_id ?? templates.find((t) => t.slug === "geral")?.id ?? "";

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
          options: row.options.map((o) => ({ id: o.id, label: o.label, isCorrect: o.is_correct, points: o.points })),
        },
      },
    ];
  });

  const { timeZone } = await getSpeakerProfile();
  const when = utcToZonedParts(session.scheduled_at, timeZone);
  const status = session.status;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            <span className="text-sm text-muted-foreground">
              Código <span className="font-script font-semibold text-foreground">{session.join_code}</span>
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{session.title}</h1>
          <p className="text-sm text-muted-foreground">{formatDateTime(session.scheduled_at, timeZone)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DeleteSessionButton sessionId={id} title={session.title} />
          <DuplicateSessionButton sessionId={id} />
          {status !== "completed" ? <QrDownloadButton joinUrl={joinUrl(session.join_code)} code={session.join_code} /> : null}
          {status === "draft" ? <StartSessionButton sessionId={id} hasInteractions={items.length > 0} /> : null}
          {status === "live" || status === "paused" ? (
            <Link href={`/dashboard/sessions/${id}/live`} className={buttonVariants()}>
              Abrir sala ao vivo
            </Link>
          ) : null}
          {status === "completed" ? (
            <Link href={`/dashboard/sessions/${id}/analytics`} className={buttonVariants()}>
              Ver analytics
            </Link>
          ) : null}
        </div>
      </div>

      <Tabs
        defaultTab="interactions"
        tabs={[
          {
            id: "interactions",
            label: `Interações (${items.length})`,
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Interações</CardTitle>
                  <CardDescription>
                    Na ordem em que serão apresentadas. Use o olho para ver como o participante enxerga.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <InteractionsEditor
                    sessionId={id}
                    items={items}
                    readOnly={status === "completed"}
                    library={library}
                    aiEnabled={isAIConfigured()}
                  />
                </CardContent>
              </Card>
            ),
          },
          {
            id: "info",
            label: "Informações",
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
