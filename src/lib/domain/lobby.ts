// Sala de espera no telão: quem entra aparece com nome e avatar enquanto o QR Code está na tela.
// Regras puras (sem I/O). O servidor lê os participantes e decide aqui o que pode ir para o telão.

import { z } from "zod";
import { avatarOf } from "./gamification.ts";
import { isFilteredText } from "./scoring.ts";
import type { Locale } from "./locale.ts";

/** Quantas pessoas aparecem no telão (as mais recentes); o resto vira "+N". */
export const LOBBY_LIMIT = 48;
/**
 * Releitura do telão. Ao vivo, o contador do realtime já avisa quem entra; em rascunho (antes de iniciar)
 * o telão não lê o estado ao vivo, e esta releitura é o que faz a sala de espera andar.
 */
export const LOBBY_POLL_MS = 3000;

export type LobbyEntry = {
  /** chave estável para a animação (não é o id do participante) */
  key: string;
  /** nome escolhido; null = anônimo ou barrado pelo filtro de palavrões */
  name: string | null;
  avatar: string | null;
};

export const lobbySchema = z.object({
  total: z.number(),
  entries: z.array(z.object({ key: z.string(), name: z.string().nullable(), avatar: z.string().nullable() })),
});
export type Lobby = z.infer<typeof lobbySchema>;

/**
 * Nome que pode aparecer para a sala (telão, ranking). Com o filtro de palavrões ligado, um nome barrado
 * some (a pessoa continua participando, sem nome). Sem nome, null.
 */
export function publicName(name: string | null | undefined, rules: { profanityFilter: boolean; locale: Locale }): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  return isFilteredText(trimmed, rules) ? null : trimmed;
}

/** Linhas de participantes (mais recentes primeiro) para o telão. */
export function toLobby(
  rows: readonly { id: string; display_name: string | null; avatar: string | null }[],
  total: number,
  rules: { profanityFilter: boolean; locale: Locale },
): Lobby {
  return {
    total,
    entries: rows.slice(0, LOBBY_LIMIT).map((row) => ({
      key: row.id.slice(0, 8),
      name: publicName(row.display_name, rules),
      avatar: avatarOf(row.avatar)?.emoji ?? null,
    })),
  };
}
