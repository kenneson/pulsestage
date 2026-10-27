"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { acceptsResponses } from "@/lib/domain/interactions";
import { EMPTY_SNAPSHOT, type ResultsMap } from "@/lib/domain/results";
import { share } from "@/lib/domain/live-room";
import type { SessionStatus } from "@/lib/domain/session";
import { fetchJson, usePolling } from "@/lib/realtime/use-polling";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRightIcon, FileTextIcon } from "@/components/icons";
import { TypeTag } from "@/components/interaction-type-tag";
import { ResultsView } from "@/components/results/results-view";
import { AnimatedBarFill } from "@/components/motion/animated";
import { AnswerKeyLine } from "./reveal-controls";
import type { ControlRoomInteraction } from "./control-room";

/** Releitura de "começaram/terminaram" (as contagens por pergunta chegam pelo realtime). */
const PROGRESS_POLL_MS = 5000;

const progressSchema = z.object({ started: z.number(), finished: z.number(), questions: z.number() });

function Stat({ label, value, detail }: { label: string; value: number; detail?: string }) {
  const locale = useLocale();
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted/60 px-4 py-3 max-md:px-3">
      <span className="text-xs text-muted-foreground max-md:leading-tight">{label}</span>
      <span className="font-display text-3xl font-bold tabular-nums max-md:text-2xl">{formatInt(value, locale)}</span>
      {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
    </div>
  );
}

/**
 * Sessão em ritmo próprio: cada pessoa percorre o roteiro no celular. A sala ao vivo acompanha: quem
 * entrou, quem começou, quem terminou tudo e quantas pessoas responderam cada pergunta. Tocar numa
 * pergunta abre o resultado dela. Sem Anterior/Próxima (ninguém conduz).
 */
export function SelfPacedPanel({
  sessionId,
  status,
  interactions,
  results,
  participantCount,
}: {
  sessionId: string;
  status: SessionStatus;
  interactions: ControlRoomInteraction[];
  results: ResultsMap;
  participantCount: number;
}) {
  const t = useTranslations("live.selfPace");
  const tContent = useTranslations("live.content");
  const [progress, setProgress] = useState<z.infer<typeof progressSchema> | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  usePolling(
    async () => {
      const data = await fetchJson(`/api/live/${sessionId}/progress`, progressSchema.parse);
      if (data) setProgress(data);
    },
    PROGRESS_POLL_MS,
    status !== "draft",
  );

  const joined = Math.max(participantCount, progress?.started ?? 0);
  // Numeração: só o que recebe resposta (slide de conteúdo não conta).
  const numberOf = new Map<string, number>();
  for (const i of interactions) if (acceptsResponses(i.type)) numberOf.set(i.id, numberOf.size + 1);

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-xl">{t("title")}</CardTitle>
          <Badge variant="secondary">{t("badge")}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-3 max-md:gap-2">
          <Stat label={t("joined")} value={joined} />
          <Stat label={t("started")} value={progress?.started ?? 0} detail={t("ofJoined", { count: joined })} />
          <Stat label={t("finished")} value={progress?.finished ?? 0} detail={t("ofJoined", { count: joined })} />
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("questions")}</h4>
          {interactions.length === 0 ? <p className="text-sm text-muted-foreground">{t("noQuestions")}</p> : null}
          <ol className="flex flex-col gap-1">
            {interactions.map((interaction) => {
              if (!acceptsResponses(interaction.type)) {
                return (
                  <li key={interaction.id} className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground">
                    <FileTextIcon aria-hidden className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate max-md:line-clamp-2 max-md:whitespace-normal">{interaction.title}</span>
                    <span className="shrink-0 text-xs">{tContent("item")}</span>
                  </li>
                );
              }
              const snapshot = results[interaction.id] ?? EMPTY_SNAPSHOT;
              const isOpen = open === interaction.id;
              const panelId = `self-${interaction.id}`;
              const fraction = share(snapshot.total, joined);
              return (
                <li key={interaction.id} className={cn("rounded-lg transition-colors", isOpen && "bg-muted/40")}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : interaction.id)}
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-muted max-md:min-h-14"
                  >
                    <span className="w-5 font-display font-bold text-muted-foreground tabular-nums">{numberOf.get(interaction.id)}</span>
                    <span className="min-w-0 truncate font-medium max-md:line-clamp-2 max-md:whitespace-normal">{interaction.title}</span>
                    <ChevronRightIcon aria-hidden className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                    <span />
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <AnimatedBarFill pct={fraction} className="bg-primary" />
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {t("answered", { count: snapshot.total, participants: joined })}
                      </span>
                    </span>
                    <span />
                  </button>
                  {isOpen ? (
                    <div id={panelId} className="flex flex-col gap-3 px-2 pt-1 pb-4 md:pl-10">
                      <div>
                        <TypeTag type={interaction.type} />
                      </div>
                      <ResultsView interaction={interaction} snapshot={snapshot} correctOptionId={interaction.correctOptionId}
                        answer={interaction.answer}
                        animated
                      />
                      <AnswerKeyLine interaction={interaction} answer={interaction.answer} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
