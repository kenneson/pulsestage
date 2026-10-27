import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adjustForSurface,
  brandColorSchema,
  brandForeground,
  brandLogoOwner,
  brandLogoPathSchema,
  brandPalette,
  checkBrandColor,
  contrastRatio,
  sessionBrand,
  SURFACE_DARK,
  SURFACE_LIGHT,
  TEXT_CONTRAST,
} from "../src/lib/domain/brand.ts";

const SPEAKER = "11111111-1111-4111-8111-111111111111";
const FILE = "22222222-2222-4222-8222-222222222222";

test("contraste WCAG: preto × branco = 21, cor igual = 1", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
  assert.equal(contrastRatio("#245fd4", "#245fd4"), 1);
});

test("texto sobre a cor: branco nas cores escuras, escuro nas claras", () => {
  assert.equal(brandForeground("#245fd4"), "#ffffff");
  assert.equal(brandForeground("#ffd400"), "#0d1324");
  assert.equal(brandForeground("#00ff88"), "#0d1324");
});

test("diagnóstico: amarelo some no fundo claro, azul-marinho some no escuro", () => {
  const yellow = checkBrandColor("#FFD400");
  assert.equal(yellow.readableOnLight, false);
  assert.equal(yellow.readableOnDark, true);
  assert.ok(yellow.foregroundContrast >= TEXT_CONTRAST);
  const navy = checkBrandColor("#1a2a5e");
  assert.equal(navy.readableOnLight, true);
  assert.equal(navy.readableOnDark, false);
});

test("ajuste: só o necessário para 4,5:1 em cada fundo; cor legível fica igual", () => {
  assert.equal(adjustForSurface("#1d5fbf", SURFACE_LIGHT), "#1d5fbf");
  const light = adjustForSurface("#ffd400", SURFACE_LIGHT);
  assert.ok(contrastRatio(light, SURFACE_LIGHT) >= TEXT_CONTRAST);
  const dark = adjustForSurface("#1a2a5e", SURFACE_DARK);
  assert.ok(contrastRatio(dark, SURFACE_DARK) >= TEXT_CONTRAST);
  const palette = brandPalette("#ff6a00");
  for (const tone of [palette.light, palette.dark]) {
    assert.ok(contrastRatio(tone.primary, tone.foreground) >= TEXT_CONTRAST, JSON.stringify(tone));
  }
});

test("entrada: cor em hex de 6 dígitos (minúscula); logo só na pasta do speaker", () => {
  assert.equal(brandColorSchema.parse(" #AABBCC "), "#aabbcc");
  assert.equal(brandColorSchema.safeParse("#abc").success, false);
  assert.equal(brandColorSchema.safeParse("red").success, false);
  const path = `${SPEAKER}/logo-${FILE}.webp`;
  assert.equal(brandLogoPathSchema.safeParse(path).success, true);
  assert.equal(brandLogoOwner(path), SPEAKER);
  assert.equal(brandLogoPathSchema.safeParse(`${SPEAKER}/../x/logo-${FILE}.webp`).success, false);
  assert.equal(brandLogoPathSchema.safeParse(`${SPEAKER}/logo-${FILE}.svg`).success, false);
});

test("marca da sessão: só com a opção ligada e com logo ou cor", () => {
  const profile = { brand_logo_path: `${SPEAKER}/logo-${FILE}.png`, brand_color: "#FF0000" };
  assert.deepEqual(sessionBrand(true, profile), { logoPath: profile.brand_logo_path, color: "#ff0000" });
  assert.equal(sessionBrand(false, profile), null);
  assert.equal(sessionBrand(true, { brand_logo_path: null, brand_color: null }), null);
  assert.deepEqual(sessionBrand(true, { brand_logo_path: null, brand_color: "#123456" }), { logoPath: null, color: "#123456" });
});
