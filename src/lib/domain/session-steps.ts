// Montagem da sessão em passos (linha do tempo): ordem fixa, etapa da URL, anterior/próxima e estado de cada uma.
// Regra pura (sem I/O).

export const SESSION_STEPS = ["configuracoes", "slides", "enquetes", "pesquisa", "sorteio"] as const;
export type SessionStep = (typeof SESSION_STEPS)[number];

/** Resumo "Pronto para apresentar", depois do último passo (não aparece na linha do tempo). */
export const READY_VIEW = "pronto";
export type SessionStepView = SessionStep | typeof READY_VIEW;

/** Passos que dá para pular (têm "Pular" e ficam "opcional" enquanto vazios). */
export const OPTIONAL_STEPS: readonly SessionStep[] = ["slides", "sorteio"];

export function isOptionalStep(step: SessionStep): boolean {
  return OPTIONAL_STEPS.includes(step);
}

export function isSessionStep(value: unknown): value is SessionStep {
  return typeof value === "string" && (SESSION_STEPS as readonly string[]).includes(value);
}

// Endereços antigos das abas (?aba=...) continuam abrindo o passo certo.
const TAB_ALIASES: Record<string, SessionStep> = {
  informacoes: "configuracoes",
  participacao: "configuracoes",
  slides: "slides",
  interacoes: "enquetes",
  sorteio: "sorteio",
};

const first = (raw: string | string[] | undefined) => (Array.isArray(raw) ? raw[0] : raw);

/** Etapa pedida na URL (?etapa=..., ou o ?aba=... antigo); sem parâmetro ou inválido = configurações. */
export function stepFromParams(etapa: string | string[] | undefined, aba?: string | string[] | undefined): SessionStepView {
  const value = first(etapa);
  if (value === READY_VIEW) return READY_VIEW;
  if (isSessionStep(value)) return value;
  const alias = first(aba);
  return (alias && TAB_ALIASES[alias]) || "configuracoes";
}

/** Endereço do passo (configurações é o padrão, sem parâmetro). */
export function stepHref(sessionId: string, step: SessionStepView): string {
  const base = `/dashboard/sessions/${sessionId}`;
  return step === "configuracoes" ? base : `${base}?etapa=${step}`;
}

/** Posição do passo (base 0); o resumo fica depois do último. */
export function stepIndex(step: SessionStepView): number {
  return step === READY_VIEW ? SESSION_STEPS.length : SESSION_STEPS.indexOf(step);
}

/** Passo anterior; null no primeiro. Do resumo, volta ao último passo. */
export function previousStep(step: SessionStepView): SessionStep | null {
  const index = stepIndex(step);
  return index > 0 ? (SESSION_STEPS[index - 1] ?? null) : null;
}

/** Próximo passo; depois do último vem o resumo; do resumo, nada. */
export function nextStep(step: SessionStepView): SessionStepView | null {
  if (step === READY_VIEW) return null;
  return SESSION_STEPS[stepIndex(step) + 1] ?? READY_VIEW;
}

export type StepFacts = {
  /** a sessão já existe (em "Nova sessão", ainda não) */
  created: boolean;
  slideCount: number;
  interactionCount: number;
  surveyTemplateId: string | null;
  /** sessions.raffle_eligibility preenchido */
  raffleEnabled: boolean;
};

export type StepState = "done" | "optional" | "pending";

/** Estado de cada passo: feito, opcional (vazio, mas dá para pular) ou pendente. */
export function stepState(step: SessionStep, facts: StepFacts): StepState {
  if (!facts.created) return isOptionalStep(step) ? "optional" : "pending";
  switch (step) {
    case "configuracoes":
      return "done";
    case "slides":
      return facts.slideCount > 0 ? "done" : "optional";
    case "enquetes":
      return facts.interactionCount > 0 ? "done" : "pending";
    case "pesquisa":
      return facts.surveyTemplateId ? "done" : "pending";
    case "sorteio":
      return facts.raffleEnabled ? "done" : "optional";
  }
}

export function stepStates(facts: StepFacts): Record<SessionStep, StepState> {
  return Object.fromEntries(SESSION_STEPS.map((step) => [step, stepState(step, facts)])) as Record<SessionStep, StepState>;
}

/** Passos obrigatórios que faltam (o resumo avisa antes de apresentar). */
export function missingSteps(facts: StepFacts): SessionStep[] {
  return SESSION_STEPS.filter((step) => stepState(step, facts) === "pending");
}
