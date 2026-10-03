import * as React from "react";
import { cn } from "@/lib/utils";

function Progress({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center", className)}>
      <p className="font-medium">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

function Alert({ children, tone = "error", className }: { children: React.ReactNode; tone?: "error" | "success" | "info"; className?: string }) {
  const tones = {
    error: "border-destructive/30 bg-destructive/5 text-destructive",
    success: "border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300",
    info: "border-border bg-muted text-foreground",
  } as const;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-md border px-3 py-2 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}

export { Alert, EmptyState, Progress, Skeleton };
