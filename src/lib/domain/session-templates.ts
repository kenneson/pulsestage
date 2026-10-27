import {
  buildInteractionInput,
  defaultSettings,
  optionsFromLabels,
  type InteractionInput,
  type InteractionType,
  type NormalizedSettings,
} from "./interactions.ts";

// Modelos de sessão: roteiros prontos para escolas, universidades e empresas. Regra pura (sem I/O).
// A estrutura (tipos, alternativas, acerto, eixos) fica aqui; os textos ficam em messages/<idioma>/templates.json,
// em `items.<modelo>`, e chegam pela função `text` (as perguntas saem no idioma do palestrante).

export const TEMPLATE_AUDIENCES = ["school", "university", "company"] as const;
export type TemplateAudience = (typeof TEMPLATE_AUDIENCES)[number];

type Base = {
  /** chave em `items.<modelo>.questions.<key>` */
  key: string;
  /** cronômetro em segundos (null = sem tempo; ausente = padrão do tipo) */
  timerSeconds?: number | null;
  showResultsOnPhone?: boolean;
};

/** Textos de alternativas: chaves em `questions.<key>.options.<opção>`. */
type WithOptions = { options: readonly string[] };

export type TemplateQuestion = Base &
  (
    | ({ type: "multiple_choice"; maxChoices?: number; isSegment?: boolean; shapes?: boolean } & WithOptions)
    | ({ type: "quiz"; correct: number } & WithOptions)
    | ({ type: "ranking" } & WithOptions)
    | ({ type: "points_100" } & WithOptions)
    /** eixos em `questions.<key>.xLabel/xLow/xHigh/yLabel/yLow/yHigh` */
    | ({ type: "matrix_2x2" } & WithOptions)
    /** rótulos das pontas em `questions.<key>.minLabel/maxLabel` */
    | { type: "rating"; min: number; max: number }
    | { type: "word_cloud" }
    | { type: "open_text" }
    | { type: "guess_number"; numMin: number; numMax: number; value: number }
    /** respostas aceitas em `questions.<key>.accepted.<n>` (n = 1..accepted) */
    | { type: "quiz_text"; accepted: number }
    /** texto em `questions.<key>.body` */
    | { type: "content" }
  );

export type SessionTemplate = {
  /** chave em `items.<id>` (nome, resumo, descrição da sessão e perguntas) */
  id: string;
  audiences: readonly TemplateAudience[];
  durationMinutes: number;
  /** "self": cada pessoa responde o roteiro inteiro no próprio ritmo */
  pace: "live" | "self";
  /** liga as equipes (com as 4 padrão) ao criar */
  teams: boolean;
  questions: readonly TemplateQuestion[];
};

const PLANNING_ITEMS = ["a", "b", "c", "d"] as const;

export const SESSION_TEMPLATES = [
  {
    id: "classOpener",
    audiences: ["school", "university"],
    durationMinutes: 50,
    pace: "live",
    teams: false,
    questions: [
      { key: "welcome", type: "content" },
      { key: "mood", type: "word_cloud" },
      { key: "prior", type: "multiple_choice", options: ["none", "little", "basics", "lots"], showResultsOnPhone: true },
      { key: "warmup", type: "guess_number", numMin: 0, numMax: 300, value: 193, timerSeconds: 30 },
      { key: "expect", type: "open_text" },
    ],
  },
  {
    id: "quizReview",
    audiences: ["school", "university"],
    durationMinutes: 40,
    pace: "live",
    teams: true,
    questions: [
      { key: "rules", type: "content" },
      { key: "prime", type: "quiz", options: ["a", "b", "c", "d"], correct: 2 },
      { key: "planet", type: "quiz", options: ["a", "b", "c", "d"], correct: 1 },
      { key: "water", type: "quiz_text", accepted: 2 },
      { key: "moon", type: "guess_number", numMin: 1900, numMax: 2000, value: 1969, timerSeconds: 30 },
      { key: "ready", type: "rating", min: 1, max: 5 },
    ],
  },
  {
    id: "projectRetro",
    audiences: ["company", "university"],
    durationMinutes: 60,
    pace: "live",
    teams: false,
    questions: [
      { key: "cycle", type: "rating", min: 1, max: 5 },
      { key: "word", type: "word_cloud" },
      { key: "keep", type: "open_text" },
      { key: "improve", type: "open_text" },
      { key: "focus", type: "points_100", options: ["process", "communication", "tools", "quality", "skills"] },
    ],
  },
  {
    id: "corporateTraining",
    audiences: ["company"],
    durationMinutes: 90,
    pace: "live",
    teams: false,
    questions: [
      { key: "area", type: "multiple_choice", options: ["sales", "operations", "tech", "people", "other"], isSegment: true },
      { key: "before", type: "rating", min: 1, max: 5 },
      { key: "phishing", type: "quiz", options: ["click", "reply", "report", "forward"], correct: 2 },
      { key: "topics", type: "ranking", options: ["cases", "tools", "policies", "metrics"] },
      { key: "doubts", type: "open_text" },
    ],
  },
  {
    id: "planning",
    audiences: ["company", "university"],
    durationMinutes: 60,
    pace: "live",
    teams: false,
    questions: [
      { key: "intro", type: "content" },
      { key: "matrix", type: "matrix_2x2", options: PLANNING_ITEMS },
      { key: "points", type: "points_100", options: PLANNING_ITEMS },
      { key: "start", type: "multiple_choice", options: PLANNING_ITEMS, maxChoices: 2 },
      { key: "risk", type: "open_text" },
    ],
  },
  {
    id: "selfPacedSurvey",
    audiences: ["school", "university", "company"],
    durationMinutes: 15,
    pace: "self",
    teams: false,
    questions: [
      { key: "intro", type: "content" },
      { key: "role", type: "multiple_choice", options: ["student", "teacher", "staff", "other"], isSegment: true },
      { key: "satisfaction", type: "rating", min: 1, max: 5 },
      { key: "values", type: "multiple_choice", options: ["content", "people", "structure", "flexibility", "communication"], maxChoices: 3 },
      { key: "recommend", type: "rating", min: 0, max: 10 },
      { key: "change", type: "open_text" },
    ],
  },
] as const satisfies readonly SessionTemplate[];

export type SessionTemplateId = (typeof SESSION_TEMPLATES)[number]["id"];
export const SESSION_TEMPLATE_IDS = SESSION_TEMPLATES.map((t) => t.id) as SessionTemplateId[];

export function findSessionTemplate(id: string): SessionTemplate | null {
  return (SESSION_TEMPLATES as readonly SessionTemplate[]).find((t) => t.id === id) ?? null;
}

/** Texto de uma chave relativa à área "templates" (ex.: "items.planning.name"). */
export type TemplateText = (key: string) => string;

/** Chave de um texto da pergunta. */
export function questionKey(templateId: string, questionKey: string, field: string): string {
  return `items.${templateId}.questions.${questionKey}.${field}`;
}

/** Todas as chaves de texto que o modelo usa (o teste confere que existem nos três idiomas). */
export function templateTextKeys(template: SessionTemplate): string[] {
  const keys = [`items.${template.id}.name`, `items.${template.id}.summary`, `items.${template.id}.sessionDescription`];
  for (const q of template.questions) {
    const k = (field: string) => questionKey(template.id, q.key, field);
    keys.push(k("title"));
    if ("options" in q) keys.push(...q.options.map((o) => k(`options.${o}`)));
    if (q.type === "rating") keys.push(k("minLabel"), k("maxLabel"));
    if (q.type === "matrix_2x2") keys.push(...["xLabel", "xLow", "xHigh", "yLabel", "yLow", "yHigh"].map(k));
    if (q.type === "quiz_text") for (let n = 1; n <= q.accepted; n++) keys.push(k(`accepted.${n}`));
    if (q.type === "content") keys.push(k("body"));
  }
  return keys;
}

function settingsFor(q: TemplateQuestion, text: (field: string) => string): NormalizedSettings {
  const s: NormalizedSettings = { ...defaultSettings(q.type) };
  if (q.timerSeconds !== undefined) s.timerSeconds = q.timerSeconds;
  if (q.showResultsOnPhone) s.showResultsOnPhone = true;
  switch (q.type) {
    case "multiple_choice":
      s.maxChoices = q.maxChoices ?? 1;
      s.isSegment = q.isSegment ?? false;
      if (q.shapes) s.optionStyle = "shapes";
      break;
    case "rating":
      s.min = q.min;
      s.max = q.max;
      s.minLabel = text("minLabel");
      s.maxLabel = text("maxLabel");
      break;
    case "matrix_2x2":
      s.xLabel = text("xLabel");
      s.xLow = text("xLow");
      s.xHigh = text("xHigh");
      s.yLabel = text("yLabel");
      s.yLow = text("yLow");
      s.yHigh = text("yHigh");
      break;
    case "guess_number":
      s.numMin = q.numMin;
      s.numMax = q.numMax;
      break;
    case "content":
      s.body = text("body");
      break;
    default:
      break;
  }
  return s;
}

/** Perguntas do modelo prontas para `interactionInputSchema`, com os textos de `text`. */
export function templateInteractions(template: SessionTemplate, text: TemplateText): InteractionInput[] {
  return template.questions.map((q) => {
    const field = (name: string) => text(questionKey(template.id, q.key, name));
    const labels = "options" in q ? q.options.map((o) => field(`options.${o}`)) : [];
    return buildInteractionInput({
      type: q.type,
      title: field("title"),
      settings: settingsFor(q, field),
      options: optionsFromLabels(q.type, labels, q.type === "quiz" ? q.correct : null),
      answerKey:
        q.type === "guess_number"
          ? { value: q.value }
          : q.type === "quiz_text"
            ? { accepted: Array.from({ length: q.accepted }, (_, i) => field(`accepted.${i + 1}`)) }
            : null,
    });
  });
}

/** Prévia do card: tipo e título de cada pergunta. */
export function templatePreview(template: SessionTemplate, text: TemplateText): { type: InteractionType; title: string }[] {
  return template.questions.map((q) => ({ type: q.type, title: text(questionKey(template.id, q.key, "title")) }));
}
