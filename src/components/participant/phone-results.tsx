"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { PublicInteraction } from "@/lib/domain/interactions";
import { EMPTY_SNAPSHOT, snapshotFromRow, type ResultsSnapshot } from "@/lib/domain/results";
import { createClient } from "@/lib/supabase/client";
import { useInteractionResults } from "@/lib/realtime/use-interaction-results";
import { ResultsView } from "@/components/results/results-view";
import { CircleCheckIcon } from "@/components/icons";

/**
 * Gráfico ao vivo no celular, depois de responder (pergunta com "mostrar no celular"). Lê o agregado público
 * (`interaction_results`, liberado pelo RLS com a sessão fora do rascunho) e acompanha pelo realtime.
 */
export function PhoneResults({ sessionId, interaction }: { sessionId: string; interaction: PublicInteraction }) {
  const t = useTranslations("participant.view");
  const live = useInteractionResults(sessionId, {});
  const [initial, setInitial] = useState<{ id: string; snapshot: ResultsSnapshot } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void createClient()
      .from("interaction_results")
      .select("total, counts, recent")
      .eq("interaction_id", interaction.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setInitial({ id: interaction.id, snapshot: snapshotFromRow(data) });
      });
    return () => {
      cancelled = true;
    };
  }, [interaction.id]);

  // O realtime chega depois da leitura inicial: quando existe, é o mais novo.
  const snapshot = live[interaction.id] ?? (initial?.id === interaction.id ? initial.snapshot : EMPTY_SNAPSHOT);

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
        <CircleCheckIcon width={18} height={18} /> {t("answeredShort")}
      </p>
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4" aria-label={t("liveResults")}>
        <h2 className="text-base font-semibold leading-snug">{interaction.title}</h2>
        <ResultsView
          interaction={interaction}
          snapshot={snapshot}
          animated
          hideOpenText={interaction.type === "open_text" && !interaction.settings.showOnDisplay}
        />
        <p className="text-xs text-muted-foreground">{t("liveResults")}</p>
      </section>
    </div>
  );
}
