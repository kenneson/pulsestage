import Link from "next/link";
import type { SessionRow } from "@/lib/supabase/types";
import { formatDateTime } from "@/lib/datetime";
import { toSessionStatus } from "@/lib/domain/session";
import { cn } from "@/lib/utils";
import { CheckIcon, ChevronRightIcon } from "@/components/icons";
import { StatusBadge } from "./status-badge";

export function sessionHref(session: Pick<SessionRow, "id" | "status">): string {
  if (session.status === "live" || session.status === "paused") return `/dashboard/sessions/${session.id}/live`;
  if (session.status === "completed") return `/dashboard/sessions/${session.id}/analytics`;
  return `/dashboard/sessions/${session.id}`;
}

/** Sinal de status na frente da linha: luz verde ao vivo, âmbar em pausa, check encerrada, ponto rascunho. */
function StatusMark({ status }: { status: string }) {
  const s = toSessionStatus(status);
  if (s === "completed") return <CheckIcon className="text-muted-foreground" aria-hidden />;
  return (
    <span
      aria-hidden
      className={cn(
        "mx-1 size-2.5 shrink-0 rounded-full",
        s === "live" && "bg-primary",
        s === "paused" && "bg-standby",
        s === "draft" && "bg-foreground/25",
      )}
    />
  );
}

export function SessionList({ sessions, timeZone }: { sessions: SessionRow[]; timeZone?: string }) {
  return (
    <ul className="divide-y rounded-md bg-card shadow-[0_10px_28px_-18px_color-mix(in_oklch,var(--foreground)_32%,transparent)] dark:border">
      {sessions.map((s) => (
        <li key={s.id}>
          <Link href={sessionHref(s)} className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50">
            <span className="grid size-5 place-items-center">
              <StatusMark status={s.status} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{s.title}</p>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(s.scheduled_at ?? s.started_at ?? s.created_at, timeZone)} · código{" "}
                <span className="font-script">{s.join_code}</span>
              </p>
            </div>
            <StatusBadge status={s.status} />
            <ChevronRightIcon className="text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
