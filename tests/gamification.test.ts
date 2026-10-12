import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AVATARS,
  avatarKeySchema,
  avatarOf,
  droppedImages,
  imageOwner,
  optionImagePathSchema,
  optionImageUrl,
  optionShape,
  quizPoints,
} from "../src/lib/domain/gamification.ts";

const SPEAKER = "11111111-2222-4333-8444-555555555555";
const FILE = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

test("avatares: chaves únicas e válidas para o banco", () => {
  const keys = AVATARS.map((a) => a.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const key of keys) assert.match(key, /^[a-z]{2,20}$/);
  assert.equal(avatarKeySchema.safeParse("raposa").success, true);
  assert.equal(avatarKeySchema.safeParse("dragao").success, false);
});

test("avatarOf: chave desconhecida ou vazia vira null", () => {
  assert.equal(avatarOf("panda")?.emoji, "🐼");
  assert.equal(avatarOf("removido"), null);
  assert.equal(avatarOf(null), null);
});

test("optionShape: forma e cor seguem a posição e repetem depois da oitava", () => {
  assert.deepEqual(optionShape(0), { key: "triangle", label: "Triângulo", color: 1 });
  assert.equal(optionShape(3).key, "square");
  assert.equal(optionShape(8).key, "triangle");
  assert.equal(optionShape(9).color, 2);
});

test("quizPoints: sem bônus ou sem tempo limite, pontos cheios", () => {
  assert.equal(quizPoints(1000, 9000, 10, false), 1000);
  assert.equal(quizPoints(1000, 9000, null, true), 1000);
});

test("quizPoints: com bônus, cai de cheio até a metade ao longo do tempo", () => {
  assert.equal(quizPoints(1000, 0, 20, true), 1000);
  assert.equal(quizPoints(1000, 10_000, 20, true), 750);
  assert.equal(quizPoints(1000, 20_000, 20, true), 500);
  // Folga de rede depois do fim do tempo não tira mais pontos.
  assert.equal(quizPoints(1000, 22_000, 20, true), 500);
  assert.equal(quizPoints(0, 0, 20, true), 0);
});

test("caminho da imagem: só {speaker}/{uuid}.webp|jpg", () => {
  assert.equal(optionImagePathSchema.safeParse(`${SPEAKER}/${FILE}.webp`).success, true);
  assert.equal(optionImagePathSchema.safeParse(`${SPEAKER}/${FILE}.jpg`).success, true);
  assert.equal(optionImagePathSchema.safeParse(`${SPEAKER}/${FILE}.png`).success, false);
  assert.equal(optionImagePathSchema.safeParse(`../${FILE}.webp`).success, false);
  assert.equal(imageOwner(`${SPEAKER}/${FILE}.webp`), SPEAKER);
  assert.equal(imageOwner("x/y.webp"), null);
});

test("optionImageUrl monta a URL pública do bucket", () => {
  assert.equal(
    optionImageUrl("https://abc.supabase.co/", `${SPEAKER}/${FILE}.webp`),
    `https://abc.supabase.co/storage/v1/object/public/option-images/${SPEAKER}/${FILE}.webp`,
  );
});

test("droppedImages: imagens que saíram da pergunta, sem repetir", () => {
  assert.deepEqual(droppedImages(["a", "b", null, "a"], ["b", null]), ["a"]);
  assert.deepEqual(droppedImages([null], ["a"]), []);
});
