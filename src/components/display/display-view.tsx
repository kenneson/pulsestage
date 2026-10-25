"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
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
import { JoinLobby } from "./join-lobby";
import { screenContent } from "@/lib/domain/screen";
import { useAudioUnlock } from "@/lib/raffle/use-audio-unlock";
import { lastActivatedOf, useDeckControls } from "@/components/live/use-deck-controls";
import { SCREEN, SPRING, STAGGER_S } from "@/components/motion/presets";

const joinHost = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/join\/.*/, "");

function JoinPanel({ code, joinUrl, size = 260 }: { code: string; joinUrl: string; size?: number }) {
  const t = useTranslations("display.join");
  return (
    <div className="flex flex-col items-center gap-6">
      <m.div
        className="rounded-3xl bg-white p-5"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={SPRING.soft}
      >
        <QRCodeSVG value={joinUrl} size={size} marginSize={0} />
      </m.div>
      <p className="text-2xl text-muted-foreground max-md:text-center max-md:text-lg">
        {t.rich("prompt", {
          host: joinHost(joinUrl),
          b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
        })}
      </p>
      {/* O código entra letra a letra, para chamar o olhar de quem vai digitar. */}
      <p className="font-display text-8xl font-bold tracking-[0.2em] max-md:text-5xl" aria-label={code}>
        {Array.from(code).map((char, index) => (
          <m.span
            key={`${index}-${char}`}
            aria-hidden
            className="inline-block"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING.snappy, delay: 0.15 + index * STAGGER_S }}
          >
            {char}
          </m.span>
        ))}
      </p>
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
        <h1 className="text-6xl font-semibold max-md:text-4xl">{t("completed.title")}</h1>
        <p className="text-3xl text-muted-foreground max-md:text-xl">{t("completed.subtitle")}</p>
        <div className="rounded-3xl bg-white p-5">
          <QRCodeSVG value={feedbackUrl} size={280} marginSize={0} />
        </div>
      </div>
    );
  } else if (screen.kind === "paused") {
    body = (
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-6xl font-semibold max-md:text-4xl">{t("paused.title")}</h1>
        <p className="text-3xl text-muted-foreground max-md:text-xl">{t("paused.subtitle")}</p>
      </div>
    );
  } else if (screen.kind === "leaderboard") {
    body = <QuizLeaderboard sessionId={session.id} version={state?.leaderboard_at ?? null} />;
  } else if (screen.kind === "questions") {
    body = <AudienceQuestionsStage sessionId={session.id} version={state?.questions_at ?? null} joinHost={joinHost(joinUrl)} />;
  } else if (active) {
    body = (
      <div className="flex w-full min-w-0 max-w-6xl flex-col gap-10 max-md:gap-6">
        <h1 className="text-center text-5xl font-semibold leading-tight max-md:text-3xl md:text-6xl">{active.title}</h1>
        <ResultsView
          interaction={active}
          snapshot={snapshot}
          variant="display"
          animated
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
    // QR Code de entrada com a sala de espera: quem entra aparece com avatar e nome.
    body = (
      <JoinLobby
        sessionId={session.id}
        title={session.title}
        participantCount={state?.participant_count ?? 0}
        panel={<JoinPanel code={session.joinCode} joinUrl={joinUrl} />}
      />
    );
  }

  return (
    // O telão é para o projetor; aberto num celular, só não pode vazar para os lados nem estourar o texto.
    <div className={cn("dark flex flex-col bg-background text-foreground max-md:overflow-x-clip", slideUrl ? "h-dvh" : "min-h-dvh")}>
      <main className={cn("flex min-h-0 flex-1 items-center justify-center", slideUrl ? "p-4" : "px-10 py-12 max-md:px-4 max-md:py-8")}>
        {/* Troca de tela (QR, pergunta, ranking, slides…) com transição; de um slide para outro, troca direta. */}
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={screen.kind === "interaction" ? `interaction:${screen.id}` : screen.kind}
            {...SCREEN}
            className={cn("flex w-full items-center justify-center", slideUrl && "h-full min-h-0")}
          >
            {body}
          </m.div>
        </AnimatePresence>
      </main>
      <ReactionStream sessionId={session.id} active={status === "live"} />
      <footer
        className={cn(
          "flex items-center justify-between px-10 text-muted-foreground max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-1 max-md:px-4 max-md:text-sm",
          slideUrl ? "pb-3 text-lg" : "pb-6 text-xl",
        )}
      >
        <span>
          {/* Na tela de entrada a sala de espera já conta quem entrou (e, em rascunho, o contador do realtime
              não chega ao telão): o rodapé fica só com quem está conectado. */}
          {[
            slideUrl
              ? t("footer.joinAt", { host: joinHost(joinUrl) })
              : active
                ? t("footer.responses", { count: snapshot.total })
                : screen.kind === "join"
                  ? null
                  : t("footer.participants", { count: state?.participant_count ?? 0 }),
            online > 0 && !slideUrl ? t("footer.connected", { count: online }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
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
