"use client";

import { useId, useTransition } from "react";
import * as m from "motion/react-m";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { showLeaderboardAction } from "@/features/live/actions";
import { showQuestionsAction } from "@/features/engagement/actions";
import { showRaffleAction } from "@/features/raffle/actions";
import type { ActionResult } from "@/lib/action-result";
import type { DeckItem } from "@/lib/domain/deck";
import type { SessionStatus } from "@/lib/domain/session";
import {
  isScreenOverlay,
  screenModeOf,
  screenModes,
  type ScreenContent,
  type ScreenFeatures,
  type ScreenMode,
} from "@/lib/domain/screen";
import { cn } from "@/lib/utils";
import { GiftIcon, MessageQuestionIcon, PresentationIcon, QrCodeIcon, TrendingUpIcon } from "@/components/icons";
import { SPRING } from "@/components/motion/presets";

const ICONS: Partial<Record<ScreenMode, typeof QrCodeIcon>> = {
  lineup: PresentationIcon,
  join: QrCodeIcon,
  leaderboard: TrendingUpIcon,
  questions: MessageQuestionIcon,
  raffle: GiftIcon,
};

/**
 * Seletor "No telão agora": um botão por tela possível (roteiro, QR Code, ranking do quiz, perguntas da
 * plateia, sorteio). O pressionado é o que está no telão. Usa as mesmas Server Actions dos cards; as telas
 * são mutuamente exclusivas no banco, então escolher uma tira a outra.
 */
export function ScreenSwitcher({
  sessionId,
  status,
  content,
  features,
  resumeItem,
  onShowJoin,
  onResume,
  onChanged,
  busy,
}: {
  sessionId: string;
  status: SessionStatus;
  content: ScreenContent;
  features: ScreenFeatures;
  /** item do roteiro para voltar a ele saindo do QR Code (null = nada a retomar) */
  resumeItem: DeckItem | null;
  onShowJoin: () => void;
  onResume: (item: DeckItem) => void;
  onChanged?: () => void;
  busy?: boolean;
}) {
  const t = useTranslations("live.screen");
  const [pending, startTransition] = useTransition();
  const current = screenModeOf(content);
  const pillId = useId();
  const modes = screenModes(status, features, current);

  const run = (task: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await task();
      if (!result.ok) toast.error(result.error);
      else onChanged?.();
    });

  /** Desliga a tela que está por cima do roteiro (o telão volta ao slide, ao QR ou à tela final). */
  const hide = (mode: ScreenMode) => {
    if (mode === "leaderboard") run(() => showLeaderboardAction(sessionId, false));
    else if (mode === "questions") run(() => showQuestionsAction(sessionId, false, null));
    else if (mode === "raffle") run(() => showRaffleAction(sessionId, false));
  };

  function select(mode: ScreenMode) {
    if (mode === current) return;
    if (mode === "leaderboard") return run(() => showLeaderboardAction(sessionId, true));
    if (mode === "questions") return run(() => showQuestionsAction(sessionId, true, null));
    if (mode === "raffle") return run(() => showRaffleAction(sessionId, true));
    if (mode === "join") return onShowJoin();
    // Roteiro, pausa ou tela final: tira o que está por cima.
    if (isScreenOverlay(current)) return hide(current);
    if (mode === "lineup" && resumeItem) onResume(resumeItem);
  }

  const canSelect = (mode: ScreenMode) => {
    if (mode === current) return true;
    if (status === "draft") return false;
    if (mode === "lineup") return isScreenOverlay(current) || resumeItem !== null;
    return true;
  };

  return (
    <div className="flex flex-col gap-2">
      {/* No celular, uma faixa de botões que rola na horizontal, de ponta a ponta do card. */}
      <div
        role="group"
        aria-label={t("groupLabel")}
        className="flex flex-wrap gap-1.5 max-md:-mx-5 max-md:flex-nowrap max-md:gap-2 max-md:overflow-x-auto max-md:px-5 max-md:py-0.5 max-md:[scrollbar-width:none]"
      >
        {modes.map((mode) => {
          const Icon = ICONS[mode];
          const on = mode === current;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={on}
              disabled={!on && (pending || busy || !canSelect(mode))}
              onClick={() => select(mode)}
              className={cn(
                "relative inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-50 [&_svg]:size-3.5",
                "max-md:h-11 max-md:shrink-0 max-md:px-4 max-md:text-sm max-md:[&_svg]:size-4",
                on
                  ? "border-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {/* O fundo azul desliza até a tela escolhida: mostra de onde o telão saiu e para onde foi. */}
              {on ? (
                <m.span
                  layoutId={pillId}
                  aria-hidden
                  className="absolute -inset-px rounded-full bg-primary"
                  transition={SPRING.snappy}
                />
              ) : null}
              <span className="relative inline-flex items-center gap-1.5">
                {Icon ? <Icon aria-hidden /> : null}
                {t(`modes.${mode}`)}
              </span>
            </button>
          );
        })}
      </div>
      {status === "draft" ? <p className="text-xs text-muted-foreground">{t("draftHint")}</p> : null}
    </div>
  );
}
