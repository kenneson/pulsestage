import { ImageResponse } from "next/og";
import { LOGO_PATH } from "@/components/logo";

// Ícone da tela de início do iPhone/iPad: o iOS arredonda os cantos sozinho, então o azul vai até a borda.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#245fd4" }}>
        <svg viewBox="0 0 24 24" width={96} height={96} fill="none" stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round">
          <path d={LOGO_PATH} />
        </svg>
      </div>
    ),
    size,
  );
}
