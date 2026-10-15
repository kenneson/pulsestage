// Sorteio da sessão. Regras puras (sem I/O).
// O ganhador é escolhido no banco (draw_raffle) antes de o telão animar; aqui ficam a validação do
// cadastro, os tempos do suspense (iguais para telão, sala ao vivo e celulares) e a sequência da roleta.

import { z } from "zod";
import { messageKey } from "./message-key.ts";

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

export const RAFFLE_ELIGIBILITIES = ["survey", "everyone"] as const;
export type RaffleEligibility = (typeof RAFFLE_ELIGIBILITIES)[number];
export const raffleEligibilitySchema = z.enum(RAFFLE_ELIGIBILITIES);

export const RAFFLE_ELIGIBILITY_META: Record<RaffleEligibility, { label: string; description: string }> = {
  survey: {
    label: "Quem responder a pesquisa",
    description: "Ao enviar a pesquisa pós-evento, a pessoa recebe um número. Quem não responde não concorre.",
  },
  everyone: {
    label: "Todos que entrarem na sessão",
    description: "Cada pessoa recebe um número ao entrar, mesmo sem responder a pesquisa.",
  },
};

export function isRaffleEligibility(value: unknown): value is RaffleEligibility {
  return raffleEligibilitySchema.safeParse(value).success;
}

export const PRIZE_KINDS = ["physical", "digital"] as const;
export type PrizeKind = (typeof PRIZE_KINDS)[number];
export const prizeKindSchema = z.enum(PRIZE_KINDS);
export const PRIZE_KIND_LABEL: Record<PrizeKind, string> = { physical: "Físico", digital: "Digital" };

export function toPrizeKind(value: string): PrizeKind {
  return value === "digital" ? "digital" : "physical";
}

export const MAX_PRIZE_QUANTITY = 50;
export const MAX_PRIZES = 20;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? null : v))
    .nullish()
    .transform((v) => v ?? null);

export const prizeInputSchema = z.object({
  name: z.string().trim().min(1, "validation.prizeNameRequired").max(120, "validation.nameTooLong"),
  description: optionalText(300, "validation.descriptionTooLong"),
  kind: prizeKindSchema,
  quantity: z
    .number({ error: "validation.invalidQuantity" })
    .int("validation.invalidQuantity")
    .min(1, "validation.atLeastOneWinner")
    .max(MAX_PRIZE_QUANTITY, messageKey("validation.maxWinnersPerPrize", { max: MAX_PRIZE_QUANTITY })),
  winnerMessage: optionalText(500, "validation.messageTooLong"),
});

export type PrizeInput = z.input<typeof prizeInputSchema>;
export type ParsedPrizeInput = z.output<typeof prizeInputSchema>;

/** null = sessão sem sorteio. */
export const raffleSettingsSchema = z.object({ eligibility: raffleEligibilitySchema.nullable() });

// ---------------------------------------------------------------------------
// Tempos do suspense
// ---------------------------------------------------------------------------

/** Roleta girando antes de o telão saber o ganhador. */
export const RAFFLE_SUSPENSE_MS = 5000;
/** A roleta desacelera até parar no número. */
export const RAFFLE_LANDING_MS = 2500;
/** Celulares e sala ao vivo só ficam sabendo depois que o telão revelou. */
export const RAFFLE_REVEAL_MS = RAFFLE_SUSPENSE_MS + RAFFLE_LANDING_MS + 500;

/** O servidor só entrega o ganhador ao telão depois do suspense. */
export function winnerVisibleToDisplay(drawnAt: string, nowMs: number): boolean {
  return nowMs >= Date.parse(drawnAt) + RAFFLE_SUSPENSE_MS;
}

/** …e aos celulares e à sala ao vivo depois da revelação no telão. */
export function winnerRevealed(drawnAt: string, nowMs: number): boolean {
  return nowMs >= Date.parse(drawnAt) + RAFFLE_REVEAL_MS;
}

// ---------------------------------------------------------------------------
// Apresentação
// ---------------------------------------------------------------------------

/** Número do sorteio com zeros à esquerda (042; 0042 quando passa de 999). */
export function formatTicket(number: number, max = 999): string {
  return String(number).padStart(max > 999 || number > 999 ? 4 : 3, "0");
}

export function prizeProgress(quantity: number, winners: number): { drawn: number; remaining: number } {
  return { drawn: winners, remaining: Math.max(0, quantity - winners) };
}

/** Gerador determinístico (para testes e para a roleta não depender de Math.random). */
function seeded(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/**
 * Números que a roleta mostra enquanto desacelera, terminando no do ganhador.
 * Usa os números de quem concorre; sem repetir o mesmo número duas vezes seguidas.
 */
export function reelSequence(pool: readonly number[], final: number, steps: number, seed = 1): number[] {
  const others = [...new Set(pool)].filter((n) => n !== final);
  const random = seeded(seed);
  const out: number[] = [];
  for (let i = 0; i < steps - 1; i++) {
    if (others.length === 0) break;
    let pick = others[Math.floor(random() * others.length)]!;
    if (others.length > 1 && pick === out[out.length - 1]) pick = others[(others.indexOf(pick) + 1) % others.length]!;
    out.push(pick);
  }
  out.push(final);
  return out;
}

/**
 * Instantes (ms) de cada troca de número na desaceleração: rápidos no começo, espaçados no fim.
 * O último é sempre `durationMs`.
 */
export function landingSchedule(count: number, durationMs: number): number[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => Math.round(durationMs * ((i + 1) / count) ** 2.2));
}

// ---------------------------------------------------------------------------
// Respostas das APIs (telão e celular), validadas no navegador
// ---------------------------------------------------------------------------

export const raffleWinnerViewSchema = z.object({
  id: z.string(),
  number: z.number(),
  name: z.string(),
  avatar: z.string().nullable(),
});
export type RaffleWinnerView = z.infer<typeof raffleWinnerViewSchema>;

export const raffleDisplaySchema = z.object({
  eligibility: raffleEligibilitySchema,
  status: z.string(),
  entrants: z.number(),
  /** números de quem ainda concorre, para a roleta */
  numbers: z.array(z.number()),
  prizes: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      kind: prizeKindSchema,
      quantity: z.number(),
      winners: z.array(raffleWinnerViewSchema),
    }),
  ),
  /** sorteio mais recente: o ganhador só vem depois do suspense */
  latest: z
    .object({
      prizeId: z.string(),
      drawnAt: z.string(),
      winner: raffleWinnerViewSchema.nullable(),
    })
    .nullable(),
  serverNow: z.number(),
});
export type RaffleDisplay = z.infer<typeof raffleDisplaySchema>;

export const raffleTicketSchema = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    eligibility: raffleEligibilitySchema,
    prizes: z.array(z.object({ name: z.string(), quantity: z.number() })),
    /** número da pessoa; null enquanto não pode concorrer */
    ticket: z.number().nullable(),
    won: z.object({ prize: z.string(), kind: prizeKindSchema, message: z.string().nullable() }).nullable(),
    /** um sorteio ainda em suspense: buscar de novo depois deste instante (ms) */
    recheckInMs: z.number().nullable(),
  }),
]);
export type RaffleTicket = z.infer<typeof raffleTicketSchema>;

// ---------------------------------------------------------------------------
// Quem concorre
// ---------------------------------------------------------------------------

/** Participantes que podem concorrer agora (antes de tirar quem já foi sorteado). */
export function eligibleParticipants(
  mode: RaffleEligibility,
  participantIds: readonly string[],
  respondentIds: ReadonlySet<string>,
): string[] {
  return mode === "everyone" ? [...participantIds] : participantIds.filter((id) => respondentIds.has(id));
}
