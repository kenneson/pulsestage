"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { setSessionStatusAction } from "@/features/sessions/actions";
import { acceptsResponses, isScoredType, type PublicInteraction } from "@/lib/domain/interactions";
import type { RevealedAnswer } from "@/lib/domain/answer-reveal";
import { findSegment, type SegmentGroup } from "@/lib/domain/live-room";
import { segmentApplies } from "@/lib/domain/segment-results";
import { EMPTY_SNAPSHOT } from "@/lib/domain/results";
import type { DeckItem } from "@/lib/domain/deck";
import { toSessionStatus, type SessionStatus } from "@/lib/domain/session";
import { useLiveState } from "@/lib/realtime/use-live-state";
import { useInteractionResults } from "@/lib/realtime/use-interaction-results";
import type { ResultsMap } from "@/lib/domain/results";
import { usePresence } from "@/lib/realtime/use-presence";
import type { LiveState } from "@/lib/realtime/schemas";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  ChevronLeftIcon,
  ExternalIcon,
  FileTextIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  QrCodeIcon,
  StopIcon,
  UsersIcon,
} from "@/components/icons";
import { ResultsView } from "@/components/results/results-view";
import { StatusBadge } from "@/components/sessions/status-badge";
import { TypeTag } from "@/components/interaction-type-tag";
import { QrDownloadButton } from "@/components/sessions/qr-download-button";
import { lastActivatedOf, useDeckControls } from "./use-deck-controls";
import { AddInteractionDialog } from "./add-interaction-dialog";
import { TalkTimer } from "./talk-timer";
import { QuizLeaderboard } from "@/components/display/quiz-leaderboard";
import type { SessionClock } from "@/lib/domain/timing";
import type { RaffleState } from "@/lib/data/raffle";
import { RafflePanel } from "./raffle-panel";
import { QuestionsCard, QuestionsOffLine } from "./questions-card";
import { ScreenSwitcher } from "./screen-switcher";
import { ModerationPanel } from "./moderation-panel";
import { ReactionTotals } from "./reaction-totals";
import { EngagementSettings, type EngagementFlags } from "@/components/engagement/engagement-settings";
import { DisclosureCard } from "@/components/ui/disclosure-card";
import { screenContent } from "@/lib/domain/screen";
import { QuestionCountdown } from "./question-countdown";
import { SpeakerNotes } from "./speaker-notes";
import { SegmentFilter, useSegmentSnapshot } from "./segment-filter";
import { LeaderboardModeToggle } from "./leaderboard-mode";
import { AnswerKeyLine, HiddenOnScreenNotice, ROOM_ACTION, RevealButtons } from "./reveal-controls";
import { ContentSummary } from "./content-summary";
import { SelfPacedPanel } from "./self-paced-panel";

/** Âncora do card Participação (o aviso de perguntas desligadas leva até ele). */
const ENGAGEMENT_ANCHOR = "live-engagement";

/** No celular, as ações do cabeçalho viram uma barra de botões iguais, com o ícone sobre o rótulo. */
const HEADER_ACTION_MOBILE =
  "max-md:h-auto max-md:min-h-14 max-md:flex-col max-md:gap-1 max-md:whitespace-normal max-md:px-2 max-md:py-2 max-md:text-center max-md:text-xs max-md:leading-tight";

export type ControlRoomInteraction = PublicInteraction & {
  correctOptionId: string | null;
  /** gabarito (quiz, quiz de digitar, adivinhe o número); só o dono vê */
  answer: RevealedAnswer | null;
  /** notas do palestrante (interactions.speaker_notes) */
  notes: string | null;
};

type Props = {
  session: {
    id: string;
    title: string;
    status: string;
    joinCode: string;
    /** "self": cada pessoa responde no seu ritmo; a sala vira painel de acompanhamento */
    pace: "live" | "self";
    teamsEnabled: boolean;
  };
  interactions: ControlRoomInteraction[];
  /** slides e interações na ordem da apresentação (sem slides, só as interações) */
  deck: DeckItem[];
  slideUrls: string[];
  /** notas por índice do slide no deck (0 = 1º slide) */
  slideNotes: Record<number, string>;
  /** enquetes de perfil ("comparar grupos") */
  segments: SegmentGroup[];
  initialLive: LiveState | null;
  initialResults: ResultsMap;
  joinUrl: string;
  /** início, fim e pausas da sessão, para o cronômetro */
  clock: SessionClock;
  plannedMinutes: number | null;
  /** null = sessão sem sorteio */
  raffle: RaffleState | null;
  /** perguntas da plateia, reações, filtro e moderação */
  engagement: EngagementFlags;
};

export function ControlRoom({
  session,
  interactions,
  deck,
  slideUrls,
  slideNotes,
  segments,
  initialLive,
  initialResults,
  joinUrl,
  clock,
  plannedMinutes,
  raffle,
  engagement,
}: Props) {
  const t = useTranslations("live.controlRoom");
  const tDomain = useTranslations("domain");
  const tScreen = useTranslations("live.screen");
  const tCommon = useTranslations("common.actions");
  const tNotes = useTranslations("live.notes");
  const tContent = useTranslations("live.content");
  const tSegment = useTranslations("live.segment");
  const router = useRouter();
  const [statusPending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  const { state: live, connected, refresh: refreshLive } = useLiveState(session.id, initialLive, () => router.refresh());
  const results = useInteractionResults(session.id, initialResults);
  const online = usePresence(session.id, "observer");

  const status: SessionStatus = toSessionStatus(live?.status ?? session.status);
  const activeId = live?.active_interaction_id ?? null;
  const active = interactions.find((i) => i.id === activeId) ?? null;
  const byId = new Map(interactions.map((i) => [i.id, i]));
  const hasSlides = slideUrls.length > 0;
  const selfPaced = session.pace === "self";

  const [lastActivated] = useState(() => lastActivatedOf(interactions));
  const controls = useDeckControls({
    sessionId: session.id,
    deck,
    live,
    lastActivated,
    enabled: status === "live" && !selfPaced,
    onChanged: refreshLive,
  });

  // Status mudou (aqui ou em outra janela): busca início e pausas atualizados para o cronômetro.
  const statusSeen = useRef(status);
  useEffect(() => {
    if (status === statusSeen.current) return;
    statusSeen.current = status;
    router.refresh();
  }, [status, router]);

  // Pergunta criada agora (aqui ou em outra janela) já está no ar: busca o conteúdo dela no servidor.
  const missingActive = activeId && !active ? activeId : null;
  useEffect(() => {
    if (missingActive) router.refresh();
  }, [missingActive, router]);
  const pending = statusPending || controls.pending;

  const changeStatus = (to: SessionStatus) =>
    startTransition(async () => {
      const result = await setSessionStatusAction(session.id, to);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      await refreshLive();
      // Com sorteio, a sala continua aberta: o sorteio costuma vir depois da pesquisa.
      if (to === "completed" && !raffle) router.push(`/dashboard/sessions/${session.id}/analytics`);
    });

  function itemLabel(item: DeckItem): string {
    if (item.kind === "slide") return t("slide", { slide: item.index + 1 });
    const interaction = byId.get(item.id);
    return interaction
      ? t("itemLabel", { type: tDomain(`interactionTypes.${interaction.type}.label`), title: interaction.title })
      : t("interactionFallback");
  }

  const participantCount = live?.participant_count ?? 0;
  // Ranking: qualquer tipo que pontua (quiz, quiz de digitar, adivinhe o número).
  const hasQuiz = interactions.some((i) => isScoredType(i.type));
  const screen = screenContent(live, status, { slideCount: slideUrls.length, knowsInteraction: (id) => byId.has(id) });
  // Com a sessão pausada, a pergunta aberta continua aqui (o telão mostra a pausa).
  const showsActive = active !== null && (screen.kind === "interaction" || screen.kind === "paused");
  const next = controls.next;
  // Saindo do QR Code: volta ao slide em que estava; sem slide, segue o roteiro.
  const resumeItem = controls.cursorItem?.kind === "slide" ? controls.cursorItem : next;
  // No celular, Anterior/Próxima ficam numa barra presa ao rodapé da tela (só enquanto a sessão está no ar).
  const mobileDeckBar = !selfPaced && (status === "live" || status === "paused");

  // Revelar no telão (zeram ao abrir outra pergunta).
  const resultsRevealed = live?.results_revealed ?? false;
  const answerRevealed = live?.answer_revealed ?? false;
  const activeTakesAnswers = active !== null && acceptsResponses(active.type);
  const hiddenOnScreen = activeTakesAnswers && active.settings.hideResults && !resultsRevealed;
  const canReveal = activeTakesAnswers && (active.settings.hideResults || isScoredType(active.type));

  // Comparar grupos: o filtro do telão vale também aqui (menos na própria enquete de perfil).
  const segment = findSegment(segments, live?.segment_option_id ?? null);
  const segmentOn =
    showsActive &&
    activeTakesAnswers &&
    segmentApplies({
      segmentOptionId: segment?.option.id ?? null,
      segmentInteractionId: segment?.group.interactionId ?? null,
      interactionId: active.id,
    });
  const segmentResult = useSegmentSnapshot(session.id, segmentOn ? active.id : null, segmentOn ? (segment?.option.id ?? null) : null);

  // Numeração do roteiro: só o que recebe resposta (slide de conteúdo não conta).
  const numberOf = new Map<string, number>();
  for (const i of interactions) if (acceptsResponses(i.type)) numberOf.set(i.id, numberOf.size + 1);

  // Notas: do item no telão; sem item do roteiro no telão, do próximo.
  const hasNotes = interactions.some((i) => i.notes) || Object.keys(slideNotes).length > 0;
  const notesItem: { item: DeckItem; upcoming: boolean } | null =
    screen.kind === "interaction"
      ? { item: { kind: "interaction", id: screen.id }, upcoming: false }
      : screen.kind === "slide"
        ? { item: { kind: "slide", index: screen.index }, upcoming: false }
        : status === "paused" && active
          ? { item: { kind: "interaction", id: active.id }, upcoming: false }
          : next
            ? { item: next, upcoming: true }
            : null;
  const notesText = notesItem
    ? notesItem.item.kind === "slide"
      ? (slideNotes[notesItem.item.index] ?? null)
      : (byId.get(notesItem.item.id)?.notes ?? null)
    : null;
  const notesLabel = notesItem
    ? tNotes(notesItem.upcoming ? "forNext" : "forItem", { item: itemLabel(notesItem.item) })
    : null;

  function screenTitle(): React.ReactNode {
    switch (screen.kind) {
      case "interaction": {
        const item = byId.get(screen.id);
        if (!item) return <CardTitle className="mt-1 text-xl">{t("interactionFallback")}</CardTitle>;
        return (
          <>
            <div className="mt-2">
              <TypeTag type={item.type} />
            </div>
            <CardTitle className="mt-2 text-xl">{item.title}</CardTitle>
            {acceptsResponses(item.type) ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("responsesOf", { count: (results[item.id] ?? EMPTY_SNAPSHOT).total, participants: participantCount })}
              </p>
            ) : null}
            {acceptsResponses(item.type) && item.settings.timerSeconds ? (
              <div className="mt-2">
                <QuestionCountdown
                  key={item.id}
                  activatedAt={live?.active_interaction_activated_at ?? item.activatedAt}
                  seconds={item.settings.timerSeconds}
                />
              </div>
            ) : null}
          </>
        );
      }
      case "slide":
        return (
          <CardTitle className="mt-1 text-xl">
            {t.rich("slideOf", {
              slide: screen.index + 1,
              total: slideUrls.length,
              muted: (chunks) => <span className="text-muted-foreground">{chunks}</span>,
            })}
          </CardTitle>
        );
      case "questions":
        return (
          <CardTitle className="mt-1 text-xl">{screen.questionId ? t("highlightedQuestion") : t("audienceQuestions")}</CardTitle>
        );
      default:
        return <CardTitle className="mt-1 text-xl">{tScreen(`labels.${screen.kind}`)}</CardTitle>;
    }
  }

  function screenBody(): React.ReactNode {
    if (screen.kind === "raffle") {
      return <p className="py-10 text-center text-muted-foreground">{t("raffleOnScreenHint")}</p>;
    }
    if (screen.kind === "leaderboard") {
      const mode = session.teamsEnabled ? (live?.leaderboard_mode ?? "people") : "people";
      return (
        <>
          {session.teamsEnabled ? (
            <LeaderboardModeToggle sessionId={session.id} mode={mode} disabled={pending} onChanged={refreshLive} />
          ) : null}
          <QuizLeaderboard sessionId={session.id} version={live?.leaderboard_at ?? null} variant="compact" mode={mode} />
        </>
      );
    }
    if (screen.kind === "questions") {
      return <p className="py-10 text-center text-muted-foreground">{t("questionsOnScreenHint")}</p>;
    }
    if (showsActive && active) {
      // Filtro de grupo: até o recorte chegar, mostra o resultado geral (com o aviso "Filtrando…").
      const snapshot = (segmentOn ? segmentResult?.snapshot : undefined) ?? results[active.id] ?? EMPTY_SNAPSHOT;
      return (
        <>
          {screen.kind === "paused" ? (
            <p className="text-sm text-muted-foreground">
              {tScreen.rich("pausedQuestion", {
                title: active.title,
                strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
              })}
            </p>
          ) : null}
          {!activeTakesAnswers ? (
            <ContentSummary interaction={active} />
          ) : (
            <>
              {hiddenOnScreen ? <HiddenOnScreenNotice /> : null}
              {segmentOn && segment ? (
                <p className="flex flex-wrap items-baseline gap-x-2 rounded-md bg-primary/10 px-3 py-2 text-sm">
                  <span>
                    {segmentResult
                      ? tSegment.rich("filtered", {
                          group: segment.option.label,
                          count: segmentResult.people,
                          strong: (chunks) => <span className="font-semibold">{chunks}</span>,
                        })
                      : tSegment("loading")}
                  </span>
                  <span className="text-xs text-muted-foreground">{tSegment("screenToo")}</span>
                </p>
              ) : null}
              <ResultsView
                interaction={active}
                snapshot={snapshot}
                correctOptionId={answerRevealed ? active.correctOptionId : null}
                answer={answerRevealed ? active.answer : null}
                animated
              />
              <AnswerKeyLine interaction={active} answer={active.answer} />
            </>
          )}
          {!segmentOn && (active.type === "word_cloud" || active.type === "open_text") ? (
            <ModerationPanel key={active.id} sessionId={session.id} interactionId={active.id} type={active.type} snapshot={snapshot} />
          ) : null}
        </>
      );
    }
    if (screen.kind === "slide" && slideUrls[screen.index]) {
      return (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage
        <img
          src={slideUrls[screen.index]}
          alt={t("slide", { slide: screen.index + 1 })}
          className="aspect-video w-full rounded-lg border bg-muted object-contain"
        />
      );
    }
    return (
      <p className="py-10 text-center text-muted-foreground">
        {status === "live"
          ? next
            ? t("upNextHint", { item: itemLabel(next) })
            : t("lineupDone")
          : status === "paused"
            ? t("pausedHint")
            : status === "draft"
              ? t("draftHint")
              : t("endedHint")}
      </p>
    );
  }

  const screenSwitcher = (
    <ScreenSwitcher
      sessionId={session.id}
      status={status}
      content={screen}
      features={{ quiz: hasQuiz, questions: engagement.qa_enabled, raffle: raffle !== null }}
      resumeItem={resumeItem}
      onShowJoin={controls.showJoinScreen}
      onResume={controls.goTo}
      onChanged={refreshLive}
      busy={pending}
      withLineup={!selfPaced}
    />
  );

  // Ritmo próprio: o telão mostra o QR Code; daqui ainda dá para pôr perguntas da plateia, ranking ou sorteio.
  const screenSwitcherCard = (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <div className="min-w-0">
          <p className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">{tScreen("now")}</p>
          {screenTitle()}
        </div>
        {screenSwitcher}
      </CardHeader>
    </Card>
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-6 max-md:gap-4",
        mobileDeckBar && "max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))]",
      )}
    >
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-4 max-md:gap-3">
        <div className="min-w-0 max-md:w-full">
          <div className="flex items-center gap-2 max-md:flex-wrap">
            <StatusBadge status={status} />
            {status !== "draft" ? (
              <TalkTimer clock={clock} plannedMinutes={plannedMinutes} running={status === "live"} paused={status === "paused"} />
            ) : null}
            {!connected ? <Badge variant="warning">{t("reconnecting")}</Badge> : null}
          </div>
          <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight max-md:whitespace-normal max-md:text-xl max-md:text-balance max-md:break-words">{session.title}</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <UsersIcon /> {t("participants", { count: participantCount })} · {t("connectedNow", { count: online })}
          </p>
          {engagement.reactions_enabled ? <ReactionTotals sessionId={session.id} running={status === "live"} /> : null}
        </div>
        <div className="flex flex-wrap gap-2 max-md:grid max-md:w-full max-md:auto-cols-fr max-md:grid-flow-col">
          <a
            href={`/session/${session.id}/display`}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), HEADER_ACTION_MOBILE)}
          >
            <ExternalIcon /> {t("projectorScreen")}
          </a>
          {status === "draft" ? (
            <Button onClick={() => changeStatus("live")} disabled={pending} className={HEADER_ACTION_MOBILE}>
              <PlayIcon /> {t("startSession")}
            </Button>
          ) : null}
          {status === "live" ? (
            <Button variant="outline" onClick={() => changeStatus("paused")} disabled={pending} className={HEADER_ACTION_MOBILE}>
              <PauseIcon /> {t("pause")}
            </Button>
          ) : null}
          {status === "paused" ? (
            <Button onClick={() => changeStatus("live")} disabled={pending} className={HEADER_ACTION_MOBILE}>
              <PlayIcon /> {t("resume")}
            </Button>
          ) : null}
          {status === "live" || status === "paused" ? (
            <Button
              variant="outline"
              className={cn("text-destructive hover:text-destructive", HEADER_ACTION_MOBILE)}
              disabled={pending}
              onClick={async () => {
                const confirmed = await confirm({
                  title: t("endConfirm.title"),
                  description: raffle ? t("endConfirm.descriptionRaffle") : t("endConfirm.description"),
                  confirmLabel: t("endConfirm.confirm"),
                  destructive: true,
                });
                if (confirmed) changeStatus("completed");
              }}
            >
              <StopIcon /> {t("endSession")}
            </Button>
          ) : null}
          {status === "completed" ? (
            <Link href={`/dashboard/sessions/${session.id}/analytics`} className={cn(buttonVariants(), HEADER_ACTION_MOBILE)}>
              {t("viewAnalytics")}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid items-start gap-6 max-md:grid-cols-1 max-md:gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        {selfPaced ? (
          <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
            {screenSwitcherCard}
            <SelfPacedPanel
              sessionId={session.id}
              status={status}
              interactions={interactions}
              results={results}
              participantCount={participantCount}
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
            <Card>
              <CardHeader className="flex flex-col gap-4">
                <div className="flex w-full flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">{tScreen("now")}</p>
                    {screenTitle()}
                  </div>
                  <div
                    className={cn(
                      "flex shrink-0 flex-wrap items-center gap-2",
                      mobileDeckBar
                        ? "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:gap-x-3 max-md:border-t max-md:bg-background/95 max-md:px-4 max-md:pt-2 max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom))] max-md:shadow-[0_-8px_24px_-16px_color-mix(in_oklch,var(--foreground)_30%,transparent)] max-md:backdrop-blur"
                        : "max-md:hidden",
                    )}
                  >
                    {status === "live" ? (
                      <p className="w-full truncate text-xs text-muted-foreground md:hidden">
                        {next
                          ? t.rich("upNext", {
                              item: itemLabel(next),
                              strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
                            })
                          : t("lineupEnd")}
                      </p>
                    ) : null}
                    {hasSlides ? (
                      <Button
                        variant="outline"
                        aria-label={t("previousSlide")}
                        aria-keyshortcuts="ArrowLeft PageUp"
                        disabled={pending || !controls.previous}
                        onClick={() => controls.previous && controls.goTo(controls.previous)}
                        className="max-md:h-12 max-md:flex-1"
                      >
                        <ChevronLeftIcon /> {t("previous")}
                      </Button>
                    ) : null}
                    <Button
                      size="lg"
                      className="min-w-40 max-md:h-12 max-md:min-w-0 max-md:flex-[2]"
                      aria-keyshortcuts="ArrowRight PageDown"
                      disabled={pending || !next}
                      onClick={() => next && controls.goTo(next)}
                    >
                      <NextIcon /> {t("next")}
                      <kbd aria-hidden className="ml-1 rounded border border-primary-foreground/40 px-1.5 font-sans text-xs leading-5 max-md:hidden">
                        →
                      </kbd>
                    </Button>
                  </div>
                </div>
                {screenSwitcher}
                {segments.length > 0 &&
            (status === "live" || status === "paused") &&
            screen.kind !== "leaderboard" &&
            screen.kind !== "raffle" &&
            screen.kind !== "questions" ? (
                  <SegmentFilter
                    sessionId={session.id}
                    groups={segments}
                    value={live?.segment_option_id ?? null}
                    disabled={pending}
                    onChanged={refreshLive}
                  />
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {screenBody()}
                {status === "live" && screen.kind !== "join" ? (
                  <p className="text-sm text-muted-foreground max-md:hidden">
                    {next
                      ? t.rich(hasSlides ? "upNextSlides" : "upNextKeys", {
                          item: itemLabel(next),
                          strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
                        })
                      : t("lineupEnd")}
                  </p>
                ) : null}
                {showsActive && active ? (
                  // No celular, com algo a revelar, os botões sobem para cima do gráfico (sem rolar até o fim).
                  <div className={cn("flex flex-wrap gap-2", canReveal && "max-md:order-first")}>
                    {activeTakesAnswers ? (
                      <RevealButtons
                        sessionId={session.id}
                        interaction={active}
                        canRevealAnswer={isScoredType(active.type)}
                        resultsRevealed={resultsRevealed}
                        answerRevealed={answerRevealed}
                        disabled={pending}
                        onChanged={refreshLive}
                      />
                    ) : null}
                    <Button variant="outline" size="sm" className={ROOM_ACTION} disabled={pending} onClick={controls.closeActive}>
                      <StopIcon /> {activeTakesAnswers ? t("closeQuestion") : tContent("removeFromScreen")}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
            {hasNotes ? <SpeakerNotes label={notesLabel} text={notesText} /> : null}
          </div>
        )}

        <div className="flex flex-col gap-6 max-md:gap-4">
          {selfPaced ? null : (
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2">
                <CardTitle>{t("lineup")}</CardTitle>
                {status === "live" || status === "paused" ? (
                  <AddInteractionDialog
                    sessionId={session.id}
                    after={controls.cursorItem}
                    canLaunch={status === "live"}
                    onChanged={refreshLive}
                  />
                ) : null}
              </CardHeader>
              <CardContent>
                <ol className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto pr-1 max-md:-mx-2 max-md:max-h-[24rem] max-md:pr-0">
                  {deck.map((item, index) => {
                    const isCurrent = index === controls.cursor;
                    const onScreen =
                      item.kind === "interaction"
                        ? item.id === activeId
                        : screen.kind === "slide" && screen.index === item.index;
                    const total = item.kind === "interaction" ? (results[item.id] ?? EMPTY_SNAPSHOT).total : 0;
                    return (
                      <li key={item.kind === "slide" ? `s${item.index}` : item.id}>
                        <button
                          type="button"
                          disabled={pending || status !== "live" || onScreen}
                          onClick={() => controls.goTo(item)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors max-md:min-h-11",
                            isCurrent ? "bg-primary/10 font-medium" : "hover:bg-muted disabled:hover:bg-transparent",
                            item.kind === "slide" && "py-1",
                          )}
                        >
                          {item.kind === "slide" ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage */}
                              <img
                                src={slideUrls[item.index]}
                                alt=""
                                loading="lazy"
                                className="aspect-video w-14 shrink-0 rounded border bg-muted object-cover max-md:w-16"
                              />
                              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                {t("slide", { slide: item.index + 1 })}
                              </span>
                            </>
                          ) : numberOf.has(item.id) ? (
                            <>
                              <span className="w-5 shrink-0 font-display font-bold text-muted-foreground tabular-nums">
                                {numberOf.get(item.id)}
                              </span>
                              <span className="min-w-0 flex-1 truncate max-md:line-clamp-2 max-md:whitespace-normal">{byId.get(item.id)?.title}</span>
                            </>
                          ) : (
                            // Slide de conteúdo: item do roteiro, sem respostas.
                            <>
                              <FileTextIcon aria-label={tContent("item")} className="size-4 w-5 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1 truncate max-md:line-clamp-2 max-md:whitespace-normal">{byId.get(item.id)?.title}</span>
                            </>
                          )}
                          {onScreen ? (
                            <Badge variant="live">{item.kind === "slide" ? t("onScreen") : t("active")}</Badge>
                          ) : total > 0 ? (
                            <span className="text-xs text-muted-foreground tabular-nums">{total}</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {deck.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("noInteractions")}{" "}
                    <Link href={`/dashboard/sessions/${session.id}`} className="text-primary hover:underline">
                      {tCommon("add")}
                    </Link>
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )}

          {engagement.qa_enabled ? (
            <QuestionsCard sessionId={session.id} live={live} status={status} onChanged={refreshLive} />
          ) : (
            <QuestionsOffLine engagementAnchor={ENGAGEMENT_ANCHOR} />
          )}
          {raffle ? (
            <RafflePanel sessionId={session.id} initial={raffle} status={status} live={live} onChanged={refreshLive} />
          ) : null}
          <Card className="items-center text-center">
            <CardContent className="flex flex-col items-center gap-3">
              <div className="rounded-xl bg-white p-3">
                <QRCodeSVG value={joinUrl} size={168} marginSize={0} />
              </div>
              <p className="text-sm text-muted-foreground">{t("joinCode")}</p>
              <p className="font-display text-3xl font-bold tracking-widest">{session.joinCode}</p>
              <p className="break-all text-xs text-muted-foreground">{joinUrl}</p>
              <div className="flex flex-wrap justify-center gap-2 max-md:[&_button]:h-11">
                <QrDownloadButton joinUrl={joinUrl} code={session.joinCode} />
                {status === "live" ? (
                  <Button variant="outline" size="sm" disabled={pending || screen.kind === "join"} onClick={controls.showJoinScreen}>
                    <QrCodeIcon /> {t("showOnScreen")}
                  </Button>
                ) : null}
              </div>
              <a
                href={`/join/${session.joinCode}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline max-md:min-h-11"
              >
                <ExternalIcon /> {t("openAsParticipant")}
              </a>
            </CardContent>
          </Card>

          {/* Ajuste raro durante a palestra: recolhido, com quantas opções estão ligadas. */}
          <DisclosureCard
            id={ENGAGEMENT_ANCHOR}
            className="scroll-mt-20"
            title={t("participation")}
            summary={t("participationOn", { count: Object.values(engagement).filter(Boolean).length })}
          >
            <div className="max-md:[&_input]:mt-0 max-md:[&_label]:min-h-11 max-md:[&_label]:items-center max-md:[&_ul]:gap-0">
              <EngagementSettings sessionId={session.id} initial={engagement} compact />
            </div>
          </DisclosureCard>
        </div>
      </div>
    </div>
  );
}
