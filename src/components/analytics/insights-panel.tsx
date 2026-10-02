"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generateInsightsAction } from "@/features/insights/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/misc";
import { SparklesIcon } from "@/components/icons";

export type InsightView = {
  id: string;
  type: string;
  title: string;
  description: string;
  evidence: string[];
  priority: string | null;
  confidence: string;
};

const CONFIDENCE_LABEL: Record<string, string> = { low: "baixa", medium: "média", high: "alta" };
const PRIORITY_LABEL: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta" };

const SECTIONS = [
  { type: "strength", title: "Pontos fortes" },
  { type: "attention_point", title: "Pontos de atenção" },
  { type: "recommendation", title: "Recomendações para a próxima sessão" },
] as const;

export function InsightsPanel({
  sessionId,
  insights,
  configured,
  generatedAt,
  meta,
}: {
  sessionId: string;
  insights: InsightView[];
  configured: boolean;
  generatedAt: string | null;
  meta: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const generate = () =>
    startTransition(async () => {
      const result = await generateInsightsAction(sessionId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Insights gerados.");
      router.refresh();
    });

  const summary = insights.find((i) => i.type === "summary");
  const quality = insights.find((i) => i.type === "data_quality");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {generatedAt ? `Gerado em ${generatedAt}${meta ? ` · ${meta}` : ""}` : "Análise com IA baseada apenas nos dados desta sessão."}
        </p>
        <Button onClick={generate} disabled={pending || !configured}>
          <SparklesIcon /> {pending ? "Analisando…" : insights.length > 0 ? "Gerar novamente" : "Gerar insights"}
        </Button>
      </div>

      {!configured ? (
        <Alert tone="info">
          IA não configurada. Defina <code>AI_PROVIDER</code> e <code>AI_API_KEY</code> no ambiente. O restante do
          analytics funciona normalmente.
        </Alert>
      ) : null}

      {insights.length === 0 ? (
        <EmptyState title="Nenhum insight gerado" description="Os insights separam o que foi observado, a interpretação e a recomendação." />
      ) : (
        <>
          {summary ? <p className="leading-relaxed">{summary.description}</p> : null}
          {quality ? (
            <Alert tone="info">
              <span className="font-medium">Confiança {CONFIDENCE_LABEL[quality.confidence] ?? quality.confidence}:</span>{" "}
              {quality.description}
            </Alert>
          ) : null}
          {SECTIONS.map((section) => {
            const items = insights.filter((i) => i.type === section.type);
            if (items.length === 0) return null;
            return (
              <div key={section.type} className="flex flex-col gap-3">
                <h3 className="font-semibold">{section.title}</h3>
                <ul className="flex flex-col gap-3">
                  {items.map((item) => (
                    <li key={item.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.title}</p>
                        {item.priority ? (
                          <Badge variant="outline">Prioridade {PRIORITY_LABEL[item.priority] ?? item.priority}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      {item.evidence.length > 0 ? (
                        <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                          {item.evidence.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
