// O que está no telão, a partir do estado ao vivo. Regra pura usada pelo projetor e pela sala ao vivo.
// Prioridade (a mesma das funções do banco show_raffle, show_leaderboard, show_questions e show_slide):
// sorteio (vale também pausada ou encerrada) > tela final > pausa > ranking do quiz > perguntas da
// plateia > pergunta no ar > slide > QR Code de entrada.

import type { SessionStatus } from "./session.ts";

/** Campos de session_live_state que decidem o telão. */
export type ScreenLiveState = {
  active_interaction_id: string | null;
  current_slide: number | null;
  show_leaderboard: boolean;
  show_raffle: boolean;
  show_questions: boolean;
  question_id: string | null;
};

export type ScreenContent =
  | { kind: "raffle" }
  | { kind: "ended" }
  | { kind: "paused" }
  | { kind: "leaderboard" }
  /** questionId: pergunta em destaque; null = lista das mais curtidas */
  | { kind: "questions"; questionId: string | null }
  | { kind: "interaction"; id: string }
  | { kind: "slide"; index: number }
  | { kind: "join" };

export type ScreenOptions = {
  /** slides do deck atual (um slide fora do deck não aparece) */
  slideCount?: number;
  /** a tela conhece a pergunta ativa? (criada agora, ainda sem dados, cai para o slide ou o QR) */
  knowsInteraction?: (id: string) => boolean;
};

export function screenContent(
  live: ScreenLiveState | null | undefined,
  status: SessionStatus,
  { slideCount = 0, knowsInteraction = () => true }: ScreenOptions = {},
): ScreenContent {
  if (live?.show_raffle && status !== "draft") return { kind: "raffle" };
  if (status === "completed") return { kind: "ended" };
  if (status === "paused") return { kind: "paused" };
  if (status !== "live" || !live) return { kind: "join" };
  if (live.show_leaderboard) return { kind: "leaderboard" };
  if (live.show_questions) return { kind: "questions", questionId: live.question_id };
  const activeId = live.active_interaction_id;
  if (activeId && knowsInteraction(activeId)) return { kind: "interaction", id: activeId };
  const slide = live.current_slide;
  if (slide !== null && slide >= 0 && slide < slideCount) return { kind: "slide", index: slide };
  return { kind: "join" };
}

/** Modos do seletor "No telão agora". "lineup" = o item do roteiro (pergunta ou slide). */
export type ScreenMode = "lineup" | "join" | "leaderboard" | "questions" | "raffle" | "paused" | "ended";

export function screenModeOf(content: ScreenContent): ScreenMode {
  switch (content.kind) {
    case "interaction":
    case "slide":
      return "lineup";
    default:
      return content.kind;
  }
}

/** Telas extras que fazem sentido nesta sessão. */
export type ScreenFeatures = {
  /** há quiz no roteiro (ranking) */
  quiz: boolean;
  /** perguntas da plateia ligadas */
  questions: boolean;
  /** sessão com sorteio */
  raffle: boolean;
};

/**
 * Modos que o palestrante pode escolher agora, na ordem do seletor. Rascunho: só o QR (desabilitado
 * na tela). O modo atual sempre entra, mesmo que a opção tenha sido desligada depois.
 */
export function screenModes(status: SessionStatus, features: ScreenFeatures, current?: ScreenMode): ScreenMode[] {
  const modes: ScreenMode[] = [];
  if (status === "live") {
    modes.push("lineup", "join");
    if (features.quiz) modes.push("leaderboard");
    if (features.questions) modes.push("questions");
  } else if (status === "paused") {
    modes.push("paused");
  } else if (status === "completed") {
    modes.push("ended");
  } else {
    modes.push("join");
  }
  if (features.raffle && status !== "draft") modes.push("raffle");
  if (current && !modes.includes(current)) modes.push(current);
  return modes;
}

/** Telas por cima do roteiro, que se desligam para voltar a ele. */
export function isScreenOverlay(mode: ScreenMode): mode is "leaderboard" | "questions" | "raffle" {
  return mode === "leaderboard" || mode === "questions" || mode === "raffle";
}
