import { test } from "node:test";
import assert from "node:assert/strict";
import { isScreenOverlay, screenContent, screenModeOf, screenModes, type ScreenLiveState } from "../src/lib/domain/screen.ts";

const base: ScreenLiveState = {
  active_interaction_id: null,
  current_slide: null,
  show_leaderboard: false,
  show_raffle: false,
  show_questions: false,
  question_id: null,
};
const live = (patch: Partial<ScreenLiveState> = {}): ScreenLiveState => ({ ...base, ...patch });

test("sem estado ou em rascunho, o telão mostra o QR Code", () => {
  assert.deepEqual(screenContent(null, "live"), { kind: "join" });
  assert.deepEqual(screenContent(live({ active_interaction_id: "a" }), "draft"), { kind: "join" });
});

test("o sorteio vence tudo, inclusive pausa e encerramento, mas não o rascunho", () => {
  const state = live({ show_raffle: true, show_leaderboard: true, active_interaction_id: "a" });
  assert.deepEqual(screenContent(state, "live"), { kind: "raffle" });
  assert.deepEqual(screenContent(state, "paused"), { kind: "raffle" });
  assert.deepEqual(screenContent(state, "completed"), { kind: "raffle" });
  assert.deepEqual(screenContent(state, "draft"), { kind: "join" });
});

test("encerrada e pausada vêm antes do ranking e da pergunta", () => {
  const state = live({ show_leaderboard: true, active_interaction_id: "a" });
  assert.deepEqual(screenContent(state, "completed"), { kind: "ended" });
  assert.deepEqual(screenContent(state, "paused"), { kind: "paused" });
});

test("ao vivo: ranking > perguntas da plateia > pergunta > slide > QR", () => {
  assert.deepEqual(screenContent(live({ show_leaderboard: true, show_questions: true }), "live"), { kind: "leaderboard" });
  assert.deepEqual(screenContent(live({ show_questions: true, question_id: "q", active_interaction_id: "a" }), "live"), {
    kind: "questions",
    questionId: "q",
  });
  assert.deepEqual(screenContent(live({ active_interaction_id: "a", current_slide: 2 }), "live", { slideCount: 5 }), {
    kind: "interaction",
    id: "a",
  });
  assert.deepEqual(screenContent(live({ current_slide: 2 }), "live", { slideCount: 5 }), { kind: "slide", index: 2 });
  assert.deepEqual(screenContent(live({ current_slide: null }), "live", { slideCount: 5 }), { kind: "join" });
});

test("slide fora do deck e pergunta desconhecida caem para o que está por trás", () => {
  assert.deepEqual(screenContent(live({ current_slide: 7 }), "live", { slideCount: 5 }), { kind: "join" });
  assert.deepEqual(
    screenContent(live({ active_interaction_id: "nova", current_slide: 1 }), "live", {
      slideCount: 5,
      knowsInteraction: (id) => id !== "nova",
    }),
    { kind: "slide", index: 1 },
  );
});

test("modo do seletor a partir do conteúdo", () => {
  assert.equal(screenModeOf({ kind: "interaction", id: "a" }), "lineup");
  assert.equal(screenModeOf({ kind: "slide", index: 0 }), "lineup");
  assert.equal(screenModeOf({ kind: "questions", questionId: null }), "questions");
  assert.equal(screenModeOf({ kind: "join" }), "join");
});

test("modos disponíveis dependem do status e das opções da sessão", () => {
  const all = { quiz: true, questions: true, raffle: true };
  assert.deepEqual(screenModes("live", all), ["lineup", "join", "leaderboard", "questions", "raffle"]);
  assert.deepEqual(screenModes("live", { quiz: false, questions: false, raffle: false }), ["lineup", "join"]);
  assert.deepEqual(screenModes("paused", all), ["paused", "raffle"]);
  assert.deepEqual(screenModes("completed", all), ["ended", "raffle"]);
  assert.deepEqual(screenModes("draft", all), ["join"]);
  // Perguntas desligadas com a lista ainda no telão: o modo atual continua visível.
  assert.deepEqual(screenModes("live", { quiz: false, questions: false, raffle: false }, "questions"), ["lineup", "join", "questions"]);
});

test("ranking, perguntas e sorteio ficam por cima do roteiro", () => {
  assert.equal(isScreenOverlay("leaderboard"), true);
  assert.equal(isScreenOverlay("raffle"), true);
  assert.equal(isScreenOverlay("lineup"), false);
  assert.equal(isScreenOverlay("join"), false);
});
