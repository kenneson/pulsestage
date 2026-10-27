"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { setLeaderboardModeAction } from "@/features/live/actions";
import { cn } from "@/lib/utils";
import type { LeaderboardMode } from "@/components/display/quiz-leaderboard";

/** Alternância "Pessoas | Equipes" do ranking no telão (set_leaderboard_mode). */
export function LeaderboardModeToggle({
  sessionId,
  mode,
  disabled,
  onChanged,
}: {
  sessionId: string;
  mode: LeaderboardMode;
  disabled?: boolean;
  onChanged?: () => void;
}) {
  const t = useTranslations("live.leaderboardMode");
  const [pending, startTransition] = useTransition();

  function select(next: LeaderboardMode) {
    if (next === mode) return;
    startTransition(async () => {
      const result = await setLeaderboardModeAction(sessionId, next);
      if (!result.ok) toast.error(result.error);
      else onChanged?.();
    });
  }

  return (
    <div className="flex items-center gap-2 max-md:w-full">
      <span className="shrink-0 text-sm text-muted-foreground">{t("label")}</span>
      <div role="group" aria-label={t("label")} className="inline-flex rounded-md border p-0.5 max-md:flex-1">
        {(["people", "teams"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            disabled={disabled || pending}
            onClick={() => select(option)}
            className={cn(
              "h-7 rounded px-3 text-sm font-medium transition-colors disabled:opacity-60 max-md:h-10 max-md:flex-1",
              mode === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
