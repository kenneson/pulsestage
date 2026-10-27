import { test } from "node:test";
import assert from "node:assert/strict";
import {
  missingSteps,
  nextStep,
  previousStep,
  SESSION_STEPS,
  stepFromParams,
  stepHref,
  stepIndex,
  stepState,
  stepStates,
  type StepFacts,
} from "../src/lib/domain/session-steps.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const empty: StepFacts = { created: true, slideCount: 0, interactionCount: 0, surveyTemplateId: null, raffleEnabled: false };

test("passos: ordem fixa", () => {
  assert.deepEqual([...SESSION_STEPS], ["configuracoes", "slides", "enquetes", "pesquisa", "sorteio"]);
});

test("passos: etapa da URL, padrão e abas antigas", () => {
  assert.equal(stepFromParams(undefined), "configuracoes");
  assert.equal(stepFromParams("slides"), "slides");
  assert.equal(stepFromParams(["pesquisa", "x"]), "pesquisa");
  assert.equal(stepFromParams("pronto"), "pronto");
  assert.equal(stepFromParams("qualquer"), "configuracoes");
  assert.equal(stepFromParams(undefined, "sorteio"), "sorteio");
  assert.equal(stepFromParams(undefined, "participacao"), "configuracoes");
  assert.equal(stepFromParams("enquetes", "sorteio"), "enquetes");
});

test("passos: endereço sem parâmetro no primeiro", () => {
  assert.equal(stepHref(ID, "configuracoes"), `/dashboard/sessions/${ID}`);
  assert.equal(stepHref(ID, "enquetes"), `/dashboard/sessions/${ID}?etapa=enquetes`);
  assert.equal(stepHref(ID, "pronto"), `/dashboard/sessions/${ID}?etapa=pronto`);
});

test("passos: anterior e próximo, com o resumo depois do último", () => {
  assert.equal(previousStep("configuracoes"), null);
  assert.equal(previousStep("slides"), "configuracoes");
  assert.equal(previousStep("pronto"), "sorteio");
  assert.equal(nextStep("configuracoes"), "slides");
  assert.equal(nextStep("sorteio"), "pronto");
  assert.equal(nextStep("pronto"), null);
  assert.equal(stepIndex("pronto"), 5);
  assert.equal(stepIndex("enquetes"), 2);
});

test("passos: estado de cada um", () => {
  assert.deepEqual(stepStates(empty), {
    configuracoes: "done",
    slides: "optional",
    enquetes: "pending",
    pesquisa: "pending",
    sorteio: "optional",
  });
  const full: StepFacts = { created: true, slideCount: 12, interactionCount: 3, surveyTemplateId: ID, raffleEnabled: true };
  assert.ok(Object.values(stepStates(full)).every((s) => s === "done"));
  assert.deepEqual(missingSteps(empty), ["enquetes", "pesquisa"]);
  assert.deepEqual(missingSteps(full), []);
});

test("passos: antes de criar a sessão, nada está feito", () => {
  const draft = { ...empty, created: false, surveyTemplateId: ID };
  assert.equal(stepState("configuracoes", draft), "pending");
  assert.equal(stepState("pesquisa", draft), "pending");
  assert.equal(stepState("slides", draft), "optional");
});
