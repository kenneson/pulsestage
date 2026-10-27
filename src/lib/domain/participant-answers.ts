// Celular da plateia: regras puras da tela de resposta (sem I/O). O servidor confere tudo de novo
// (`lib/domain/answers.ts` e `scoring.ts`); aqui só o que a tela precisa para guiar quem responde.

import {
  acceptsResponses,
  isScoredType,
  POINTS_BUDGET,
  type InteractionType,
  type NormalizedSettings,
} from "./interactions.ts";

// ---------------------------------------------------------------------------
// 100 pontos
// ---------------------------------------------------------------------------

export type Allocations = Record<string, number>;

export function allocatedTotal(allocations: Allocations): number {
  return Object.values(allocations).reduce((sum, points) => sum + points, 0);
}

/** Saldo que ainda falta distribuir (nunca negativo). */
export function pointsLeft(allocations: Allocations): number {
  return Math.max(0, POINTS_BUDGET - allocatedTotal(allocations));
}

/** Novo valor de uma alternativa, inteiro e limitado a [0, o que ela já tem + o saldo]. */
export function setAllocation(allocations: Allocations, id: string, value: number): Allocations {
  const current = allocations[id] ?? 0;
  const ceiling = current + pointsLeft(allocations);
  const next = Math.min(ceiling, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
  return { ...allocations, [id]: next };
}

/** O que vai para o servidor: sem zeros, só quando a soma fecha em 100. */
export function pointsPayload(allocations: Allocations): Allocations | null {
  if (allocatedTotal(allocations) !== POINTS_BUDGET) return null;
  return Object.fromEntries(Object.entries(allocations).filter(([, points]) => points > 0));
}

// ---------------------------------------------------------------------------
// Toque numa área (matriz 2×2 e marcar na imagem)
// ---------------------------------------------------------------------------

type Box = { left: number; top: number; width: number; height: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Posição do toque dentro da área, de 0 a 1 a partir do canto superior esquerdo (4 casas). */
export function fractionInBox(clientX: number, clientY: number, box: Box): { x: number; y: number } {
  const x = box.width > 0 ? clamp01((clientX - box.left) / box.width) : 0.5;
  const y = box.height > 0 ? clamp01((clientY - box.top) / box.height) : 0.5;
  const round = (v: number) => Math.round(v * 10000) / 10000;
  return { x: round(x), y: round(y) };
}

/**
 * Matriz 2×2: posição de 0 a 100 nos dois eixos. `x` cresce para a direita (xLow → xHigh) e `y` cresce
 * para cima (yLow embaixo, yHigh em cima), como num gráfico.
 */
export function matrixPosition(clientX: number, clientY: number, box: Box): { x: number; y: number } {
  const { x, y } = fractionInBox(clientX, clientY, box);
  return { x: Math.round(x * 100), y: Math.round((1 - y) * 100) };
}

/** Ajuste fino pelo teclado (setas): passo de 5, limitado a 0–100. */
export function nudgeMatrix(position: { x: number; y: number }, dx: number, dy: number): { x: number; y: number } {
  const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)));
  return { x: clamp(position.x + dx), y: clamp(position.y + dy) };
}

// ---------------------------------------------------------------------------
// Adivinhe o número
// ---------------------------------------------------------------------------

type GuessRange = Pick<NormalizedSettings, "numMin" | "numMax" | "decimals">;

export function guessStep(decimals: number): number {
  return 1 / 10 ** decimals;
}

/** Arredonda nas casas decimais da pergunta e mantém dentro da faixa. */
export function clampGuess(value: number, range: GuessRange): number {
  const factor = 10 ** range.decimals;
  const rounded = Math.round(value * factor) / factor;
  return Math.min(range.numMax, Math.max(range.numMin, rounded));
}

/** Texto digitado → número (aceita vírgula decimal). Vazio ou inválido: null. */
export function parseGuessInput(text: string): number | null {
  const cleaned = text.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Ponto de partida do controle deslizante: o meio da faixa. */
export function guessMidpoint(range: GuessRange): number {
  return clampGuess((range.numMin + range.numMax) / 2, range);
}

// ---------------------------------------------------------------------------
// Cronômetro
// ---------------------------------------------------------------------------

/** Segundos que faltam (arredondados para cima). Sem abertura conhecida, conta a partir de agora. */
export function secondsLeft(activatedAt: string | null, seconds: number, now: number, startedAt = now): number {
  const start = activatedAt ? Date.parse(activatedAt) : startedAt;
  return Math.max(0, Math.ceil((start + seconds * 1000 - now) / 1000));
}

// ---------------------------------------------------------------------------
// Resultado no celular
// ---------------------------------------------------------------------------

/**
 * Depois de responder, o celular mostra o gráfico ao vivo? Só com "mostrar no celular", nunca em tipos que
 * pontuam (contaria a resposta certa) e, com "esconder resultados", só depois de revelados no telão.
 */
export function showsResultsOnPhone(
  interaction: { type: InteractionType; settings: Pick<NormalizedSettings, "showResultsOnPhone" | "hideResults"> },
  resultsRevealed: boolean,
): boolean {
  if (!acceptsResponses(interaction.type) || isScoredType(interaction.type)) return false;
  if (!interaction.settings.showResultsOnPhone) return false;
  return !interaction.settings.hideResults || resultsRevealed;
}

export type ScoredTone = "correct" | "close" | "wrong" | "missed";

/** Tom do resultado: no "Adivinhe o número", errar com pontos é "chegou perto". */
export function scoredResultTone(
  type: InteractionType,
  result: { answered: boolean; correct: boolean; points: number },
): ScoredTone {
  if (!result.answered) return "missed";
  if (result.correct) return "correct";
  return type === "guess_number" && result.points > 0 ? "close" : "wrong";
}

// ---------------------------------------------------------------------------
// Equipes
// ---------------------------------------------------------------------------

/** Equipe como o celular vê: nome e cor, nunca quem está nela. */
export type PublicTeam = { id: string; name: string; color: number };

export type TeamSize = { id: string; position: number; members: number };

/** Equipe de quem entrou sem escolher: a com menos gente (empate: a primeira da lista). */
export function smallestTeam(teams: readonly TeamSize[]): string | null {
  let best: TeamSize | null = null;
  for (const team of teams) {
    if (
      !best ||
      team.members < best.members ||
      (team.members === best.members && (team.position < best.position || (team.position === best.position && team.id < best.id)))
    ) {
      best = team;
    }
  }
  return best?.id ?? null;
}

/** Cor da equipe (1–8, a mesma escala de --shape-N); fora disso, a primeira. */
export function teamColor(color: number): number {
  return Number.isInteger(color) && color >= 1 && color <= 8 ? color : 1;
}
