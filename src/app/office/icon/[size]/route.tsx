import { ImageResponse } from "next/og";
import { LOGO_PATH } from "@/components/logo";

// Ícones do suplemento do PowerPoint (o manifesto pede 32 e 64 px). Mesmo desenho de app/icon.tsx.
const BLUE = "#245fd4";
const SIZES = new Set([32, 64, 80]);

export async function GET(_request: Request, context: { params: Promise<{ size: string }> }) {
  const px = Number((await context.params).size);
  if (!SIZES.has(px)) return new Response(null, { status: 404 });
  const glyph = Math.round(px * (16 / 28));
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
          borderRadius: px * (8 / 28),
        }}
      >
        <svg viewBox="0 0 24 24" width={glyph} height={glyph} fill="none" stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round">
          <path d={LOGO_PATH} />
        </svg>
      </div>
    ),
    { width: px, height: px, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
