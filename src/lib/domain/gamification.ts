// Gamificação inspirada no Kahoot. Regras puras (sem I/O).
// - avatares do participante (lista fixa: nada de upload nem dado pessoal novo);
// - formas e cores nas alternativas (a forma nunca depende só da cor);
// - bônus de velocidade no quiz, calculado no servidor (seção 0.3);
// - caminho das imagens das alternativas.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Avatares
// ---------------------------------------------------------------------------

export const AVATARS = [
  { key: "raposa", emoji: "🦊", label: "Raposa" },
  { key: "panda", emoji: "🐼", label: "Panda" },
  { key: "leao", emoji: "🦁", label: "Leão" },
  { key: "sapo", emoji: "🐸", label: "Sapo" },
  { key: "polvo", emoji: "🐙", label: "Polvo" },
  { key: "coruja", emoji: "🦉", label: "Coruja" },
  { key: "tartaruga", emoji: "🐢", label: "Tartaruga" },
  { key: "unicornio", emoji: "🦄", label: "Unicórnio" },
  { key: "pinguim", emoji: "🐧", label: "Pinguim" },
  { key: "coala", emoji: "🐨", label: "Coala" },
  { key: "tigre", emoji: "🐯", label: "Tigre" },
  { key: "abelha", emoji: "🐝", label: "Abelha" },
  { key: "dinossauro", emoji: "🦖", label: "Dinossauro" },
  { key: "golfinho", emoji: "🐬", label: "Golfinho" },
  { key: "gato", emoji: "🐱", label: "Gato" },
  { key: "cachorro", emoji: "🐶", label: "Cachorro" },
  { key: "foguete", emoji: "🚀", label: "Foguete" },
  { key: "cacto", emoji: "🌵", label: "Cacto" },
] as const;

export type Avatar = (typeof AVATARS)[number];
export type AvatarKey = Avatar["key"];

const AVATAR_KEYS = AVATARS.map((a) => a.key) as [AvatarKey, ...AvatarKey[]];
export const avatarKeySchema = z.enum(AVATAR_KEYS, { error: "Avatar inválido." });

/** Avatar de uma chave guardada no banco; chaves antigas ou desconhecidas viram null. */
export function avatarOf(key: string | null | undefined): Avatar | null {
  return AVATARS.find((a) => a.key === key) ?? null;
}

// ---------------------------------------------------------------------------
// Formas e cores das alternativas
// ---------------------------------------------------------------------------

export const OPTION_STYLES = ["text", "shapes"] as const;
export type OptionStyle = (typeof OPTION_STYLES)[number];
export const optionStyleSchema = z.enum(OPTION_STYLES);

/** Na ordem das alternativas (A = triângulo, B = losango…). Cor em `--shape-N` (globals.css). */
export const OPTION_SHAPES = [
  { key: "triangle", label: "Triângulo" },
  { key: "diamond", label: "Losango" },
  { key: "circle", label: "Círculo" },
  { key: "square", label: "Quadrado" },
  { key: "star", label: "Estrela" },
  { key: "hexagon", label: "Hexágono" },
  { key: "pentagon", label: "Pentágono" },
  { key: "heart", label: "Coração" },
] as const;

export type OptionShape = (typeof OPTION_SHAPES)[number] & { color: number };

/** Forma e cor (1 a 8) da alternativa na posição `index`. */
export function optionShape(index: number): OptionShape {
  const i = ((index % OPTION_SHAPES.length) + OPTION_SHAPES.length) % OPTION_SHAPES.length;
  return { ...OPTION_SHAPES[i]!, color: i + 1 };
}

// ---------------------------------------------------------------------------
// Bônus de velocidade do quiz
// ---------------------------------------------------------------------------

/**
 * Pontos de uma resposta certa. Com bônus de velocidade (só com tempo limite), como no Kahoot:
 * responder na hora vale os pontos cheios e cai até a metade no fim do tempo.
 */
export function quizPoints(base: number, responseTimeMs: number, timerSeconds: number | null, speedBonus: boolean): number {
  if (!speedBonus || !timerSeconds || base <= 0) return base;
  const elapsed = Math.min(1, Math.max(0, responseTimeMs / (timerSeconds * 1000)));
  return Math.round(base * (1 - elapsed / 2));
}

// ---------------------------------------------------------------------------
// Imagens das alternativas
// ---------------------------------------------------------------------------

export const OPTION_IMAGES_BUCKET = "option-images";
/** Lado maior da imagem depois de redimensionada no navegador. */
export const OPTION_IMAGE_SIZE = 800;
export const OPTION_IMAGE_MAX_BYTES = 1024 * 1024;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const IMAGE_PATH = new RegExp(`^(${UUID})/${UUID}\\.(webp|jpg)$`);

/** `{speaker}/{uuid}.webp` (ou .jpg, quando o navegador não codifica WebP). */
export const optionImagePathSchema = z.string().regex(IMAGE_PATH, "Imagem inválida.");

/** Dono da pasta da imagem; null se o caminho não segue o formato. */
export function imageOwner(path: string): string | null {
  return IMAGE_PATH.exec(path)?.[1] ?? null;
}

/** URL pública (bucket público; o nome com uuid não é adivinhável). */
export function optionImageUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${OPTION_IMAGES_BUCKET}/${path}`;
}

/** Imagens que deixaram de ser usadas depois de uma edição (para apagar do Storage). */
export function droppedImages(before: readonly (string | null)[], after: readonly (string | null)[]): string[] {
  const kept = new Set(after.filter((p): p is string => p !== null));
  return [...new Set(before.filter((p): p is string => p !== null && !kept.has(p)))];
}
