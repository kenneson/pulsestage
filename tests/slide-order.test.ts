import { test } from "node:test";
import assert from "node:assert/strict";
import {
  identityOrder,
  isIdentityOrder,
  isSlideOrder,
  moveInOrder,
  remapAfterSlide,
  reorderInteractions,
  reorderSlideNotes,
} from "../src/lib/domain/slide-order.ts";
import { buildDeck } from "../src/lib/domain/deck.ts";

test("ordem dos slides: só permutações de 1..N", () => {
  assert.equal(isSlideOrder([2, 1, 3], 3), true);
  assert.equal(isSlideOrder([1, 1, 3], 3), false);
  assert.equal(isSlideOrder([1, 2], 3), false);
  assert.equal(isSlideOrder([1, 2, 4], 3), false);
  assert.equal(isIdentityOrder(identityOrder(4)), true);
  assert.equal(isIdentityOrder([1, 3, 2]), false);
});

test("mover na ordem: tira de uma posição e põe na outra", () => {
  assert.deepEqual(moveInOrder([1, 2, 3, 4], 3, 0), [4, 1, 2, 3]);
  assert.deepEqual(moveInOrder([1, 2, 3, 4], 0, 2), [2, 3, 1, 4]);
  assert.deepEqual(moveInOrder([1, 2, 3], 0, 9), [1, 2, 3]);
});

test("pergunta acompanha o slide; antes do 1º e no fim não mudam", () => {
  // slide 3 vai para a frente: [3, 1, 2, 4]
  const order = [3, 1, 2, 4];
  assert.equal(remapAfterSlide(3, order), 1);
  assert.equal(remapAfterSlide(1, order), 2);
  assert.equal(remapAfterSlide(0, order), 0);
  assert.equal(remapAfterSlide(null, order), null);
  // o slide 2 vai para o fim: a pergunta depois dele passa a ser "no fim"
  assert.equal(remapAfterSlide(2, [1, 3, 4, 2]), null);
});

test("roteiro segue o deck depois de reordenar", () => {
  const interactions = [
    { id: "a", afterSlide: 0 },
    { id: "b", afterSlide: 1 },
    { id: "c", afterSlide: 3 },
    { id: "d", afterSlide: null },
  ];
  const order = [3, 1, 2, 4];
  const arrangement = reorderInteractions(interactions, order);
  assert.deepEqual(arrangement, { ids: ["a", "c", "b", "d"], afterSlides: [0, 1, 2, null] });
  const deck = buildDeck(4, arrangement.ids.map((id, i) => ({ id, afterSlide: arrangement.afterSlides[i] ?? null })));
  assert.deepEqual(
    deck.map((item) => (item.kind === "slide" ? `s${item.index + 1}` : item.id)),
    ["a", "s1", "c", "s2", "b", "s3", "s4", "d"],
  );
});

test("notas acompanham o slide", () => {
  assert.deepEqual(reorderSlideNotes({ "1": "abertura", "3": "dados" }, [3, 1, 2]), { "1": "dados", "2": "abertura" });
  assert.deepEqual(reorderSlideNotes({ "9": "de um PDF antigo" }, [2, 1]), { "9": "de um PDF antigo" });
});
