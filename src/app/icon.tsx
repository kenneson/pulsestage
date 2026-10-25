import { ImageResponse } from "next/og";
import { LOGO_PATH } from "@/components/logo";

// Ícones do app: o símbolo da marca (pulso branco no azul acadêmico, o `--primary` claro).
// 32: aba do navegador. 192/512: instalação (manifest). maskable: o Android recorta em círculo ou gota,
// então o azul vai até a borda e o símbolo fica dentro da zona segura (80% centrais).
const BLUE = "#245fd4";
const ICONS = [
  { id: "32", px: 32, maskable: false },
  { id: "192", px: 192, maskable: false },
  { id: "512", px: 512, maskable: false },
  { id: "maskable", px: 512, maskable: true },
] as const;

export function generateImageMetadata() {
  return ICONS.map(({ id, px }) => ({ id, contentType: "image/png", size: { width: px, height: px } }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const key = String(await id);
  const icon = ICONS.find((i) => i.id === key) ?? ICONS[0];
  // Mesma proporção da marca na tela (traço de 16 px num quadrado de 28 px, cantos de 8 px).
  const glyph = Math.round(icon.px * (icon.maskable ? 0.46 : 16 / 28));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BLUE,
          borderRadius: icon.maskable ? 0 : icon.px * (8 / 28),
        }}
      >
        <svg viewBox="0 0 24 24" width={glyph} height={glyph} fill="none" stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round">
          <path d={LOGO_PATH} />
        </svg>
      </div>
    ),
    { width: icon.px, height: icon.px },
  );
}
