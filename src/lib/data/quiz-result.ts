import "server-only";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import {
  isInteractionType,
  isScoredType,
  normalizeSettings,
  parseGuessAnswerKey,
  parseQuizTextAnswerKey,
  SCORED_TYPES,
} from "@/lib/domain/interactions";
import { parseQuizValue } from "@/lib/domain/metrics";
import { rankQuiz, standingIn, type QuizRanking } from "@/lib/domain/leaderboard";
import { quizReveal, type QuizResult } from "@/lib/domain/quiz-result";
import { pruneOldest } from "@/lib/domain/rate-limit";

// Resultado do quiz para o celular de quem respondeu (cookie assinado já validado na rota).
// Quando o quiz fecha, todos os celulares perguntam quase ao mesmo tempo: o ranking da sessão fica
// alguns segundos em memória por pergunta, para não somar todas as respostas a cada celular.

const RANKING_TTL_MS = 5000;
const rankings = new Map<string, { at: number; ranking: Promise<QuizRanking> }>();

function sessionRanking(admin: AdminSupabase, sessionId: string, interactionId: string, now: number): Promise<QuizRanking> {
  const key = `${sessionId}:${interactionId}`;
  const cached = rankings.get(key);
  if (cached && now - cached.at < RANKING_TTL_MS) return cached.ranking;

  const ranking = (async () => {
    const { data: quizzes, error } = await admin
      .from("interactions")
      .select("id")
      .eq("session_id", sessionId)
      .in("type", [...SCORED_TYPES]);
    if (error) throw new Error(error.message);
    const responses = await fetchAllRows<{ participant_id: string; interaction_id: string; value: unknown }>((from, to) =>
      admin
        .from("responses")
        .select("participant_id, interaction_id, value")
        .in(
          "interaction_id",
          quizzes.map((q) => q.id),
        )
        .range(from, to),
    );
    return rankQuiz(responses.map((r) => ({ participantId: r.participant_id, interactionId: r.interaction_id, value: r.value })));
  })();
  // Falhou: não guarda o erro (o próximo celular tenta de novo).
  ranking.catch(() => rankings.delete(key));
  rankings.set(key, { at: now, ranking });
  pruneOldest(rankings, 500);
  return ranking;
}

/** Null = não é um quiz desta sessão. `pending` = ainda dá para responder (o resultado contaria a resposta). */
export async function getQuizResult(
  admin: AdminSupabase,
  sessionId: string,
  participantId: string,
  interactionId: string,
  now = Date.now(),
): Promise<QuizResult | null> {
  const { data: interaction, error } = await admin
    .from("interactions")
    .select("id, type, is_active, activated_at, settings, answer_key")
    .eq("id", interactionId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!interaction || !isInteractionType(interaction.type) || !isScoredType(interaction.type)) return null;
  const type = interaction.type;

  const { timerSeconds, unit } = normalizeSettings(type, interaction.settings);
  const reveal = quizReveal({ isActive: interaction.is_active, activatedAt: interaction.activated_at, timerSeconds, now });
  if (!reveal.revealed) return { status: "pending", retryInMs: reveal.retryInMs };

  const [response, correct, ranking] = await Promise.all([
    admin
      .from("responses")
      .select("value")
      .eq("interaction_id", interactionId)
      .eq("participant_id", participantId)
      .maybeSingle(),
    type === "quiz"
      ? admin.from("interaction_options").select("label").eq("interaction_id", interactionId).eq("is_correct", true).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    sessionRanking(admin, sessionId, interactionId, now),
  ]);
  if (response.error) throw new Error(response.error.message);
  if (correct.error) throw new Error(correct.error.message);

  const value = parseQuizValue(response.data?.value);
  return {
    status: "revealed",
    answered: value !== null,
    correct: value?.isCorrect ?? false,
    points: value?.points ?? 0,
    correctLabel: value?.isCorrect ? null : correctLabelOf(type, correct.data?.label ?? null, interaction.answer_key, unit),
    standing: standingIn(ranking, participantId),
  };
}

/** Resposta certa para quem errou: a alternativa (quiz), a primeira resposta aceita ou o número (com a unidade). */
function correctLabelOf(type: string, optionLabel: string | null, answerKey: unknown, unit: string | null): string | null {
  if (type === "quiz") return optionLabel;
  if (type === "quiz_text") return parseQuizTextAnswerKey(answerKey)?.accepted[0] ?? null;
  const guess = parseGuessAnswerKey(answerKey);
  return guess ? `${guess.value}${unit ? ` ${unit}` : ""}` : null;
}
