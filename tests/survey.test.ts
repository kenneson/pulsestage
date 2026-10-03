import { test } from "node:test";
import assert from "node:assert/strict";
import {
  answerFieldName,
  dimensionScores,
  draftToRows,
  headlineScore,
  npsScore,
  parseSurveyAnswers,
  questionResults,
  strengthsAndWeaknesses,
  templateDraftSchema,
  toSurveyQuestion,
  type SurveyQuestion,
} from "../src/lib/domain/survey.ts";

const q = (id: string, kind: SurveyQuestion["kind"], extra: Partial<SurveyQuestion> = {}): SurveyQuestion => ({
  id,
  position: 1,
  kind,
  label: `Pergunta ${id}`,
  dimension: null,
  required: false,
  settings: kind === "choice" ? { options: ["Sim", "Não"] } : {},
  ...extra,
});
const ans = (question_id: string, value_int: number | null, value_text: string | null = null) => ({
  question_id,
  value_int,
  value_text,
});

test("toSurveyQuestion descarta linhas corrompidas e dimensão em pergunta de texto", () => {
  const base = { id: "a", position: 1, label: "x", required: false };
  assert.equal(toSurveyQuestion({ ...base, kind: "slider", dimension: null, settings: {} }), null);
  assert.equal(toSurveyQuestion({ ...base, kind: "choice", dimension: null, settings: { options: ["só uma"] } }), null);
  assert.equal(toSurveyQuestion({ ...base, kind: "text", dimension: "clareza", settings: {} })?.dimension, null);
  assert.equal(toSurveyQuestion({ ...base, kind: "scale", dimension: "clareza", settings: "lixo" })?.dimension, "clareza");
});

test("parseSurveyAnswers valida faixa, índice da alternativa, obrigatórias e texto", () => {
  const questions = [q("s", "scale", { required: true }), q("n", "nps"), q("c", "choice"), q("t", "text")];
  const form = (values: Record<string, string>) => (field: string) => values[field];
  const ok = parseSurveyAnswers(
    questions,
    form({ [answerFieldName("s")]: "4", [answerFieldName("n")]: "10", [answerFieldName("c")]: "1", [answerFieldName("t")]: "  ótimo  " }),
  );
  assert.deepEqual(ok, {
    ok: true,
    answers: [
      { questionId: "s", valueInt: 4, valueText: null },
      { questionId: "n", valueInt: 10, valueText: null },
      { questionId: "c", valueInt: 1, valueText: null },
      { questionId: "t", valueInt: null, valueText: "ótimo" },
    ],
  });
  assert.equal(parseSurveyAnswers(questions, form({ [answerFieldName("n")]: "5" })).ok, false); // obrigatória vazia
  assert.equal(parseSurveyAnswers(questions, form({ [answerFieldName("s")]: "6" })).ok, false); // fora de 1–5
  assert.equal(parseSurveyAnswers(questions, form({ [answerFieldName("s")]: "3", [answerFieldName("c")]: "2" })).ok, false); // índice inexistente
  assert.equal(parseSurveyAnswers([q("t", "text")], form({})).ok, false); // nada respondido
});

test("NPS: promotores menos detratores", () => {
  assert.equal(npsScore([10, 9, 8, 7, 6, 0]), 0); // 2 promotores, 2 detratores
  assert.equal(npsScore([10, 10, 9]), 100);
  assert.equal(npsScore([]), null);
});

test("questionResults: distribuição, média e textos", () => {
  const scale = q("s", "scale");
  const choice = q("c", "choice");
  const text = q("t", "text");
  const [rs, rc, rt] = questionResults([scale, choice, text], [
    ans("s", 5), ans("s", 3), ans("c", 0), ans("c", 0), ans("c", 1), ans("t", null, " a "), ans("t", null, "  "),
  ]);
  assert.ok(rs?.kind === "scale" && rs.mean === 4 && rs.distribution.length === 5);
  assert.ok(rc?.kind === "choice");
  assert.deepEqual(rc.distribution.map((d) => d.count), [2, 1]);
  assert.ok(rt?.kind === "text");
  assert.deepEqual(rt.texts, ["a"]);
});

test("dimensões juntam perguntas da mesma dimensão e separam 1–5 de 0–10", () => {
  const questions = [
    q("c1", "scale", { dimension: "clareza" }),
    q("c2", "scale", { dimension: "clareza" }),
    q("u", "nps", { dimension: "utilidade" }),
    q("x", "choice"),
  ];
  const scores = dimensionScores(questions, [ans("c1", 5), ans("c2", 3), ans("u", 8), ans("u", 6), ans("x", 0)]);
  const clareza = scores.find((s) => s.dimension === "clareza");
  assert.equal(clareza?.mean, 4);
  assert.equal(clareza?.count, 2);
  assert.equal(clareza?.normalized, 0.75);
  assert.equal(headlineScore(scores), 7);
});

test("pontos fortes e fracos só com 3+ dimensões e amostra mínima", () => {
  const make = (dimension: SurveyQuestion["dimension"], values: number[]) => ({
    question: q(String(dimension), "scale", { dimension }),
    answers: values.map((v) => ans(String(dimension), v)),
  });
  const parts = [make("clareza", [5, 5, 5]), make("atencao", [2, 2, 2]), make("conteudo", [4, 4, 4]), make("didatica", [3, 3, 3])];
  const scores = dimensionScores(parts.map((p) => p.question), parts.flatMap((p) => p.answers));
  const { strengths, weaknesses } = strengthsAndWeaknesses(scores);
  assert.deepEqual(strengths.map((s) => s.dimension), ["clareza", "conteudo"]);
  assert.deepEqual(weaknesses.map((s) => s.dimension), ["atencao", "didatica"]);
  assert.deepEqual(strengthsAndWeaknesses(scores.slice(0, 2)), { strengths: [], weaknesses: [] });
  assert.deepEqual(strengthsAndWeaknesses(scores, 10), { strengths: [], weaknesses: [] });
});

test("rascunho do editor: valida e vira linhas na ordem", () => {
  const parsed = templateDraftSchema.safeParse({
    name: "Minha pesquisa",
    questions: [
      { kind: "scale", label: "Clareza", required: true, dimension: "clareza", minLabel: "Ruim", maxLabel: "" },
      { kind: "choice", label: "Voltaria?", required: false, options: ["Sim", "Não"] },
    ],
  });
  assert.ok(parsed.success);
  const rows = draftToRows(parsed.data);
  assert.deepEqual(rows.map((r) => [r.position, r.kind, r.dimension]), [
    [1, "scale", "clareza"],
    [2, "choice", null],
  ]);
  assert.deepEqual(rows[0]?.settings, { minLabel: "Ruim" });
  assert.equal(
    templateDraftSchema.safeParse({ name: "x", questions: [{ kind: "choice", label: "a", required: false, options: ["só"] }] })
      .success,
    false,
  );
});
