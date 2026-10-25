import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { SessionRow } from "@/lib/supabase/types";
import { formatDateTime } from "@/lib/datetime";
import { toSessionStatus } from "@/lib/domain/session";
import { cn } from "@/lib/utils";
import { CheckIcon, ChevronRightIcon } from "@/components/icons";
import { StatusBadge } from "./status-badge";
import { DuplicateSessionButton } from "./session-controls";

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

export function SessionList({
  sessions,
  timeZone,
  duplicable = false,
}: {
  sessions: SessionRow[];
  timeZone?: string;
  /** botão "Duplicar" em cada linha */
  duplicable?: boolean;
}) {
  // Hooks do next-intl: funcionam em Server Component síncrono e no cliente.
  const t = useTranslations("dashboard.sessionList");
  const locale = useLocale();
  return (
    <ul className="divide-y rounded-md bg-card shadow-[0_10px_28px_-18px_color-mix(in_oklch,var(--foreground)_32%,transparent)] dark:border">
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center pr-2 transition-colors hover:bg-muted/50 max-md:pr-1 max-md:[&>button]:size-11">
          <Link href={sessionHref(s)} className="group flex min-w-0 flex-1 items-center gap-4 px-4 py-3.5 max-md:gap-3 max-md:pl-3 max-md:pr-1">
            <span className="grid size-5 place-items-center">
              <StatusMark status={s.status} />
            </span>
            <div className="min-w-0 flex-1">
              {/* No celular o título quebra em até 2 linhas e o status desce para baixo dos dados. */}
              <p className="truncate font-medium max-md:line-clamp-2 max-md:whitespace-normal max-md:break-words">{s.title}</p>
              <p className="text-sm text-muted-foreground">
                {t.rich("meta", {
                  date: formatDateTime(s.scheduled_at ?? s.started_at ?? s.created_at, timeZone, locale),
                  code: s.join_code,
                  b: (chunks) => <span className="font-display">{chunks}</span>,
                })}
              </p>
              <span className="mt-1.5 flex md:hidden">
                <StatusBadge status={s.status} />
              </span>
            </div>
            <span className="max-md:hidden md:contents">
              <StatusBadge status={s.status} />
            </span>
            {/* Com o botão Duplicar ao lado, no celular a seta sai para sobrar espaço ao título (a linha toda é o link). */}
            <ChevronRightIcon
              className={cn("text-muted-foreground transition-transform group-hover:translate-x-0.5", duplicable && "max-md:hidden")}
              aria-hidden
            />
          </Link>
          {duplicable ? <DuplicateSessionButton sessionId={s.id} title={s.title} iconOnly /> : null}
        </li>
      ))}
    </ul>
  );
}
