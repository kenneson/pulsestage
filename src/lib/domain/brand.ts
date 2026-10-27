import { z } from "zod";

// Marca do palestrante (logo e cor principal) no celular da plateia e no telão. Regra pura (sem I/O).
// A cor vira o `--primary` da área da sessão; aqui ficam o contraste (cor do texto sobre a cor) e o
// ajuste para continuar legível no fundo claro e no escuro (WCAG: 4,5:1 para texto).

export const BRAND_BUCKET = "brand";
/** Lado maior do logo depois de reduzido no navegador. */
export const BRAND_LOGO_SIZE = 400;
/** Limite do bucket (o mesmo da migration). */
export const BRAND_LOGO_MAX_BYTES = 512 * 1024;
export const BRAND_LOGO_TYPES = ["image/webp", "image/png"] as const;

/** Fundos do app (os mesmos do `themeColor` do layout raiz): claro e azul-marinho. */
export const SURFACE_LIGHT = "#f8f9fc";
export const SURFACE_DARK = "#0d1324";
const INK_DARK = "#0d1324";
const INK_LIGHT = "#ffffff";

/** Texto: 4,5:1. Abaixo de 3:1, nem botão nem borda se distinguem do fundo. */
export const TEXT_CONTRAST = 4.5;
export const UI_CONTRAST = 3;

const HEX = /^#[0-9a-fA-F]{6}$/;

export const brandColorSchema = z
  .string()
  .trim()
  .regex(HEX, "account.errors.brandColorInvalid")
  .transform((v) => v.toLowerCase());

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const LOGO_PATH = new RegExp(`^(${UUID})/logo-${UUID}\\.(webp|png)$`);

/** `{speaker}/logo-{uuid}.webp` (ou .png) no bucket `brand`. */
export const brandLogoPathSchema = z.string().regex(LOGO_PATH, "account.errors.brandLogoInvalid");

export function brandLogoOwner(path: string): string | null {
  return LOGO_PATH.exec(path)?.[1] ?? null;
}

export function brandLogoUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${BRAND_BUCKET}/${path}`;
}

// ---------------------------------------------------------------------------
// Contraste
// ---------------------------------------------------------------------------

type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const v = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as Rgb;
}

function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Razão de contraste WCAG entre duas cores (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Cor do texto sobre a cor da marca: branco, se der 4,5:1; senão a que tiver mais contraste. */
export function brandForeground(hex: string): string {
  const white = contrastRatio(hex, INK_LIGHT);
  if (white >= TEXT_CONTRAST) return INK_LIGHT;
  return white >= contrastRatio(hex, INK_DARK) ? INK_LIGHT : INK_DARK;
}

function mix(hex: string, target: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return rgbToHex(a.map((c, i) => c + (b[i]! - c) * amount) as Rgb);
}

/**
 * A mesma cor, escurecida (fundo claro) ou clareada (fundo escuro) só o necessário para chegar a 4,5:1
 * contra o fundo. Já legível, volta igual.
 */
export function adjustForSurface(hex: string, surface: string, min = TEXT_CONTRAST): string {
  const color = hex.toLowerCase();
  if (contrastRatio(color, surface) >= min) return color;
  const toward = relativeLuminance(surface) > 0.5 ? "#000000" : "#ffffff";
  for (let step = 1; step <= 20; step++) {
    const candidate = mix(color, toward, step / 20);
    if (contrastRatio(candidate, surface) >= min) return candidate;
  }
  return toward;
}

export type BrandTone = { primary: string; foreground: string };
export type BrandPalette = { light: BrandTone; dark: BrandTone };

/** Cores aplicadas em cada tema: `--primary`, `--primary-foreground` (e `--ring`, igual ao primary). */
export function brandPalette(hex: string): BrandPalette {
  const light = adjustForSurface(hex, SURFACE_LIGHT);
  const dark = adjustForSurface(hex, SURFACE_DARK);
  return {
    light: { primary: light, foreground: brandForeground(light) },
    dark: { primary: dark, foreground: brandForeground(dark) },
  };
}

export type BrandCheck = {
  /** contraste da cor escolhida contra o fundo claro e contra o escuro */
  onLight: number;
  onDark: number;
  /** a cor escolhida passa como texto (4,5:1) em cada fundo; se não, o app usa a versão ajustada */
  readableOnLight: boolean;
  readableOnDark: boolean;
  /** cor do texto dos botões e o contraste dela sobre a cor escolhida */
  foreground: string;
  foregroundContrast: number;
};

/** Diagnóstico da cor para a tela da Conta. */
export function checkBrandColor(hex: string): BrandCheck {
  const color = hex.toLowerCase();
  const foreground = brandForeground(color);
  const onLight = contrastRatio(color, SURFACE_LIGHT);
  const onDark = contrastRatio(color, SURFACE_DARK);
  return {
    onLight,
    onDark,
    readableOnLight: onLight >= TEXT_CONTRAST,
    readableOnDark: onDark >= TEXT_CONTRAST,
    foreground,
    foregroundContrast: contrastRatio(color, foreground),
  };
}

/** Marca efetiva da sessão: só com a opção ligada e com logo ou cor no perfil. */
export function sessionBrand(
  useBrand: boolean,
  profile: { brand_logo_path: string | null; brand_color: string | null } | null,
): { logoPath: string | null; color: string | null } | null {
  if (!useBrand || !profile) return null;
  const color = profile.brand_color && HEX.test(profile.brand_color) ? profile.brand_color.toLowerCase() : null;
  const logoPath = profile.brand_logo_path && LOGO_PATH.test(profile.brand_logo_path) ? profile.brand_logo_path : null;
  return color || logoPath ? { logoPath, color } : null;
}
