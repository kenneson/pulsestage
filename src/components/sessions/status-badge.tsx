import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import { toSessionStatus } from "@/lib/domain/session";

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("domain.sessionStatus");
  const s = toSessionStatus(status);
  const variant = s === "live" ? "live" : s === "paused" ? "warning" : s === "completed" ? "secondary" : "outline";
  return (
    <Badge variant={variant}>
      {s === "live" ? <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" aria-hidden /> : null}
      {t(s)}
    </Badge>
  );
}
