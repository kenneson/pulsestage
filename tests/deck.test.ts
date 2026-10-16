import { test } from "node:test";
import assert from "node:assert/strict";
import {
  anchorOf,
  buildDeck,
  deckIndexOf,
  dropInteraction,
  gapLabel,
  initialCursor,
  insertAfterItem,
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

test("pergunta criada ao vivo entra logo depois do que está no telão e vira a próxima", () => {
  const interactions: DeckInteraction[] = [
    { id: "a", afterSlide: 1 },
    { id: "b", afterSlide: 1 },
    { id: "c", afterSlide: null },
    { id: "nova", afterSlide: null },
  ];
  // [slide0, a, b, slide1, slide2, c]
  // No telão o slide 1 (índice 0): entra antes de "a", na mesma lacuna.
  const afterSlide = insertAfterItem(interactions, "nova", slide(0), 3);
  assert.deepEqual(afterSlide, { ids: ["nova", "a", "b", "c"], afterSlides: [1, 1, 1, null] });
  assert.deepEqual(nextItem(buildDeck(3, idsToDeck(afterSlide)), 0), ask("nova"));
  // Na pergunta "a": entra entre "a" e "b".
  assert.deepEqual(insertAfterItem(interactions, "nova", ask("a"), 3), {
    ids: ["a", "nova", "b", "c"],
    afterSlides: [1, 1, 1, null],
  });
  // Último slide: vai para o fim, antes de "c" (que também está no fim).
  assert.deepEqual(insertAfterItem(interactions, "nova", slide(2), 3).ids, ["a", "b", "nova", "c"]);
  // Nada mostrado ainda: primeiro item do deck.
  assert.deepEqual(insertAfterItem(interactions, "nova", null, 3), {
    ids: ["nova", "a", "b", "c"],
    afterSlides: [0, 1, 1, null],
  });
  // Sem slides: logo depois da última pergunta lançada.
  assert.deepEqual(insertAfterItem(interactions, "nova", ask("b"), 0).ids, ["a", "b", "nova", "c"]);
});

function idsToDeck(arrangement: { ids: string[]; afterSlides: (number | null)[] }): DeckInteraction[] {
  return arrangement.ids.map((id, i) => ({ id, afterSlide: arrangement.afterSlides[i] ?? null }));
}

test("arrastar: a pergunta fica antes do item onde foi solta e herda a lacuna", () => {
  // Deck: a, S1, b, S2, S3, c(fim)
  const interactions: DeckInteraction[] = [
    { id: "a", afterSlide: 0 },
    { id: "b", afterSlide: 1 },
    { id: "c", afterSlide: null },
  ];
  // c solta antes do slide 2 (índice 1): depois do slide 1, logo após b.
  assert.deepEqual(dropInteraction(interactions, "c", slide(1), 3), { ids: ["a", "b", "c"], afterSlides: [0, 1, 1] });
  // c solta antes de b: mesma lacuna, mas na frente.
  assert.deepEqual(dropInteraction(interactions, "c", ask("b"), 3), { ids: ["a", "c", "b"], afterSlides: [0, 1, 1] });
  // a solta no fim.
  assert.deepEqual(dropInteraction(interactions, "a", null, 3), { ids: ["b", "c", "a"], afterSlides: [1, null, null] });
  // b solta antes do primeiro slide: lacuna 0, depois de a.
  assert.deepEqual(dropInteraction(interactions, "b", slide(0), 3), { ids: ["a", "b", "c"], afterSlides: [0, 0, null] });
});

test("arrastar: soltar sobre ela mesma ou pergunta inexistente não muda nada", () => {
  const interactions: DeckInteraction[] = [{ id: "a", afterSlide: 1 }];
  assert.equal(dropInteraction(interactions, "a", ask("a"), 2), null);
  assert.equal(dropInteraction(interactions, "x", null, 2), null);
  assert.equal(dropInteraction(interactions, "a", slide(9), 2), null);
});

test("deckIndexOf acha slides e interações pelo conteúdo, não pela referência", () => {
  const deck = buildDeck(2, [{ id: "q1", afterSlide: 1 }]);
  assert.equal(deckIndexOf(deck, { kind: "slide", index: 0 }), 0);
  assert.equal(deckIndexOf(deck, { kind: "interaction", id: "q1" }), 1);
  assert.equal(deckIndexOf(deck, { kind: "slide", index: 1 }), 2);
  assert.equal(deckIndexOf(deck, { kind: "interaction", id: "sumiu" }), -1);
  assert.equal(deckIndexOf(deck, { kind: "slide", index: 9 }), -1);
  assert.equal(deckIndexOf(deck, null), -1);
});
