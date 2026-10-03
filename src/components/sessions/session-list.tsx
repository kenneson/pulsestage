import Link from "next/link";
import type { SessionRow } from "@/lib/supabase/types";
import { formatDateTime } from "@/lib/datetime";
import { StatusBadge } from "./status-badge";

export function sessionHref(session: Pick<SessionRow, "id" | "status">): string {
  if (session.status === "live" || session.status === "paused") return `/dashboard/sessions/${session.id}/live`;
  if (session.status === "completed") return `/dashboard/sessions/${session.id}/analytics`;
  return `/dashboard/sessions/${session.id}`;
}

export function SessionList({ sessions }: { sessions: SessionRow[] }) {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {sessions.map((s) => (
        <li key={s.id}>
          <Link href={sessionHref(s)} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{s.title}</p>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(s.scheduled_at ?? s.started_at ?? s.created_at)} · código{" "}
                <span className="font-script">{s.join_code}</span>
              </p>
            </div>
            <StatusBadge status={s.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
