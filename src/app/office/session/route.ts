import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findSessionByCode } from "@/lib/data/public";
import { requesterIpHash } from "@/lib/request-ip";
import { hitWindow } from "@/lib/domain/rate-limit";
import { JOIN_CODE_REGEX, normalizeJoinCode } from "@/lib/domain/session";

// Suplemento do PowerPoint: código de entrada → id do telão. Só sessões que ainda não acabaram
// (rascunho ou ao vivo): o mesmo que qualquer pessoa com o código já vê ao entrar. Erros de código
// contam por hash de IP, como na entrada da plateia (contra tentar adivinhar códigos).

const noStore = { "Cache-Control": "no-store" };
const misses = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_MISSES = 30;

export async function GET(request: Request) {
  const code = normalizeJoinCode(new URL(request.url).searchParams.get("code") ?? "");
  const ip = await requesterIpHash("office");
  if (ip && (misses.get(ip) ?? []).filter((t) => Date.now() - t < WINDOW_MS).length >= MAX_MISSES) {
    return NextResponse.json({ error: "too_many" }, { status: 429, headers: noStore });
  }
  const miss = () => {
    if (ip) hitWindow(misses, ip, Date.now(), WINDOW_MS, MAX_MISSES);
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
  };
  if (!JOIN_CODE_REGEX.test(code)) return miss();
  try {
    const session = await findSessionByCode(createAdminClient(), code);
    if (!session || session.status === "completed") return miss();
    return NextResponse.json({ id: session.id, title: session.title }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
