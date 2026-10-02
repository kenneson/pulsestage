"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { snapshotFromRow, type ResultsMap } from "@/lib/domain/results";
import { resultRowSchema } from "./schemas";

export type { ResultsMap };

/** Agregados em tempo real de todas as interactions da sessão. */
export function useInteractionResults(sessionId: string, initial: ResultsMap): ResultsMap {
  const [results, setResults] = useState<ResultsMap>(initial);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`results:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "interaction_results", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const parsed = resultRowSchema.safeParse(payload.new);
          if (!parsed.success) return;
          const row = parsed.data;
          setResults((prev) => ({ ...prev, [row.interaction_id]: snapshotFromRow(row) }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return results;
}
