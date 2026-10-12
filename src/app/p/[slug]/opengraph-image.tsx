import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicProfile } from "@/lib/data/speaker-profile";
import { SLUG_RE } from "@/lib/domain/speaker-profile";
import { formatInt, formatScore } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Perfil de palestrante no PulseStage";

// Cores fixas da identidade (azul-marinho, azul acadêmico e amarelo marca-texto).
const NAVY = "#0d1324";
const BLUE = "#7aa2ff";
const YELLOW = "#f4e04d";

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = SLUG_RE.test(slug) ? await getPublicProfile(createAdminClient(), slug) : null;
  const name = profile?.name ?? "Palestrante";
  const stats = profile?.stats;
  const facts = stats
    ? [
        stats.verifiedSessions > 0 ? `${formatInt(stats.verifiedSessions)} ${stats.verifiedSessions === 1 ? "sessão" : "sessões"}` : null,
        stats.peopleReached > 0 ? `${formatInt(stats.peopleReached)} pessoas` : null,
        stats.rating !== null ? `nota ${formatScore(stats.rating)}` : null,
      ].filter((f): f is string => f !== null)
    : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: NAVY,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 700 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: BLUE, display: "flex" }} />
          PulseStage
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{name}</div>
          {profile?.headline ? <div style={{ fontSize: 34, color: "#c9d3ea", lineHeight: 1.3 }}>{profile.headline}</div> : null}
          {profile && profile.topics.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {profile.topics.slice(0, 4).map((t) => (
                <div key={t} style={{ background: YELLOW, color: NAVY, borderRadius: 999, padding: "6px 20px", fontSize: 26, fontWeight: 600 }}>
                  {t}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, color: BLUE, fontWeight: 600 }}>
          {facts.length > 0 ? `Dados verificados: ${facts.join(" · ")}` : "Perfil de palestrante"}
        </div>
      </div>
    ),
    size,
  );
}
