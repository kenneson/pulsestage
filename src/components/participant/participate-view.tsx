"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { submitAnswerAction } from "@/features/participant/actions";
import {
  currentInteractionResponseSchema,
  type AnswerPayload,
  type CurrentInteractionResponse,
} from "@/lib/domain/interactions";
import type { LiveState } from "@/lib/realtime/schemas";
import { useLiveState } from "@/lib/realtime/use-live-state";
import { usePresence } from "@/lib/realtime/use-presence";
import { usePolling } from "@/lib/realtime/use-polling";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { CheckIcon, MessageQuestionIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { AnswerForm } from "./answer-form";
import { RaffleTicketCard } from "./raffle-ticket";
import { ReactionBar } from "./reaction-bar";
import { QuestionsPanel } from "./questions-panel";

/** Sem realtime: consulta a cada 5 s. Em rascunho, com realtime, uma conferência lenta caso o início se perca. */
const OFFLINE_POLL_MS = 5000;
const DRAFT_POLL_MS = 15000;
/** Leitura recente (realtime, início da página) dispensa a consulta periódica. */
const RECENT_FETCH_MS = 4000;

async function fetchCurrent(sessionId: string): Promise<CurrentInteractionResponse | null> {
  const res = await fetch(`/api/participant/${sessionId}/current`, { cache: "no-store" });
  if (res.status === 401) {
    window.location.reload();
    return null;
  }
  if (!res.ok) throw new Error("fetch_failed");
  const parsed = currentInteractionResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error("invalid_response");
  return parsed.data;
}

function Screen({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {text ? <p className="text-muted-foreground">{text}</p> : null}
      {children}
    </div>
  );
}

export function ParticipateView({
  sessionId,
  title,
  initialLive,
  initialCurrent,
  me,
}: {
  sessionId: string;
  title: string;
  initialLive: LiveState | null;
  initialCurrent: CurrentInteractionResponse;
  /** nome e avatar escolhidos ao entrar */
  me: { name: string | null; avatar: string | null };
}) {
  const t = useTranslations("participant.view");
  const [current, setCurrent] = useState<CurrentInteractionResponse>(initialCurrent);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const requestId = useRef(0);
  const lastFetchAt = useRef(0);

  const refresh = useCallback(() => {
    const id = ++requestId.current;
    lastFetchAt.current = Date.now();
    fetchCurrent(sessionId)
      .then((data) => {
        if (data && id === requestId.current) {
          setCurrent(data);
          setError(null);
        }
      })
      .catch(() => {
        if (id === requestId.current) setError(t("connectionUnstable"));
      });
  }, [sessionId, t]);

  const { state: live, connected, refresh: refreshLive } = useLiveState(sessionId, initialLive, refresh);
  usePresence(sessionId, "participant");

  const liveKey = `${live?.status ?? ""}:${live?.active_interaction_id ?? ""}`;
  const currentKey = `${current.status}:${current.interaction?.id ?? ""}`;

  // Sempre que status/interaction ativa mudar no realtime, busca o conteúdo no servidor.
  useEffect(() => {
    if (liveKey !== currentKey) refresh();
  }, [liveKey, currentKey, refresh]);

  // O conteúdo inicial veio do servidor junto com a página: conta como leitura recente.
  useEffect(() => {
    lastFetchAt.current = Date.now();
  }, []);

  const status = live?.status ?? current.status;
  const isDraft = status === "draft";

  // Rede de segurança: sem realtime, consulta periódica leve; em rascunho, uma conferência lenta
  // (a plateia pode entrar muito antes do início e não pode ficar presa se o evento se perder).
  usePolling(
    () => {
      if (Date.now() - lastFetchAt.current >= RECENT_FETCH_MS) refresh();
    },
    connected ? DRAFT_POLL_MS : OFFLINE_POLL_MS,
    !connected || isDraft,
  );

  // Em rascunho a plateia não lê session_live_state (RLS). Se a consulta mostrar que a sessão
  // começou antes de o realtime avisar, relê o estado ao vivo (agora visível).
  useEffect(() => {
    if (live?.status === "draft" && current.status !== "draft") void refreshLive();
  }, [live?.status, current.status, refreshLive]);

  async function submit(payload: AnswerPayload) {
    if (!current.interaction) return;
    setSubmitting(true);
    setError(null);
    const result = await submitAnswerAction(sessionId, current.interaction.id, payload);
    setSubmitting(false);
    if (result.ok || result.code === "duplicate") {
      setCurrent((c) => ({ ...c, answered: true }));
      return;
    }
    if (result.code === "closed" || result.code === "timeout") {
      setError(result.error);
      refresh();
      return;
    }
    if (result.code === "no_participant") {
      window.location.reload();
      return;
    }
    setError(result.error);
  }

  // O número do sorteio aparece fora das perguntas (respondendo, a atenção fica na pergunta).
  let showTicket = true;
  let body: React.ReactNode;

  if (status === "completed") {
    body = (
      <Screen title={t("endedTitle")} text={t("endedText")}>
        <Link href={`/feedback/${sessionId}`} className={buttonVariants({ size: "xl", className: "mt-4 w-full" })}>
          {t("rateSession")}
        </Link>
      </Screen>
    );
  } else if (status === "paused") {
    body = <Screen title={t("pausedTitle")} text={t("pausedText")} />;
  } else if (!current.interaction || current.status !== "live") {
    body = (
      <Screen title={me.name ? t("inNamed", { name: me.name }) : t("in")} text={isDraft ? t("startingSoon") : t("waiting")}>
        {me.avatar ? (
          <span aria-hidden className="order-first grid size-24 place-items-center rounded-full bg-muted text-6xl leading-none">
            {me.avatar}
          </span>
        ) : null}
        <span className="mt-4 size-3 animate-ping rounded-full bg-primary" aria-hidden />
      </Screen>
    );
  } else if (current.answered) {
    body = (
      <Screen title={t("answeredTitle")} text={t("answeredText")}>
        <span className="mt-2 grid size-14 place-items-center rounded-full bg-primary/15 text-primary">
          <CheckIcon width={28} height={28} />
        </span>
      </Screen>
    );
  } else {
    showTicket = false;
    const interaction = current.interaction;
    body = (
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-semibold leading-snug">{interaction.title}</h2>
          {interaction.description ? <p className="mt-1 text-muted-foreground">{interaction.description}</p> : null}
        </div>
        <AnswerForm key={interaction.id} interaction={interaction} onSubmit={submit} submitting={submitting} />
      </div>
    );
  }

  const { features } = current;
  const showQuestions = features.questions && (status === "live" || status === "paused");
  const showReactions = features.reactions && status === "live";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-5">
      <header className="flex items-center justify-between gap-3">
        {/* Sem link: um toque na marca não pode tirar a pessoa da sessão. */}
        <Logo href={null} className="text-sm" />
        <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <span className="truncate">{title}</span>
          {me.avatar ? (
            <span className="shrink-0 text-lg leading-none" title={me.name ?? undefined} aria-hidden>
              {me.avatar}
            </span>
          ) : null}
        </span>
      </header>
      <main className="flex flex-1 flex-col justify-center py-6" aria-live="polite">
        {error ? <Alert className="mb-4">{error}</Alert> : null}
        {body}
        {showTicket ? <RaffleTicketCard sessionId={sessionId} drawnAt={live?.raffle_drawn_at ?? null} className="mt-6" /> : null}
      </main>
      {showQuestions || showReactions ? (
        <footer className="sticky bottom-0 -mx-5 flex flex-col gap-3 border-t bg-background/95 px-5 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
          {showReactions ? <ReactionBar sessionId={sessionId} /> : null}
          {showQuestions ? (
            <Button variant="outline" size="lg" className="w-full" onClick={() => setQuestionsOpen(true)}>
              <MessageQuestionIcon /> {t("askSpeaker")}
            </Button>
          ) : null}
        </footer>
      ) : null}
      {questionsOpen && showQuestions ? (
        <QuestionsPanel sessionId={sessionId} myName={me.name} onClose={() => setQuestionsOpen(false)} />
      ) : null}
    </div>
  );
}
