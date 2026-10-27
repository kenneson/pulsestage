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
import {
  missingSteps,
  nextStep,
  previousStep,
  READY_VIEW,
  SESSION_STEPS,
  stepFromParams,
  stepHref,
  stepStates,
  type SessionStep,
  type StepFacts,
} from "@/lib/domain/session-steps";
import { utcToZonedParts, formatDateTime } from "@/lib/datetime";
import { isUuid } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { EngagementSettings } from "@/components/engagement/engagement-settings";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { CheckIcon, ChevronRightIcon } from "@/components/icons";
import { StatusBadge } from "@/components/sessions/status-badge";
import { SessionForm } from "@/components/sessions/session-form";
import { NextStepLink, SessionStepper, StepFooter, StepFooterSpacer } from "@/components/sessions/session-stepper";
import { SurveyStep, type SurveyStepTemplate } from "@/components/sessions/survey-step";
import {
  DeleteSessionButton,
  DuplicateSessionButton,
  RehearsalButton,
  StartSessionButton,
} from "@/components/sessions/session-controls";
import { loadLibrary } from "@/lib/data/library";
import { isAIConfigured } from "@/lib/ai";
import { QrDownloadButton } from "@/components/sessions/qr-download-button";
import { joinUrl } from "@/lib/env";
import { InteractionsEditor, type EditorItem } from "@/components/builder/interactions-editor";
import { draftFromRow } from "@/components/builder/draft";
import { parseSlideNotes, visibleSlideNotes } from "@/lib/domain/slide-notes";
import { SlidesEditor, type SlideDeckInteraction } from "@/components/slides/slides-editor";
import { getSlideUrls } from "@/lib/data/slides";
import { getRaffleState } from "@/lib/data/raffle";
import { RaffleEditor } from "@/components/raffle/raffle-editor";
import { TeamsSettings } from "@/components/teams/teams-settings";
import { getTeamsState } from "@/features/teams/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("session.page");
  return { title: t("metaTitle") };
}

// Botões do cabeçalho no celular (abaixo de 768 px; no computador nada muda).
const PRIMARY_MOBILE = "max-md:col-span-2 max-md:h-11";
const SECONDARY_MOBILE = "max-md:h-auto max-md:min-h-11 max-md:whitespace-normal max-md:px-3 max-md:py-2";

/**
 * Página da sessão: cabeçalho (status, código, ações) e a montagem em passos (linha do tempo):
 * Configurações → Slides → Enquetes → Pesquisa pós-evento → Sorteio → "Pronto para apresentar".
 * Etapa na URL (?etapa=...); cada passo só carrega o que mostra.
 */
export default async function SessionBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ etapa?: string | string[]; aba?: string | string[] }>;
}) {
  const { id } = await params;
  const { etapa, aba } = await searchParams;
  const step = stepFromParams(etapa, aba);
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, id);
  if (!session) notFound();

  const needsTemplates = step === "configuracoes" || step === "pesquisa" || step === READY_VIEW;
  const needsRaffle = step === "sorteio" || step === READY_VIEW;
  const [interactions, templates, raffle] = await Promise.all([
    getSessionInteractions(supabase, id),
    needsTemplates ? listSurveyTemplates(supabase) : Promise.resolve([]),
    needsRaffle
      ? getTranslations("domain").then((t) => getRaffleState(supabase, id, session.raffle_eligibility, t("anonymousParticipant")))
      : Promise.resolve(null),
  ]);

  const facts: StepFacts = {
    created: true,
    slideCount: session.slide_count,
    interactionCount: interactions.length,
    surveyTemplateId: session.survey_template_id,
    raffleEnabled: session.raffle_eligibility !== null,
  };
  const states = stepStates(facts);

  const [{ timeZone }, locale, t, tStates, tSteps] = await Promise.all([
    getSpeakerProfile(),
    getLocale(),
    getTranslations("session.page"),
    getTranslations("common.states"),
    getTranslations("session.steps"),
  ]);
  const status = session.status;
  const readOnly = status === "completed";
  const items = interactions;
  const label = (s: SessionStep) => tSteps(`${s}.label`);

  /** Rodapé padrão do passo: Voltar, Pular (opcionais ainda vazios) e Próximo/Concluir. */
  const footer = (current: SessionStep) => {
    const back = previousStep(current);
    const next = nextStep(current) ?? READY_VIEW;
    const skippable = states[current] === "optional";
    return (
      <StepFooter
        back={back ? { href: stepHref(id, back), label: label(back) } : null}
        skip={skippable ? { href: stepHref(id, next), label: tSteps("skip") } : null}
      >
        <NextStepLink
          href={stepHref(id, next)}
          label={next === READY_VIEW ? tSteps("finish") : tSteps("next", { label: label(next) })}
        />
      </StepFooter>
    );
  };

  const stepCard = (current: SessionStep, children: React.ReactNode) => (
    <Card>
      <CardHeader>
        <CardTitle id="step-title">{label(current)}</CardTitle>
        <CardDescription>{tSteps(`${current}.description`)}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );

  let body: React.ReactNode = null;
  if (step === "configuracoes") {
    const when = utcToZonedParts(session.scheduled_at, timeZone);
    const [{ data: brand }, teams] = await Promise.all([
      supabase.from("profiles").select("brand_logo_path, brand_color").eq("id", session.speaker_id).maybeSingle(),
      getTeamsState(supabase, id, session.teams_enabled),
    ]);
    const tCards = await getTranslations("session.cards");
    const surveyOptions = templates.map((x) => ({ id: x.id, name: x.name, isPlatform: x.isPlatform, locale: x.locale, slug: x.slug }));
    body = (
      <>
        {stepCard(
          "configuracoes",
          <SessionForm
            sessionId={id}
            canEditCode={status === "draft"}
            surveyOptions={surveyOptions}
            hasBrand={Boolean(brand?.brand_logo_path || brand?.brand_color)}
            defaults={{
              title: session.title,
              description: session.description ?? "",
              date: when.date,
              time: when.time,
              duration: session.estimated_duration_minutes ? String(session.estimated_duration_minutes) : "",
              joinCode: session.join_code,
              surveyTemplateId: session.survey_template_id ?? "",
              locale: localeOrDefault(session.locale),
              pace: session.pace === "self" ? "self" : "live",
              useBrand: session.use_brand,
            }}
          />,
        )}
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
        <TeamsSettings sessionId={id} initial={teams} status={status} />
        {/* "Próximo" salva o formulário de configurações e segue para Slides. */}
        <StepFooter back={null}>
          <Button type="submit" form="session-form" name="continueTo" value="slides" className="max-md:min-w-0 max-md:px-3">
            <span className="truncate">{tSteps("next", { label: label("slides") })}</span> <ChevronRightIcon />
          </Button>
        </StepFooter>
      </>
    );
  } else if (step === "slides") {
    const slideUrls = await getSlideUrls(supabase, session);
    const deckInteractions: SlideDeckInteraction[] = items.flatMap((row) => {
      const pub = toPublicInteraction(row, row.options);
      return pub ? [{ id: pub.id, type: pub.type, title: pub.title, afterSlide: pub.afterSlide }] : [];
    });
    body = (
      <>
        {stepCard(
          "slides",
          <SlidesEditor
            sessionId={id}
            speakerId={session.speaker_id}
            slideUrls={slideUrls}
            interactions={deckInteractions}
            readOnly={readOnly}
            slideNotes={visibleSlideNotes(parseSlideNotes(session.slide_notes), slideUrls.length)}
            canReorder={status === "draft"}
          />,
        )}
        {footer("slides")}
      </>
    );
  } else if (step === "enquetes") {
    const responses = await fetchAllRows<{ interaction_id: string }>((from, to) =>
      supabase.from("responses").select("interaction_id").eq("session_id", id).range(from, to),
    );
    // Biblioteca sem as perguntas que já estão nesta sessão.
    const ownIds = new Set(items.map((i) => i.id));
    const library = (await loadLibrary(supabase)).filter((item) => !ownIds.has(item.sourceId));
    const responseCounts = new Map<string, number>();
    for (const r of responses) responseCounts.set(r.interaction_id, (responseCounts.get(r.interaction_id) ?? 0) + 1);
    const editorItems: EditorItem[] = items.flatMap((row) => {
      const pub = toPublicInteraction(row, row.options);
      if (!pub) return [];
      return [
        {
          interaction: pub,
          isActive: row.is_active,
          responses: responseCounts.get(row.id) ?? 0,
          draft: draftFromRow(row, row.options, pub.type),
        },
      ];
    });
    body = (
      <>
        {stepCard(
          "enquetes",
          <InteractionsEditor
            sessionId={id}
            items={editorItems}
            readOnly={readOnly}
            library={library}
            aiEnabled={isAIConfigured()}
            slideCount={session.slides_batch ? session.slide_count : 0}
          />,
        )}
        {footer("enquetes")}
      </>
    );
  } else if (step === "pesquisa") {
    const { data: snapshot } = await supabase.from("session_surveys").select("name").eq("session_id", id).maybeSingle();
    const sessionLocale = localeOrDefault(session.locale);
    // Modelos prontos no idioma da sessão (o da plateia); os do palestrante aparecem sempre.
    const visible: SurveyStepTemplate[] = templates
      .filter((x) => !x.isPlatform || localeOrDefault(x.locale) === sessionLocale || x.id === session.survey_template_id)
      .map((x) => ({
        id: x.id,
        name: x.name,
        description: x.description,
        isPlatform: x.isPlatform,
        questions: x.questions.map((q) => ({
          id: q.id,
          label: q.label,
          kind: q.kind,
          required: q.required,
          options: q.settings.options ?? [],
        })),
      }));
    body = (
      <>
        {stepCard(
          "pesquisa",
          <SurveyStep
            sessionId={id}
            templates={visible}
            selectedId={session.survey_template_id ?? generalTemplateId(templates, sessionLocale)}
            locked={readOnly && snapshot ? { name: snapshot.name } : null}
          />,
        )}
        {footer("pesquisa")}
      </>
    );
  } else if (step === "sorteio" && raffle) {
    body = (
      <>
        {stepCard("sorteio", <RaffleEditor sessionId={id} state={raffle} />)}
        {footer("sorteio")}
      </>
    );
  } else {
    const tReady = await getTranslations("session.ready");
    const tForm = await getTranslations("session.form");
    const surveyName = templates.find((x) => x.id === session.survey_template_id)?.name ?? null;
    const summary: Record<SessionStep, string> = {
      configuracoes: [session.pace === "self" ? tForm("paceSelf") : tForm("paceLive"), session.join_code].join(" · "),
      slides: tReady("slides", { count: session.slides_batch ? session.slide_count : 0 }),
      enquetes: tReady("interactions", { count: items.length }),
      pesquisa: surveyName ? tReady("survey", { name: surveyName }) : tReady("noSurvey"),
      sorteio: session.raffle_eligibility ? tReady("raffle", { count: raffle?.prizes.length ?? 0 }) : tReady("noRaffle"),
    };
    const missing = missingSteps(facts);
    body = (
      <>
        <Card>
          <CardHeader>
            <CardTitle id="step-title">{tReady("title")}</CardTitle>
            <CardDescription>{tReady("description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <ol className="flex flex-col divide-y rounded-lg border">
              {SESSION_STEPS.map((s, index) => (
                <li key={s} className="flex items-center gap-3 px-4 py-3 max-md:px-3">
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full border-2 font-display text-sm font-bold tabular-nums",
                      states[s] === "done" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                    )}
                  >
                    {states[s] === "done" ? <CheckIcon width={14} height={14} strokeWidth={3} /> : index + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">
                      {label(s)} <span className="sr-only">({tSteps(`state.${states[s]}`)})</span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{summary[s]}</span>
                  </span>
                  <Link href={stepHref(id, s)} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "max-md:h-11")}>
                    {tReady("edit")}
                    <span className="sr-only">: {label(s)}</span>
                  </Link>
                </li>
              ))}
            </ol>
            {missing.length > 0 && !readOnly ? (
              <Alert tone="info">{tReady("missing", { steps: missing.map(label).join(", ") })}</Alert>
            ) : null}
            {readOnly ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground">{tReady("completed")}</p>
                <Link href={`/dashboard/sessions/${id}/analytics`} className={buttonVariants({ className: "max-md:h-11 max-md:w-full" })}>
                  {t("viewAnalytics")}
                </Link>
              </div>
            ) : status === "draft" ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2 max-md:grid max-md:grid-cols-2">
                  <StartSessionButton sessionId={id} hasInteractions={items.length > 0} className="max-md:h-11" />
                  {!session.is_test ? <RehearsalButton sessionId={id} className={SECONDARY_MOBILE} /> : null}
                </div>
                <p className="text-xs text-muted-foreground">{tReady("startHint")}</p>
              </div>
            ) : (
              <div>
                <Link href={`/dashboard/sessions/${id}/live`} className={buttonVariants({ className: "max-md:h-11 max-md:w-full" })}>
                  {t("openLive")}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
        <StepFooter back={{ href: stepHref(id, "sorteio"), label: label("sorteio") }}>
          <span />
        </StepFooter>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4 max-md:flex-col max-md:items-stretch">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            <span className="text-sm text-muted-foreground">
              {t("joinCode")} <span className="font-display font-semibold text-foreground">{session.join_code}</span>
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight max-md:text-balance max-md:[overflow-wrap:anywhere]">
            {session.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {session.scheduled_at ? formatDateTime(session.scheduled_at, timeZone, locale) : tStates("noDate")}
          </p>
        </div>
        {/* Ação principal primeiro; excluir sempre por último. No celular: principal em largura total e as
            outras numa grade de duas colunas, todas com 44px. */}
        <div className="flex flex-wrap items-center gap-2 max-md:grid max-md:grid-cols-2">
          {status === "draft" ? (
            <StartSessionButton sessionId={id} hasInteractions={items.length > 0} className={PRIMARY_MOBILE} />
          ) : null}
          {status === "live" || status === "paused" ? (
            <Link href={`/dashboard/sessions/${id}/live`} className={cn(buttonVariants(), PRIMARY_MOBILE)}>
              {t("openLive")}
            </Link>
          ) : null}
          {status === "completed" ? (
            <Link href={`/dashboard/sessions/${id}/analytics`} className={cn(buttonVariants(), PRIMARY_MOBILE)}>
              {t("viewAnalytics")}
            </Link>
          ) : null}
          {status === "completed" && session.raffle_eligibility ? (
            <Link href={`/dashboard/sessions/${id}/live`} className={cn(buttonVariants({ variant: "outline" }), SECONDARY_MOBILE)}>
              {t("raffleRoom")}
            </Link>
          ) : null}
          {status !== "completed" && !session.is_test ? <RehearsalButton sessionId={id} className={SECONDARY_MOBILE} /> : null}
          {status !== "completed" ? (
            <QrDownloadButton
              joinUrl={joinUrl(session.join_code)}
              code={session.join_code}
              className={cn(SECONDARY_MOBILE, "max-md:text-sm")}
            />
          ) : null}
          <DuplicateSessionButton sessionId={id} title={session.title} className={SECONDARY_MOBILE} />
          <DeleteSessionButton sessionId={id} title={session.title} className={SECONDARY_MOBILE} />
        </div>
      </div>

      <SessionStepper sessionId={id} current={step} states={states} />

      <section aria-labelledby="step-title" className="flex flex-col gap-6">
        {body}
      </section>
      <StepFooterSpacer />
    </div>
  );
}
