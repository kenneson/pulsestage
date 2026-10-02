"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitAnswerAction } from "@/features/participant/actions";
import {
  currentInteractionResponseSchema,
  type AnswerPayload,
  type CurrentInteractionResponse,
} from "@/lib/domain/interactions";
import type { LiveState } from "@/lib/realtime/schemas";
import { useLiveState } from "@/lib/realtime/use-live-state";
import { usePresence } from "@/lib/realtime/use-presence";
import { buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { CheckIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { AnswerForm } from "./answer-form";

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
}: {
  sessionId: string;
  title: string;
  initialLive: LiveState | null;
  initialCurrent: CurrentInteractionResponse;
}) {
  const [current, setCurrent] = useState<CurrentInteractionResponse>(initialCurrent);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(() => {
    const id = ++requestId.current;
    fetchCurrent(sessionId)
      .then((data) => {
        if (data && id === requestId.current) {
          setCurrent(data);
          setError(null);
        }
      })
      .catch(() => {
        if (id === requestId.current) setError("Conexão instável. Tentando de novo…");
      });
  }, [sessionId]);

  const { state: live, connected } = useLiveState(sessionId, initialLive, refresh);
  usePresence(sessionId, "participant");

  const liveKey = `${live?.status ?? ""}:${live?.active_interaction_id ?? ""}`;
  const currentKey = `${current.status}:${current.interaction?.id ?? ""}`;

  // Sempre que status/interaction ativa mudar no realtime, busca o conteúdo no servidor.
  useEffect(() => {
    if (liveKey !== currentKey) refresh();
  }, [liveKey, currentKey, refresh]);

  // Rede de segurança caso o realtime caia: consulta periódica leve.
  useEffect(() => {
    if (connected) return;
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [connected, refresh]);

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

  const status = live?.status ?? current.status;
  let body: React.ReactNode;

  if (status === "completed") {
    body = (
      <Screen title="Sessão encerrada" text="Obrigado por participar! Sua opinião ajuda a próxima apresentação.">
        <Link href={`/feedback/${sessionId}`} className={buttonVariants({ size: "xl", className: "mt-4 w-full" })}>
          Avaliar a sessão
        </Link>
      </Screen>
    );
  } else if (status === "paused") {
    body = <Screen title="Sessão pausada" text="Fique por aqui, já voltamos." />;
  } else if (!current.interaction || current.status !== "live") {
    body = (
      <Screen title="Você está dentro!" text="Aguardando a próxima interação…">
        <span className="mt-4 size-3 animate-ping rounded-full bg-primary" aria-hidden />
      </Screen>
    );
  } else if (current.answered) {
    body = (
      <Screen title="Resposta registrada" text="Acompanhe o resultado na tela do palestrante.">
        <span className="mt-2 grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckIcon width={28} height={28} />
        </span>
      </Screen>
    );
  } else {
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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-5">
      <header className="flex items-center justify-between gap-3">
        <Logo className="text-sm" />
        <span className="truncate text-sm text-muted-foreground">{title}</span>
      </header>
      <main className="flex flex-1 flex-col justify-center py-6" aria-live="polite">
        {error ? <Alert className="mb-4">{error}</Alert> : null}
        {body}
      </main>
    </div>
  );
}
