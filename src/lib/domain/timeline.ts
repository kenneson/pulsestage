// Linha do tempo da palestra: o que esteve no telão e por quanto tempo. Regra pura (sem I/O).
// Entra a lista de eventos gravados pelo banco (session_events); sai uma sequência de trechos
// contínuos a partir do início da sessão: slide, pergunta, QR Code ("join") ou pausa.

export type TimelineEvent = {
  at: string;
  kind: "status" | "slide" | "interaction_open" | "interaction_close";
  status?: string | null;
  slide?: number | null;
  interactionId?: string | null;
};

export type SegmentKind = "slide" | "interaction" | "join" | "pause";

export type Segment = {
  kind: SegmentKind;
  /** segundos desde o início da sessão */
  start: number;
  end: number;
  slide?: number;
  interactionId?: string;
};

export type Timeline = {
  segments: Segment[];
  /** do início ao fim, pausas incluídas (é o eixo do gráfico) */
  span: number;
  totals: Record<SegmentKind, number>;
  /** tempo somado de cada slide (um slide pode voltar à tela), do maior para o menor */
  slides: { slide: number; seconds: number }[];
  interactions: { interactionId: string; seconds: number }[];
};

const seconds = (from: number, to: number) => Math.max(0, (to - from) / 1000);

function sameSegment(a: Segment, b: Omit<Segment, "start" | "end">): boolean {
  return a.kind === b.kind && a.slide === b.slide && a.interactionId === b.interactionId;
}

/**
 * Monta a linha do tempo. Começa no primeiro "status live" e termina no "completed"
 * (ou em `endAt`, para uma sessão ainda em andamento). Null quando a sessão nunca começou.
 */
export function buildTimeline(events: readonly TimelineEvent[], endAt: string | null): Timeline | null {
  const sorted = events
    .map((event, order) => ({ event, order, t: Date.parse(event.at) }))
    .filter((e) => !Number.isNaN(e.t))
    .sort((a, b) => a.t - b.t || a.order - b.order);
  const first = sorted.findIndex((e) => e.event.kind === "status" && e.event.status === "live");
  if (first < 0) return null;
  const t0 = sorted[first]!.t;

  let paused = false;
  let slide: number | null = null;
  let active: string | null = null;
  let cursor = t0;
  let ended = false;
  const segments: Segment[] = [];

  const screen = (): Omit<Segment, "start" | "end"> => {
    if (paused) return { kind: "pause" };
    if (active) return { kind: "interaction", interactionId: active };
    if (slide !== null) return { kind: "slide", slide };
    return { kind: "join" };
  };
  const close = (t: number) => {
    if (t <= cursor) return;
    const piece = { ...screen(), start: seconds(t0, cursor), end: seconds(t0, t) };
    const last = segments[segments.length - 1];
    if (last && last.end === piece.start && sameSegment(last, piece)) last.end = piece.end;
    else segments.push(piece);
    cursor = t;
  };

  for (const { event, t } of sorted.slice(first + 1)) {
    close(t);
    if (event.kind === "status") {
      if (event.status === "completed") {
        ended = true;
        break;
      }
      paused = event.status === "paused";
    } else if (event.kind === "slide") {
      slide = event.slide ?? null;
    } else if (event.kind === "interaction_open" && event.interactionId) {
      active = event.interactionId;
    } else if (event.kind === "interaction_close" && event.interactionId === active) {
      active = null;
    }
  }
  if (!ended && endAt) close(Date.parse(endAt));

  const totals: Record<SegmentKind, number> = { slide: 0, interaction: 0, join: 0, pause: 0 };
  const bySlide = new Map<number, number>();
  const byInteraction = new Map<string, number>();
  for (const s of segments) {
    const length = s.end - s.start;
    totals[s.kind] += length;
    if (s.kind === "slide" && s.slide !== undefined) bySlide.set(s.slide, (bySlide.get(s.slide) ?? 0) + length);
    if (s.kind === "interaction" && s.interactionId) {
      byInteraction.set(s.interactionId, (byInteraction.get(s.interactionId) ?? 0) + length);
    }
  }

  return {
    segments,
    span: segments[segments.length - 1]?.end ?? 0,
    totals,
    slides: [...bySlide].map(([slideIndex, secs]) => ({ slide: slideIndex, seconds: secs })).sort((a, b) => b.seconds - a.seconds),
    interactions: [...byInteraction]
      .map(([interactionId, secs]) => ({ interactionId, seconds: secs }))
      .sort((a, b) => b.seconds - a.seconds),
  };
}

/**
 * Sessões apresentadas antes do registro de eventos: reconstrói o que dá com início/fim da sessão
 * e abertura/fechamento de cada pergunta. Os slides e as pausas dessas sessões não foram registrados.
 */
export function legacyEvents(
  session: { startedAt: string | null; endedAt: string | null },
  interactions: readonly { id: string; activatedAt: string | null; closedAt: string | null }[],
): TimelineEvent[] {
  if (!session.startedAt) return [];
  const events: TimelineEvent[] = [{ at: session.startedAt, kind: "status", status: "live" }];
  for (const i of interactions) {
    if (!i.activatedAt) continue;
    events.push({ at: i.activatedAt, kind: "interaction_open", interactionId: i.id });
    if (i.closedAt) events.push({ at: i.closedAt, kind: "interaction_close", interactionId: i.id });
  }
  if (session.endedAt) events.push({ at: session.endedAt, kind: "status", status: "completed" });
  return events;
}
