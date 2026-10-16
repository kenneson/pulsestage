"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";
import type { PublicInteraction } from "@/lib/domain/interactions";
import { EMPTY_SNAPSHOT, type ResultsMap } from "@/lib/domain/results";
import { toSessionStatus } from "@/lib/domain/session";
import type { LiveState } from "@/lib/realtime/schemas";
import { useLiveState } from "@/lib/realtime/use-live-state";
import { useInteractionResults } from "@/lib/realtime/use-interaction-results";
import { usePresence } from "@/lib/realtime/use-presence";
import { cn } from "@/lib/utils";
import { ResultsView } from "@/components/results/results-view";
import type { DeckItem } from "@/lib/domain/deck";
import { QuizLeaderboard } from "./quiz-leaderboard";
import { RaffleStage } from "./raffle-stage";
import { AudienceQuestionsStage } from "./audience-questions-stage";
import { ReactionStream } from "./reaction-stream";
import { screenContent } from "@/lib/domain/screen";
import { useAudioUnlock } from "@/lib/raffle/use-audio-unlock";
import { lastActivatedOf, useDeckControls } from "@/components/live/use-deck-controls";

const joinHost = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/join\/.*/, "");

function JoinPanel({ code, joinUrl, size = 260 }: { code: string; joinUrl: string; size?: number }) {
  const t = useTranslations("display.join");
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="rounded-3xl bg-white p-5">
        <QRCodeSVG value={joinUrl} size={size} marginSize={0} />
      </div>
      <p className="text-2xl text-muted-foreground">
        {t.rich("prompt", {
          host: joinHost(joinUrl),
          b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
        })}
      </p>
      <p className="font-display text-8xl font-bold tracking-[0.2em]">{code}</p>
    </div>
  );
}

export function DisplayView({
  session,
  interactions,
  initialLive,
  initialResults,
  joinUrl,
  feedbackUrl,
  deck,
  slideUrls,
  canControl,
}: {
  session: { id: string; title: string; joinCode: string };
  interactions: PublicInteraction[];
  initialLive: LiveState | null;
  initialResults: ResultsMap;
  joinUrl: string;
  feedbackUrl: string;
  deck: DeckItem[];
  slideUrls: string[];
  /** o dono da sessão, logado neste navegador, pode avançar pelo teclado ou passador aqui mesmo */
  canControl: boolean;
}) {
  const t = useTranslations("display");
  // Um projetor por sessão: a releitura periódica cobre eventos do realtime que se percam.
  const { state } = useLiveState(session.id, initialLive, undefined, 10_000);
  const results = useInteractionResults(session.id, initialResults);
  const online = usePresence(session.id, "observer");
  const soundOn = useAudioUnlock();
  const status = toSessionStatus(state?.status ?? "draft");
  const byId = new Map(interactions.map((i) => [i.id, i]));
  const screen = screenContent(state, status, { slideCount: slideUrls.length, knowsInteraction: (id) => byId.has(id) });
  const active = screen.kind === "interaction" ? (byId.get(screen.id) ?? null) : null;
  const snapshot = active ? (results[active.id] ?? EMPTY_SNAPSHOT) : EMPTY_SNAPSHOT;
  const router = useRouter();
  const missingId = state?.active_interaction_id && !byId.has(state.active_interaction_id) ? state.active_interaction_id : null;

  const [lastActivated] = useState(() => lastActivatedOf(interactions));
  useDeckControls({ sessionId: session.id, deck, live: state, lastActivated, enabled: canControl && status === "live" });

  const slideIndex = screen.kind === "slide" ? screen.index : null;
  const slideUrl = slideIndex !== null ? slideUrls[slideIndex] : undefined;

  // Pré-carrega os próximos slides para a troca ser instantânea no telão.
  const current = state?.current_slide ?? -1;
  useEffect(() => {
    for (const url of slideUrls.slice(current + 1, current + 3)) {
      const img = new Image();
      img.src = url;
    }
  }, [current, slideUrls]);

  // Interação criada depois que a tela abriu: recarrega os dados do servidor.
  useEffect(() => {
    if (missingId) router.refresh();
  }, [missingId, router]);

  let body: React.ReactNode;
  if (screen.kind === "raffle") {
    // O sorteio vale também depois de encerrar (modo "quem responder a pesquisa").
    body = (
      <RaffleStage
        sessionId={session.id}
        version={state?.raffle_at ?? null}
        drawnAt={state?.raffle_drawn_at ?? null}
        feedbackUrl={feedbackUrl}
        soundOn={soundOn}
      />
    );
  } else if (screen.kind === "ended") {
    body = (
      <div className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-6xl font-semibold">{t("completed.title")}</h1>
        <p className="text-3xl text-muted-foreground">{t("completed.subtitle")}</p>
        <div className="rounded-3xl bg-white p-5">
          <QRCodeSVG value={feedbackUrl} size={280} marginSize={0} />
        </div>
      </div>
    );
  } else if (screen.kind === "paused") {
    body = (
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-6xl font-semibold">{t("paused.title")}</h1>
        <p className="text-3xl text-muted-foreground">{t("paused.subtitle")}</p>
      </div>
    );
  } else if (screen.kind === "leaderboard") {
    body = <QuizLeaderboard sessionId={session.id} version={state?.leaderboard_at ?? null} />;
  } else if (screen.kind === "questions") {
    body = <AudienceQuestionsStage sessionId={session.id} version={state?.questions_at ?? null} joinHost={joinHost(joinUrl)} />;
  } else if (active) {
    body = (
      <div className="flex w-full max-w-6xl flex-col gap-10">
        <h1 className="text-center text-5xl font-semibold leading-tight md:text-6xl">{active.title}</h1>
        <ResultsView
          interaction={active}
          snapshot={snapshot}
          variant="display"
          hideOpenText={active.type === "open_text" && !active.settings.showOnDisplay}
        />
      </div>
    );
  } else if (slideUrl) {
    body = (
      // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage, já em 1920 px
      <img src={slideUrl} alt={t("slideAlt", { slide: (slideIndex ?? 0) + 1 })} className="max-h-full max-w-full object-contain" />
    );
  } else {
    body = (
      <div className="flex flex-col items-center gap-10 text-center">
        <h1 className="max-w-5xl text-5xl font-semibold leading-tight">{session.title}</h1>
        <JoinPanel code={session.joinCode} joinUrl={joinUrl} />
      </div>
    );
  }

  return (
    <div className={cn("dark flex flex-col bg-background text-foreground", slideUrl ? "h-dvh" : "min-h-dvh")}>
      <main className={cn("flex min-h-0 flex-1 items-center justify-center", slideUrl ? "p-4" : "px-10 py-12")}>
        {body}
      </main>
      <ReactionStream sessionId={session.id} active={status === "live"} />
      <footer
        className={cn(
          "flex items-center justify-between px-10 text-muted-foreground",
          slideUrl ? "pb-3 text-lg" : "pb-6 text-xl",
        )}
      >
        <span>
          {slideUrl
            ? t("footer.joinAt", { host: joinHost(joinUrl) })
            : active
              ? t("footer.responses", { count: snapshot.total })
              : t("footer.participants", { count: state?.participant_count ?? 0 })}
          {online > 0 && !slideUrl ? ` · ${t("footer.connected", { count: online })}` : ""}
        </span>
        <span>
          {t.rich("footer.code", {
            code: session.joinCode,
            b: (chunks) => <span className="font-display font-bold text-foreground">{chunks}</span>,
          })}
        </span>
      </footer>
    </div>
  );
}
