"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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

// Confiança e prioridade chegam em inglês no JSON da IA ("low", "medium", "high").
const LEVELS = ["low", "medium", "high"] as const;
type Level = (typeof LEVELS)[number];
const isLevel = (value: string): value is Level => (LEVELS as readonly string[]).includes(value);

const SECTIONS = ["strength", "attention_point", "recommendation"] as const;

export function InsightsPanel({
  sessionId,
  insights,
  configured,
  problem,
  generatedAt,
  meta,
}: {
  sessionId: string;
  insights: InsightView[];
  configured: boolean;
  /** o que falta na configuração (ex.: "Falta a variável AI_API_KEY") */
  problem?: string | null;
  generatedAt: string | null;
  meta: string | null;
}) {
  const t = useTranslations("analytics.insights");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const generate = () =>
    startTransition(async () => {
      const result = await generateInsightsAction(sessionId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("generated"));
      router.refresh();
    });

  const summary = insights.find((i) => i.type === "summary");
  const quality = insights.find((i) => i.type === "data_quality");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {generatedAt ? `${t("generatedAt", { date: generatedAt })}${meta ? ` · ${meta}` : ""}` : t("intro")}
        </p>
        <Button onClick={generate} disabled={pending || !configured}>
          <SparklesIcon /> {pending ? t("analyzing") : insights.length > 0 ? t("regenerate") : t("generate")}
        </Button>
      </div>

      {!configured ? (
        <Alert tone="info">
          {t("notConfigured")} {problem ?? t("defaultProblem")} {t("vercelHint")}
        </Alert>
      ) : null}

      {insights.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <>
          {summary ? <p className="leading-relaxed">{summary.description}</p> : null}
          {quality ? (
            <Alert tone="info">
              <span className="font-medium">
                {isLevel(quality.confidence)
                  ? t(`confidence.${quality.confidence}`)
                  : t("confidence.other", { level: quality.confidence })}
                :
              </span>{" "}
              {quality.description}
            </Alert>
          ) : null}
          {SECTIONS.map((section) => {
            const items = insights.filter((i) => i.type === section);
            if (items.length === 0) return null;
            return (
              <div key={section} className="flex flex-col gap-3">
                <h3 className="font-semibold">{t(`sections.${section}`)}</h3>
                <ul className="flex flex-col gap-3">
                  {items.map((item) => (
                    <li key={item.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.title}</p>
                        {item.priority ? (
                          <Badge variant="outline">
                            {isLevel(item.priority)
                              ? t(`priority.${item.priority}`)
                              : t("priority.other", { level: item.priority })}
                          </Badge>
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
