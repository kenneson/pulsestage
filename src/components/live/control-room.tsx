"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { setActiveInteractionAction } from "@/features/interactions/actions";
import { setSessionStatusAction } from "@/features/sessions/actions";
import type { PublicInteraction } from "@/lib/domain/interactions";
import { EMPTY_SNAPSHOT } from "@/lib/domain/results";
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
import { ExternalIcon, NextIcon, PauseIcon, PlayIcon, StopIcon, UsersIcon } from "@/components/icons";
import { ResultsView } from "@/components/results/results-view";
import { StatusBadge } from "@/components/sessions/status-badge";
import { TypeTag } from "@/components/interaction-type-tag";

export type ControlRoomInteraction = PublicInteraction & { correctOptionId: string | null };

type Props = {
  session: { id: string; title: string; status: string; joinCode: string };
  interactions: ControlRoomInteraction[];
  initialLive: LiveState | null;
  initialResults: ResultsMap;
  joinUrl: string;
};

export function ControlRoom({ session, interactions, initialLive, initialResults, joinUrl }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  const { state: live, connected } = useLiveState(session.id, initialLive, () => router.refresh());
  const results = useInteractionResults(session.id, initialResults);
  const online = usePresence(session.id, "observer");

  const status: SessionStatus = toSessionStatus(live?.status ?? session.status);
  const activeId = live?.active_interaction_id ?? null;
  const active = interactions.find((i) => i.id === activeId) ?? null;

  // Última interaction ativada, para saber qual é a "próxima" depois de encerrar.
  const [lastActivated, setLastActivated] = useState<string | null>(activeId);
  const [showAnswer, setShowAnswer] = useState(false);
  if (activeId && activeId !== lastActivated) {
    setLastActivated(activeId);
    setShowAnswer(false);
  }

  const lastIndex = lastActivated ? interactions.findIndex((i) => i.id === lastActivated) : -1;
  const next = interactions[lastIndex + 1] ?? null;

  const run = useCallback(
    (task: () => Promise<{ ok: boolean; error?: string }>) => {
      startTransition(async () => {
        const result = await task();
        if (!result.ok) toast.error(result.error ?? "Algo deu errado.");
      });
    },
    [startTransition],
  );

  const activate = useCallback(
    (interactionId: string | null) => run(() => setActiveInteractionAction(session.id, interactionId)),
    [run, session.id],
  );

  const changeStatus = (to: SessionStatus) =>
    startTransition(async () => {
      const result = await setSessionStatusAction(session.id, to);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (to === "completed") router.push(`/dashboard/sessions/${session.id}/analytics`);
    });

  // Atalho: seta para a direita ativa a próxima interaction.
  const nextRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    nextRef.current = status === "live" && next && !pending ? () => activate(next.id) : null;
  });
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "ArrowRight") nextRef.current?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const participantCount = live?.participant_count ?? 0;

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
          <CardHeader className="flex-row items-start justify-between gap-4">
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
              ) : (
                <CardTitle className="text-xl">Nenhuma interação ativa</CardTitle>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {active?.type === "quiz" ? (
                <Button variant="outline" size="sm" onClick={() => setShowAnswer((v) => !v)}>
                  {showAnswer ? "Ocultar resposta" : "Mostrar resposta"}
                </Button>
              ) : null}
              {active ? (
                <Button variant="outline" size="sm" disabled={pending} onClick={() => activate(null)}>
                  <StopIcon /> Encerrar
                </Button>
              ) : null}
              <Button size="sm" disabled={pending || status !== "live" || !next} onClick={() => next && activate(next.id)}>
                <NextIcon /> Próxima
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {active ? (
              <ResultsView
                interaction={active}
                snapshot={results[active.id] ?? EMPTY_SNAPSHOT}
                correctOptionId={showAnswer ? active.correctOptionId : null}
              />
            ) : (
              <p className="py-10 text-center text-muted-foreground">
                {status === "live"
                  ? next
                    ? `Próxima: "${next.title}". Clique em Próxima ou pressione →.`
                    : "Todas as interações foram apresentadas."
                  : status === "paused"
                    ? "Sessão pausada. Retome para ativar interações."
                    : status === "draft"
                      ? "Inicie a sessão para ativar interações."
                      : "Sessão encerrada."}
              </p>
            )}
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Roteiro</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-1">
                {interactions.map((interaction, index) => {
                  const isActive = interaction.id === activeId;
                  const total = (results[interaction.id] ?? EMPTY_SNAPSHOT).total;
                  return (
                    <li key={interaction.id}>
                      <button
                        type="button"
                        disabled={pending || status !== "live" || isActive}
                        onClick={() => activate(interaction.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                          isActive ? "bg-primary/10 font-medium" : "hover:bg-muted disabled:hover:bg-transparent",
                        )}
                      >
                        <span className="w-5 shrink-0 font-script font-bold text-muted-foreground tabular-nums">{index + 1}</span>
                        <span className="min-w-0 flex-1 truncate">{interaction.title}</span>
                        {isActive ? (
                          <Badge variant="live">Ativa</Badge>
                        ) : total > 0 ? (
                          <span className="text-xs text-muted-foreground tabular-nums">{total}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
              {interactions.length === 0 ? (
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
