"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import type { PublicInteraction } from "@/lib/domain/interactions";
import { EMPTY_SNAPSHOT, type ResultsMap } from "@/lib/domain/results";
import { toSessionStatus } from "@/lib/domain/session";
import type { LiveState } from "@/lib/realtime/schemas";
import { useLiveState } from "@/lib/realtime/use-live-state";
import { useInteractionResults } from "@/lib/realtime/use-interaction-results";
import { usePresence } from "@/lib/realtime/use-presence";
import { formatInt } from "@/lib/format";
import { ResultsView } from "@/components/results/results-view";

function JoinPanel({ code, joinUrl, size = 260 }: { code: string; joinUrl: string; size?: number }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="rounded-3xl bg-white p-5">
        <QRCodeSVG value={joinUrl} size={size} marginSize={0} />
      </div>
      <p className="text-2xl text-muted-foreground">
        Acesse <span className="font-semibold text-foreground">{joinUrl.replace(/^https?:\/\//, "").replace(/\/join\/.*/, "")}</span>{" "}
        e use o código
      </p>
      <p className="font-mono text-8xl font-bold tracking-[0.2em]">{code}</p>
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
}: {
  session: { id: string; title: string; joinCode: string };
  interactions: PublicInteraction[];
  initialLive: LiveState | null;
  initialResults: ResultsMap;
  joinUrl: string;
  feedbackUrl: string;
}) {
  const { state } = useLiveState(session.id, initialLive);
  const results = useInteractionResults(session.id, initialResults);
  const online = usePresence(session.id, "observer");
  const status = toSessionStatus(state?.status ?? "draft");
  const active = interactions.find((i) => i.id === state?.active_interaction_id) ?? null;
  const snapshot = active ? (results[active.id] ?? EMPTY_SNAPSHOT) : EMPTY_SNAPSHOT;
  const router = useRouter();
  const missingId = state?.active_interaction_id && !active ? state.active_interaction_id : null;

  // Interação criada depois que a tela abriu: recarrega os dados do servidor.
  useEffect(() => {
    if (missingId) router.refresh();
  }, [missingId, router]);

  let body: React.ReactNode;
  if (status === "completed") {
    body = (
      <div className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-6xl font-semibold">Obrigado pela participação!</h1>
        <p className="text-3xl text-muted-foreground">Leva 1 minuto: avalie a sessão.</p>
        <div className="rounded-3xl bg-white p-5">
          <QRCodeSVG value={feedbackUrl} size={280} marginSize={0} />
        </div>
      </div>
    );
  } else if (status === "paused") {
    body = (
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-6xl font-semibold">Sessão pausada</h1>
        <p className="text-3xl text-muted-foreground">Voltamos em instantes.</p>
      </div>
    );
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
  } else {
    body = (
      <div className="flex flex-col items-center gap-10 text-center">
        <h1 className="max-w-5xl text-5xl font-semibold leading-tight">{session.title}</h1>
        <JoinPanel code={session.joinCode} joinUrl={joinUrl} />
      </div>
    );
  }

  return (
    <div className="dark flex min-h-dvh flex-col bg-background text-foreground">
      <main className="flex flex-1 items-center justify-center px-10 py-12">{body}</main>
      <footer className="flex items-center justify-between px-10 pb-6 text-xl text-muted-foreground">
        <span>
          {active ? `${formatInt(snapshot.total)} respostas` : `${formatInt(state?.participant_count ?? 0)} participantes`}
          {online > 0 ? ` · ${formatInt(online)} conectados` : ""}
        </span>
        <span>
          Código <span className="font-mono font-bold text-foreground">{session.joinCode}</span>
        </span>
      </footer>
    </div>
  );
}
