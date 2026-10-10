// Deck: os slides da apresentação e as interações numa única sequência.
// Regra pura (sem I/O). Cada interação guarda "depois de quantos slides" ela entra (after_slide);
// null ou um valor maior que o total de slides significa "no fim".

export const MAX_SLIDES = 300; // igual ao check de sessions.slide_count
export const SLIDE_RENDER_WIDTH = 1920;
export const SLIDE_FORMATS = ["webp", "jpeg"] as const;
export type SlideFormat = (typeof SLIDE_FORMATS)[number];

export type DeckItem = { kind: "slide"; index: number } | { kind: "interaction"; id: string };

/** Interação vista pelo deck, na ordem de `position`. */
export type DeckInteraction = { id: string; afterSlide: number | null };

/** Arranjo para gravar: ids na nova ordem e o after_slide de cada um. */
export type Arrangement = { ids: string[]; afterSlides: (number | null)[] };

export function isSlideFormat(value: string | null | undefined): value is SlideFormat {
  return (SLIDE_FORMATS as readonly string[]).includes(value ?? "");
}

/** Caminho no bucket "slides". O índice começa em 0; o arquivo, em 001. */
export function slidePath(speakerId: string, sessionId: string, batch: string, index: number, format: SlideFormat): string {
  return `${speakerId}/${sessionId}/${batch}/${String(index + 1).padStart(3, "0")}.${format === "jpeg" ? "jpg" : "webp"}`;
}

/** Em que lacuna do deck a interação entra: 0 = antes do 1º slide, slideCount = no fim. */
export function anchorOf(afterSlide: number | null, slideCount: number): number {
  if (afterSlide === null || afterSlide > slideCount) return slideCount;
  return Math.max(0, afterSlide);
}

/** Interações na ordem do deck: por lacuna e, dentro dela, pela ordem do roteiro. */
function inDeckOrder(interactions: readonly DeckInteraction[], slideCount: number): DeckInteraction[] {
  return interactions
    .map((item, order) => ({ item, order, anchor: anchorOf(item.afterSlide, slideCount) }))
    .sort((a, b) => a.anchor - b.anchor || a.order - b.order)
    .map((entry) => entry.item);
}

export function buildDeck(slideCount: number, interactions: readonly DeckInteraction[]): DeckItem[] {
  const ordered = inDeckOrder(interactions, slideCount);
  const deck: DeckItem[] = [];
  let cursor = 0;
  for (let gap = 0; gap <= slideCount; gap++) {
    while (cursor < ordered.length && anchorOf(ordered[cursor]!.afterSlide, slideCount) === gap) {
      deck.push({ kind: "interaction", id: ordered[cursor]!.id });
      cursor++;
    }
    if (gap < slideCount) deck.push({ kind: "slide", index: gap });
  }
  return deck;
}

export function sameItem(a: DeckItem | null | undefined, b: DeckItem | null | undefined): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  return a.kind === "slide" ? a.index === (b as { index: number }).index : a.id === (b as { id: string }).id;
}

export function deckIndexOf(deck: readonly DeckItem[], item: DeckItem | null): number {
  return item ? deck.findIndex((d) => sameItem(d, item)) : -1;
}

/** Próximo item depois do cursor (-1 = antes do início). */
export function nextItem(deck: readonly DeckItem[], cursor: number): DeckItem | null {
  return deck[cursor + 1] ?? null;
}

/**
 * "Voltar": o slide anterior ao cursor. Numa interação, é o slide que está por trás dela
 * (voltar fecha a pergunta e mostra o slide de novo); interações no caminho são puladas.
 */
export function previousSlide(deck: readonly DeckItem[], cursor: number): DeckItem | null {
  for (let i = Math.min(cursor, deck.length) - 1; i >= 0; i--) {
    const item = deck[i];
    if (item?.kind === "slide") return item;
  }
  return null;
}

/**
 * Onde a apresentação parou, ao abrir a sala ao vivo ou o projetor: a interação ativa;
 * senão o que foi mostrado por último entre o slide atual e a última interação aberta.
 */
export function initialCursor(
  deck: readonly DeckItem[],
  live: {
    activeInteractionId: string | null;
    currentSlide: number | null;
    currentSlideChangedAt: string | null;
  },
  lastActivated: { id: string; at: string } | null,
): number {
  if (live.activeInteractionId) {
    const active = deckIndexOf(deck, { kind: "interaction", id: live.activeInteractionId });
    if (active >= 0) return active;
  }
  const slide = live.currentSlide === null ? -1 : deckIndexOf(deck, { kind: "slide", index: live.currentSlide });
  const interaction = lastActivated ? deckIndexOf(deck, { kind: "interaction", id: lastActivated.id }) : -1;
  if (slide < 0) return interaction;
  if (interaction < 0) return slide;
  const slideAt = live.currentSlideChangedAt ? Date.parse(live.currentSlideChangedAt) : 0;
  return Date.parse(lastActivated!.at) > slideAt ? interaction : slide;
}

function arrangementOf(ordered: readonly DeckInteraction[]): Arrangement {
  return { ids: ordered.map((i) => i.id), afterSlides: ordered.map((i) => i.afterSlide) };
}

/** Coloca a interação no fim da lacuna escolhida (depois de `afterSlide` slides). */
export function placeInteraction(
  interactions: readonly DeckInteraction[],
  id: string,
  afterSlide: number | null,
  slideCount: number,
): Arrangement | null {
  const moving = interactions.find((i) => i.id === id);
  if (!moving) return null;
  const target = anchorOf(afterSlide, slideCount);
  const rest = inDeckOrder(
    interactions.filter((i) => i.id !== id),
    slideCount,
  );
  const insertAt = rest.findIndex((i) => anchorOf(i.afterSlide, slideCount) > target);
  const placed = { id, afterSlide: afterSlide === null || afterSlide >= slideCount ? null : target };
  const ordered = insertAt < 0 ? [...rest, placed] : [...rest.slice(0, insertAt), placed, ...rest.slice(insertAt)];
  return arrangementOf(ordered);
}

/**
 * Sobe ou desce uma posição no deck, passando pela interação vizinha.
 * Quem se move assume a lacuna da vizinha, para a ordem do roteiro seguir a da apresentação.
 */
export function moveInteraction(
  interactions: readonly DeckInteraction[],
  id: string,
  delta: -1 | 1,
  slideCount: number,
): Arrangement | null {
  const ordered = inDeckOrder(interactions, slideCount);
  const index = ordered.findIndex((i) => i.id === id);
  const target = index + delta;
  const moving = ordered[index];
  const neighbor = ordered[target];
  if (index < 0 || !moving || !neighbor) return null;
  const next = [...ordered];
  next[target] = slideCount > 0 ? { id: moving.id, afterSlide: neighbor.afterSlide } : moving;
  next[index] = neighbor;
  return arrangementOf(next);
}

/** Rótulo da lacuna para o seletor: "Antes do 1º slide", "Depois do slide 3", "No fim". */
export function gapLabel(afterSlide: number | null, slideCount: number): string {
  const anchor = anchorOf(afterSlide, slideCount);
  if (anchor >= slideCount) return "No fim";
  if (anchor === 0) return "Antes do 1º slide";
  return `Depois do slide ${anchor}`;
}
