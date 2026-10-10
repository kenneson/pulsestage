"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { setSessionStatusAction } from "@/features/sessions/actions";
import type { PublicInteraction } from "@/lib/domain/interactions";
import { INTERACTION_TYPE_META } from "@/lib/domain/interactions";
import { EMPTY_SNAPSHOT } from "@/lib/domain/results";
import type { DeckItem } from "@/lib/domain/deck";
import { toSessionStatus, type SessionStatus } from "@/lib/domain/session";
import { useLiveState } from "@/lib/realtime/use-live-state";
import { useInteractionResults } from "@/lib/realtime/use-interaction-results";
import type { ResultsMap } from "@/lib/domain/results";
import { usePresence } from "@/lib/realtime/use-presence";
import type { LiveState } from "@/lib/realtime/schemas";
import { plural } from "@/lib/format";
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
};

export function ControlRoom({ session, interactions, deck, slideUrls, initialLive, initialResults, joinUrl }: Props) {
  const router = useRouter();
  const [statusPending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  const { state: live, connected } = useLiveState(session.id, initialLive, () => router.refresh());
  const results = useInteractionResults(session.id, initialResults);
  const online = usePresence(session.id, "observer");

  const status: SessionStatus = toSessionStatus(live?.status ?? session.status);
  const activeId = live?.active_interaction_id ?? null;
  const active = interactions.find((i) => i.id === activeId) ?? null;
  const byId = new Map(interactions.map((i) => [i.id, i]));
  const hasSlides = slideUrls.length > 0;
  const slideOnScreen = live?.current_slide ?? null;

  const [lastActivated] = useState(() => lastActivatedOf(interactions));
  const controls = useDeckControls({ sessionId: session.id, deck, live, lastActivated, enabled: status === "live" });
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
      if (to === "completed") router.push(`/dashboard/sessions/${session.id}/analytics`);
    });

  function itemLabel(item: DeckItem): string {
    if (item.kind === "slide") return `Slide ${item.index + 1}`;
    const interaction = byId.get(item.id);
    return interaction ? `${INTERACTION_TYPE_META[interaction.type].label}: ${interaction.title}` : "Interação";
  }

  const participantCount = live?.participant_count ?? 0;
  const next = controls.next;

  return (
    <div className="flex flex-col gap-6">
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            {!connected ? <Badge variant="warning">Reconectando…</Badge> : null}
          </div>
          <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight">{session.title}</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <UsersIcon /> {plural(participantCount, "participante", "participantes")} · {online} conectados agora
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/session/${session.id}/display`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <ExternalIcon /> Tela do projetor
          </a>
          {status === "draft" ? (
            <Button onClick={() => changeStatus("live")} disabled={pending}>
              <PlayIcon /> Iniciar sessão
            </Button>
          ) : null}
          {status === "live" ? (
            <Button variant="outline" onClick={() => changeStatus("paused")} disabled={pending}>
              <PauseIcon /> Pausar
            </Button>
          ) : null}
          {status === "paused" ? (
            <Button onClick={() => changeStatus("live")} disabled={pending}>
              <PlayIcon /> Retomar
            </Button>
          ) : null}
          {status === "live" || status === "paused" ? (
            <Button
              variant="destructive"
              disabled={pending}
              onClick={async () => {
                const confirmed = await confirm({
                  title: "Encerrar a sessão?",
                  description: "Os participantes verão o link de avaliação. Não dá para reabrir.",
                  confirmLabel: "Encerrar",
                  destructive: true,
                });
                if (confirmed) changeStatus("completed");
              }}
            >
              Encerrar sessão
            </Button>
          ) : null}
          {status === "completed" ? (
            <Link href={`/dashboard/sessions/${session.id}/analytics`} className={buttonVariants()}>
              Ver analytics
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              {active ? (
                <>
                  <TypeTag type={active.type} />
                  <CardTitle className="mt-2 text-xl">{active.title}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plural((results[active.id] ?? EMPTY_SNAPSHOT).total, "resposta", "respostas")} de{" "}
                    {participantCount}
                  </p>
                </>
              ) : hasSlides && slideOnScreen !== null && status === "live" ? (
                <>
                  <p className="font-script text-xs font-bold uppercase tracking-wider text-muted-foreground">No telão</p>
                  <CardTitle className="mt-1 text-xl">
                    Slide {slideOnScreen + 1} <span className="text-muted-foreground">de {slideUrls.length}</span>
                  </CardTitle>
                </>
              ) : (
                <CardTitle className="text-xl">
                  {hasSlides && status === "live" ? "QR Code no telão" : "Nenhuma interação ativa"}
                </CardTitle>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {active?.type === "quiz" ? (
                <Button variant="outline" size="sm" onClick={() => setShowAnswer((v) => !v)}>
                  {showAnswer ? "Ocultar resposta" : "Mostrar resposta"}
                </Button>
              ) : null}
              {active ? (
                <Button variant="outline" size="sm" disabled={pending} onClick={controls.closeActive}>
                  <StopIcon /> Encerrar
                </Button>
              ) : null}
              {hasSlides ? (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Voltar ao slide anterior"
                  disabled={pending || !controls.previous}
                  onClick={() => controls.previous && controls.goTo(controls.previous)}
                >
                  <ChevronLeftIcon /> Anterior
                </Button>
              ) : null}
              <Button size="sm" disabled={pending || !next} onClick={() => next && controls.goTo(next)}>
                <NextIcon /> Próxima
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {active ? (
              <ResultsView
                interaction={active}
                snapshot={results[active.id] ?? EMPTY_SNAPSHOT}
                correctOptionId={showAnswer ? active.correctOptionId : null}
              />
            ) : hasSlides && slideOnScreen !== null && slideUrls[slideOnScreen] && status === "live" ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage
              <img
                src={slideUrls[slideOnScreen]}
                alt={`Slide ${slideOnScreen + 1}`}
                className="aspect-video w-full rounded-lg border bg-muted object-contain"
              />
            ) : (
              <p className="py-10 text-center text-muted-foreground">
                {status === "live"
                  ? next
                    ? `A seguir: ${itemLabel(next)}. Clique em Próxima ou pressione →.`
                    : "Todo o roteiro foi apresentado."
                  : status === "paused"
                    ? "Sessão pausada. Retome para continuar."
                    : status === "draft"
                      ? "Inicie a sessão para começar."
                      : "Sessão encerrada."}
              </p>
            )}
            {status === "live" && (active || slideOnScreen !== null) ? (
              <p className="text-sm text-muted-foreground">
                {next ? (
                  <>
                    A seguir: <span className="font-medium text-foreground">{itemLabel(next)}</span>
                    {hasSlides ? " · → ou PageDown avança, ← volta" : " · → avança"}
                  </>
                ) : (
                  "Fim do roteiro."
                )}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="items-center text-center">
            <CardContent className="flex flex-col items-center gap-3">
              <div className="rounded-xl bg-white p-3">
                <QRCodeSVG value={joinUrl} size={168} marginSize={0} />
              </div>
              <p className="text-sm text-muted-foreground">Código de entrada</p>
              <p className="font-script text-3xl font-bold tracking-widest">{session.joinCode}</p>
              <p className="break-all text-xs text-muted-foreground">{joinUrl}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <QrDownloadButton joinUrl={joinUrl} code={session.joinCode} />
                {hasSlides && status === "live" ? (
                  <Button variant="outline" size="sm" disabled={pending || (slideOnScreen === null && !active)} onClick={controls.showJoinScreen}>
                    <QrCodeIcon /> Mostrar no telão
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Roteiro</CardTitle>
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
                            <span className="min-w-0 flex-1 truncate text-muted-foreground">Slide {item.index + 1}</span>
                          </>
                        ) : (
                          <>
                            <span className="w-5 shrink-0 font-script font-bold text-muted-foreground tabular-nums">
                              {interactions.findIndex((i) => i.id === item.id) + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{byId.get(item.id)?.title}</span>
                          </>
                        )}
                        {onScreen ? (
                          <Badge variant="live">{item.kind === "slide" ? "No telão" : "Ativa"}</Badge>
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
                  Nenhuma interação.{" "}
                  <Link href={`/dashboard/sessions/${session.id}`} className="text-primary hover:underline">
                    Adicionar
                  </Link>
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
