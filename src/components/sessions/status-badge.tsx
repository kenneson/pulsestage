import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, toSessionStatus } from "@/lib/domain/session";

export function StatusBadge({ status }: { status: string }) {
  const s = toSessionStatus(status);
  const variant = s === "live" ? "live" : s === "paused" ? "warning" : s === "completed" ? "secondary" : "outline";
  return (
    <Badge variant={variant}>
      {s === "live" ? <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden /> : null}
      {STATUS_LABEL[s]}
    </Badge>
  );
}
