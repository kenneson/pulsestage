import { test } from "node:test";
import assert from "node:assert/strict";
import {
  anchorOf,
  buildDeck,
  gapLabel,
  initialCursor,
  moveInteraction,
  nextItem,
  placeInteraction,
  previousSlide,
  slidePath,
  type DeckInteraction,
} from "../src/lib/domain/deck.ts";

const slide = (index: number) => ({ kind: "slide" as const, index });
const ask = (id: string) => ({ kind: "interaction" as const, id });

test("sem slides, o deck é o roteiro na ordem", () => {
  assert.deepEqual(
    buildDeck(0, [
      { id: "a", afterSlide: 3 },
      { id: "b", afterSlide: null },
    ]),
    [ask("a"), ask("b")],
  );
});

test("interações entram nas lacunas; null e valores acima do total vão para o fim", () => {
  const interactions: DeckInteraction[] = [
    { id: "abre", afterSlide: 0 },
    { id: "meio", afterSlide: 2 },
    { id: "fim", afterSlide: null },
    { id: "alem", afterSlide: 99 },
  ];
  assert.deepEqual(buildDeck(3, interactions), [ask("abre"), slide(0), slide(1), ask("meio"), slide(2), ask("fim"), ask("alem")]);
});

test("na mesma lacuna vale a ordem do roteiro, mesmo se a ordem gravada estiver fora de sequência", () => {
  const interactions: DeckInteraction[] = [
    { id: "depois", afterSlide: 2 },
    { id: "antes", afterSlide: 1 },
    { id: "depois2", afterSlide: 2 },
  ];
  assert.deepEqual(buildDeck(2, interactions), [slide(0), ask("antes"), slide(1), ask("depois"), ask("depois2")]);
});

test("próximo e anterior: voltar pula interações e, numa pergunta, mostra o slide por trás dela", () => {
  const deck = buildDeck(3, [{ id: "q", afterSlide: 2 }]);
  // [slide0, slide1, q, slide2]
  assert.deepEqual(nextItem(deck, -1), slide(0));
  assert.deepEqual(nextItem(deck, 1), ask("q"));
  assert.equal(nextItem(deck, 3), null);
  assert.deepEqual(previousSlide(deck, 3), slide(1));
  assert.deepEqual(previousSlide(deck, 2), slide(1));
  assert.deepEqual(previousSlide(deck, 1), slide(0));
  assert.equal(previousSlide(deck, 0), null);
});

test("cursor inicial: interação ativa; senão o que foi mostrado por último", () => {
  const deck = buildDeck(3, [{ id: "q", afterSlide: 1 }]);
  // [slide0, q, slide1, slide2]
  const live = { activeInteractionId: null, currentSlide: 2, currentSlideChangedAt: "2026-10-10T10:05:00Z" };
  assert.equal(initialCursor(deck, { ...live, activeInteractionId: "q" }, null), 1);
  assert.equal(initialCursor(deck, live, { id: "q", at: "2026-10-10T10:00:00Z" }), 3);
  assert.equal(initialCursor(deck, live, { id: "q", at: "2026-10-10T10:06:00Z" }), 1);
  assert.equal(initialCursor(deck, { ...live, currentSlide: null }, null), -1);
});

test("posicionar: a interação vai para o fim da lacuna escolhida e o roteiro segue o deck", () => {
  const interactions: DeckInteraction[] = [
    { id: "a", afterSlide: 1 },
    { id: "b", afterSlide: 1 },
    { id: "c", afterSlide: null },
  ];
  assert.deepEqual(placeInteraction(interactions, "c", 0, 4), { ids: ["c", "a", "b"], afterSlides: [0, 1, 1] });
  assert.deepEqual(placeInteraction(interactions, "a", 1, 4), { ids: ["b", "a", "c"], afterSlides: [1, 1, null] });
  assert.deepEqual(placeInteraction(interactions, "a", 4, 4), { ids: ["b", "c", "a"], afterSlides: [1, null, null] });
  assert.equal(placeInteraction(interactions, "x", 0, 4), null);
});

test("subir/descer troca com a vizinha e assume a lacuna dela", () => {
  const interactions: DeckInteraction[] = [
    { id: "a", afterSlide: 1 },
    { id: "b", afterSlide: 3 },
  ];
  assert.deepEqual(moveInteraction(interactions, "b", -1, 5), { ids: ["b", "a"], afterSlides: [1, 1] });
  assert.deepEqual(moveInteraction(interactions, "a", 1, 5), { ids: ["b", "a"], afterSlides: [3, 3] });
  assert.equal(moveInteraction(interactions, "a", -1, 5), null);
  // Sem slides, só troca a ordem.
  assert.deepEqual(moveInteraction(interactions, "b", -1, 0), { ids: ["b", "a"], afterSlides: [3, 1] });
});

test("rótulos, lacunas e caminhos no storage", () => {
  assert.equal(anchorOf(-2, 5), 0);
  assert.equal(gapLabel(0, 5), "Antes do 1º slide");
  assert.equal(gapLabel(3, 5), "Depois do slide 3");
  assert.equal(gapLabel(null, 5), "No fim");
  assert.equal(slidePath("u", "s", "b", 0, "webp"), "u/s/b/001.webp");
  assert.equal(slidePath("u", "s", "b", 11, "jpeg"), "u/s/b/012.jpg");
});
