import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16: "proxy" substitui "middleware". Em Next 15, renomeie para middleware.ts
// e a função para `middleware`.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
