"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { setSessionStatusAction } from "@/features/sessions/actions";
import type { PublicInteraction } from "@/lib/domain/interactions";
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
import { showLeaderboardAction } from "@/features/live/actions";
import type { SessionClock } from "@/lib/domain/timing";
import type { RaffleState } from "@/lib/data/raffle";
import { RafflePanel } from "./raffle-panel";
import { QuestionsCard } from "./questions-card";
import { ModerationPanel } from "./moderation-panel";
import { ReactionTotals } from "./reaction-totals";
import { EngagementSettings, type EngagementFlags } from "@/components/engagement/engagement-settings";
import { questionsOnScreen } from "@/lib/domain/questions";

export type ControlRoomInteraction = PublicInteraction & { correctOptionId: string | null };

type Props = {
  session: { id: string; title: string; status: string; joinCode: string };
  interactions: ControlRoomInteraction[];
  /** slides e interações na ordem da apresentação (sem slides, só as interações) */
  deck: DeckItem[];
  slideUrls: string[];
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
  const tCommon = useTranslations("common.actions");
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
  const slideOnScreen = live?.current_slide ?? null;

  const [lastActivated] = useState(() => lastActivatedOf(interactions));
  const controls = useDeckControls({
    sessionId: session.id,
    deck,
    live,
    lastActivated,
    enabled: status === "live",
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

  const [showAnswer, setShowAnswer] = useState(false);
  const [answerFor, setAnswerFor] = useState(activeId);
  if (answerFor !== activeId) {
    setAnswerFor(activeId);
    setShowAnswer(false);
  }

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
  const hasQuiz = interactions.some((i) => i.type === "quiz");
  const leaderboardOn = status === "live" && Boolean(live?.show_leaderboard);
  const raffleOn = raffle !== null && status !== "draft" && Boolean(live?.show_raffle);
  const questionsOn = questionsOnScreen(live);
  const toggleLeaderboard = (show: boolean) =>
    startTransition(async () => {
      const result = await showLeaderboardAction(session.id, show);
      if (!result.ok) toast.error(result.error);
      else await refreshLive();
    });
  const next = controls.next;

  return (
    <div className="flex flex-col gap-6">
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            {status !== "draft" ? (
              <TalkTimer clock={clock} plannedMinutes={plannedMinutes} running={status === "live"} paused={status === "paused"} />
            ) : null}
            {!connected ? <Badge variant="warning">{t("reconnecting")}</Badge> : null}
          </div>
          <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight">{session.title}</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <UsersIcon /> {t("participants", { count: participantCount })} · {t("connectedNow", { count: online })}
          </p>
          {engagement.reactions_enabled ? <ReactionTotals sessionId={session.id} running={status === "live"} /> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/session/${session.id}/display`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <ExternalIcon /> {t("projectorScreen")}
          </a>
          {status === "draft" ? (
            <Button onClick={() => changeStatus("live")} disabled={pending}>
              <PlayIcon /> {t("startSession")}
            </Button>
          ) : null}
          {status === "live" ? (
            <Button variant="outline" onClick={() => changeStatus("paused")} disabled={pending}>
              <PauseIcon /> {t("pause")}
            </Button>
          ) : null}
          {status === "paused" ? (
            <Button onClick={() => changeStatus("live")} disabled={pending}>
              <PlayIcon /> {t("resume")}
            </Button>
          ) : null}
          {status === "live" || status === "paused" ? (
            <Button
              variant="destructive"
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
              {t("endSession")}
            </Button>
          ) : null}
          {status === "completed" ? (
            <Link href={`/dashboard/sessions/${session.id}/analytics`} className={buttonVariants()}>
              {t("viewAnalytics")}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              {raffleOn ? (
                <>
                  <p className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("onScreen")}</p>
                  <CardTitle className="mt-1 text-xl">{t("raffle")}</CardTitle>
                </>
              ) : leaderboardOn ? (
                <>
                  <p className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("onScreen")}</p>
                  <CardTitle className="mt-1 text-xl">{t("leaderboard")}</CardTitle>
                </>
              ) : questionsOn ? (
                <>
                  <p className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("onScreen")}</p>
                  <CardTitle className="mt-1 text-xl">
                    {live?.question_id ? t("highlightedQuestion") : t("audienceQuestions")}
                  </CardTitle>
                </>
              ) : active ? (
                <>
                  <TypeTag type={active.type} />
                  <CardTitle className="mt-2 text-xl">{active.title}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("responsesOf", { count: (results[active.id] ?? EMPTY_SNAPSHOT).total, participants: participantCount })}
                  </p>
                </>
              ) : hasSlides && slideOnScreen !== null && status === "live" ? (
                <>
                  <p className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("onScreen")}</p>
                  <CardTitle className="mt-1 text-xl">
                    {t.rich("slideOf", {
                      slide: slideOnScreen + 1,
                      total: slideUrls.length,
                      muted: (chunks) => <span className="text-muted-foreground">{chunks}</span>,
                    })}
                  </CardTitle>
                </>
              ) : (
                <CardTitle className="text-xl">
                  {hasSlides && status === "live" ? t("qrOnScreen") : t("noActive")}
                </CardTitle>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {hasQuiz && status === "live" ? (
                <Button variant="outline" size="sm" disabled={pending} onClick={() => toggleLeaderboard(!leaderboardOn)}>
                  {leaderboardOn ? t("hideLeaderboard") : t("showLeaderboard")}
                </Button>
              ) : null}
              {active?.type === "quiz" ? (
                <Button variant="outline" size="sm" onClick={() => setShowAnswer((v) => !v)}>
                  {showAnswer ? t("hideAnswer") : t("showAnswer")}
                </Button>
              ) : null}
              {active ? (
                <Button variant="outline" size="sm" disabled={pending} onClick={controls.closeActive}>
                  <StopIcon /> {t("closeQuestion")}
                </Button>
              ) : null}
              {hasSlides ? (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t("previousSlide")}
                  disabled={pending || !controls.previous}
                  onClick={() => controls.previous && controls.goTo(controls.previous)}
                >
                  <ChevronLeftIcon /> {t("previous")}
                </Button>
              ) : null}
              <Button size="sm" disabled={pending || !next} onClick={() => next && controls.goTo(next)}>
                <NextIcon /> {t("next")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {raffleOn ? (
              <p className="py-10 text-center text-muted-foreground">
                {t("raffleOnScreenHint")}
              </p>
            ) : leaderboardOn ? (
              <QuizLeaderboard sessionId={session.id} version={live?.leaderboard_at ?? null} variant="compact" />
            ) : questionsOn ? (
              <p className="py-10 text-center text-muted-foreground">
                {t("questionsOnScreenHint")}
              </p>
            ) : active ? (
              <>
                <ResultsView
                  interaction={active}
                  snapshot={results[active.id] ?? EMPTY_SNAPSHOT}
                  correctOptionId={showAnswer ? active.correctOptionId : null}
                />
                {active.type === "word_cloud" || active.type === "open_text" ? (
                  <ModerationPanel interactionId={active.id} type={active.type} snapshot={results[active.id] ?? EMPTY_SNAPSHOT} />
                ) : null}
              </>
            ) : hasSlides && slideOnScreen !== null && slideUrls[slideOnScreen] && status === "live" ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage
              <img
                src={slideUrls[slideOnScreen]}
                alt={t("slide", { slide: slideOnScreen + 1 })}
                className="aspect-video w-full rounded-lg border bg-muted object-contain"
              />
            ) : (
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
            )}
            {status === "live" && (active || slideOnScreen !== null) ? (
              <p className="text-sm text-muted-foreground">
                {next
                  ? t.rich(hasSlides ? "upNextSlides" : "upNextKeys", {
                      item: itemLabel(next),
                      strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
                    })
                  : t("lineupEnd")}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <QuestionsCard
            sessionId={session.id}
            live={live}
            status={status}
            enabled={engagement.qa_enabled}
            onChanged={refreshLive}
          />
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
              <div className="flex flex-wrap justify-center gap-2">
                <QrDownloadButton joinUrl={joinUrl} code={session.joinCode} />
                {hasSlides && status === "live" ? (
                  <Button variant="outline" size="sm" disabled={pending || (slideOnScreen === null && !active)} onClick={controls.showJoinScreen}>
                    <QrCodeIcon /> {t("showOnScreen")}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

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
              <ol className={cn("flex flex-col gap-1", hasSlides && "max-h-[28rem] overflow-y-auto pr-1")}>
                {deck.map((item, index) => {
                  const isCurrent = index === controls.cursor;
                  const onScreen =
                    item.kind === "interaction"
                      ? item.id === activeId
                      : !active && slideOnScreen === item.index && status === "live";
                  const total = item.kind === "interaction" ? (results[item.id] ?? EMPTY_SNAPSHOT).total : 0;
                  return (
                    <li key={item.kind === "slide" ? `s${item.index}` : item.id}>
                      <button
                        type="button"
                        disabled={pending || status !== "live" || onScreen}
                        onClick={() => controls.goTo(item)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors",
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
                              className="aspect-video w-14 shrink-0 rounded border bg-muted object-cover"
                            />
                            <span className="min-w-0 flex-1 truncate text-muted-foreground">
                              {t("slide", { slide: item.index + 1 })}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="w-5 shrink-0 font-display font-bold text-muted-foreground tabular-nums">
                              {interactions.findIndex((i) => i.id === item.id) + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{byId.get(item.id)?.title}</span>
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

          <Card>
            <CardHeader>
              <CardTitle>{t("participation")}</CardTitle>
            </CardHeader>
            <CardContent>
              <EngagementSettings sessionId={session.id} initial={engagement} compact />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}