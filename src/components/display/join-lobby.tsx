"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { LOBBY_POLL_MS, lobbySchema, type Lobby, type LobbyEntry } from "@/lib/domain/lobby";
import { fetchJson, usePolling } from "@/lib/realtime/use-polling";
import { cn } from "@/lib/utils";
import { UserIcon } from "@/components/icons";
import { AnimatedNumber } from "@/components/motion/animated";
import { SPRING } from "@/components/motion/presets";

// Sala de espera no telão: enquanto o QR Code está na tela, quem entra aparece com avatar e nome.
// Cada um entra com um "pulo" e fica flutuando devagar (fase e ritmo próprios, tirados da chave, para
// a sala não balançar em bloco). Quem acabou de entrar ganha um contorno que some.

/** Número em [0, 1) estável para a mesma chave (ritmo de cada um). */
function unit(key: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return ((hash >>> 0) % 10_000) / 10_000;
}

function Person({ entry, fresh }: { entry: LobbyEntry; fresh: boolean }) {
  const t = useTranslations("display.lobby");
  const duration = 3 + unit(entry.key, 1) * 2.5;
  const rise = 4 + unit(entry.key, 2) * 6;
  const sway = (unit(entry.key, 3) - 0.5) * 8;
  return (
    <m.li
      layout
      initial={{ opacity: 0, scale: 0.3, y: 40 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }}
      transition={SPRING.snappy}
      className="relative"
    >
      <m.span
        className={cn(
          "flex items-center gap-3 rounded-full border bg-muted/60 py-2 pl-2 text-2xl",
          entry.name ? "pr-5" : "pr-2",
        )}
        animate={{ y: [0, -rise, 0], x: [0, sway, 0] }}
        transition={{ duration, repeat: Infinity, ease: "easeInOut", delay: unit(entry.key, 4) * 2 }}
      >
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-background text-3xl leading-none">
          {entry.avatar ?? <UserIcon width={22} height={22} className="text-muted-foreground" />}
        </span>
        {entry.name ? (
          <span className="max-w-[14ch] truncate font-medium">{entry.name}</span>
        ) : (
          <span className="sr-only">{t("anonymous")}</span>
        )}
      </m.span>
      {fresh ? (
        // Acabou de entrar: um contorno azul que se apaga.
        <m.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full ring-4 ring-primary"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2.4, delay: 0.4 }}
        />
      ) : null}
    </m.li>
  );
}

export function JoinLobby({
  sessionId,
  title,
  participantCount,
  panel,
}: {
  sessionId: string;
  title: string;
  /** contador do realtime: mudou, alguém entrou (busca na hora) */
  participantCount: number;
  /** QR Code e código de entrada */
  panel: React.ReactNode;
}) {
  const t = useTranslations("display.lobby");
  const locale = useLocale();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  // Quem já estava quando o telão abriu não ganha o contorno de "acabou de entrar".
  const [known, setKnown] = useState<Set<string> | null>(null);

  const load = useCallback(async () => {
    const next = await fetchJson(`/api/session/${sessionId}/lobby`, lobbySchema.parse);
    if (!next) return;
    setKnown((current) => current ?? new Set(next.entries.map((e) => e.key)));
    setLobby(next);
  }, [sessionId]);
  usePolling(load, LOBBY_POLL_MS);

  const seenCount = useRef(participantCount);
  useEffect(() => {
    if (seenCount.current === participantCount) return;
    seenCount.current = participantCount;
    void load();
  }, [participantCount, load]);

  const entries = lobby?.entries ?? [];
  const total = lobby?.total ?? 0;
  const people = entries.length > 0;

  return (
    <div className="flex w-full max-w-7xl flex-col items-center gap-10">
      <h1 className="max-w-5xl text-center text-5xl font-semibold leading-tight">{title}</h1>
      <div className={cn("flex w-full items-center gap-14", people ? "justify-between" : "justify-center")}>
        {/* O QR Code anda para a esquerda quando a primeira pessoa chega, abrindo espaço para a sala. */}
        <m.div layout transition={SPRING.soft} className="shrink-0">
          {panel}
        </m.div>
        <AnimatePresence>
          {people ? (
            <m.section
              key="people"
              aria-live="polite"
              className="flex min-w-0 flex-1 flex-col gap-6 self-stretch"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING.soft}
            >
              <p className="font-display text-4xl font-bold">
                <AnimatedNumber value={total} locale={locale} duration={0.6} render={(count) => t("count", { count })} />
              </p>
              <ul className="flex flex-wrap content-start gap-x-4 gap-y-5">
                <AnimatePresence initial={false}>
                  {entries.map((entry) => (
                    <Person key={entry.key} entry={entry} fresh={known !== null && !known.has(entry.key)} />
                  ))}
                </AnimatePresence>
                {total > entries.length ? (
                  <li className="self-center px-2 text-2xl text-muted-foreground">
                    {t("more", { count: total - entries.length })}
                  </li>
                ) : null}
              </ul>
            </m.section>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
