import { getLocale, getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { formatScore } from "@/lib/format";

// Exemplo ilustrativo (dados simulados, rotulados) do relatório depois da sessão. Espelha o que o analytics
// mostra de verdade: confiança geral da análise da IA (lib/ai/schema.ts, data_quality) e prioridade por
// recomendação, sem prometer quantas respostas sustentam cada uma.
const PULSE = [
  { minute: 0, rate: 0.82 },
  { minute: 12, rate: 0.91 },
  { minute: 25, rate: 0.58 },
  { minute: 40, rate: 0.66 },
  { minute: 52, rate: 0.74 },
];

const CHART_MAX_MINUTE = 60;

const OVERALL_CONFIDENCE = "medium" as const;

const NOTES: { id: "cloud" | "quiz" | "comments"; priority: "high" | "medium" | "low" }[] = [
  { id: "quiz", priority: "high" },
  { id: "cloud", priority: "medium" },
  { id: "comments", priority: "low" },
];

const SCORECARD = [
  { dimension: "utilidade", value: 8.6, scale: "/10" },
  { dimension: "clareza", value: 4.4, scale: "/5" },
  { dimension: "engajamento", value: 4.1, scale: "/5" },
  { dimension: "conteudo", value: 4.5, scale: "/5" },
  { dimension: "aplicabilidade", value: 3.9, scale: "/5" },
] as const;

export async function ReportPreview({ className }: { className?: string }) {
  const [t, tDomain, locale] = await Promise.all([getTranslations("landing.report"), getTranslations("domain"), getLocale()]);
  const chartValues = new Intl.ListFormat(locale, { type: "conjunction" }).format(PULSE.map((p) => `${Math.round(p.rate * 100)}%`));

  return (
    <article className={cn("reveal flex flex-col gap-8 rounded-sm bg-card p-6 dark:border sm:p-8", className)}>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-4">
        <h3 className="font-display text-lg font-bold uppercase">{t("heading", { title: t("sampleTitle") })}</h3>
        <span className="text-xs text-muted-foreground">{t("simulated")}</span>
      </header>

      <figure className="flex flex-col gap-3">
        <figcaption className="text-sm font-semibold">{t("chartTitle")}</figcaption>
        <svg viewBox="0 0 300 120" role="img" aria-label={t("chartAria", { values: chartValues })} className="h-auto w-full font-display">
          {[0.25, 0.5, 0.75, 1].map((g) => (
            <line key={g} x1="0" x2="300" y1={100 - g * 90} y2={100 - g * 90} stroke="var(--border)" strokeWidth="1" />
          ))}
          <line x1="0" x2="300" y1="100" y2="100" stroke="var(--foreground)" strokeOpacity="0.35" strokeWidth="1" />
          {PULSE.map((p) => {
            const x = 14 + (p.minute / CHART_MAX_MINUTE) * 270;
            const h = p.rate * 90;
            const low = p.rate < 0.6;
            return (
              <g key={p.minute}>
                <rect className="reveal-bar" x={x - 9} y={100 - h} width="18" height={h} rx="2" fill={low ? "var(--standby)" : "var(--primary)"} />
                <text x={x} y={94 - h} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--foreground)">
                  {Math.round(p.rate * 100)}%
                </text>
                <text x={x} y="113" textAnchor="middle" fontSize="8" fill="var(--muted-foreground)">
                  {t("minute", { minute: p.minute })}
                </text>
              </g>
            );
          })}
        </svg>
      </figure>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-semibold">{t("suggestions")}</p>
          <span className="text-xs font-medium text-muted-foreground">{t(`overall.${OVERALL_CONFIDENCE}`)}</span>
        </div>
        <p className="text-xs text-muted-foreground">{t("dataNote")}</p>
        <ol className="flex flex-col gap-4">
          {NOTES.map((note, index) => (
            <li key={note.id} className="grid grid-cols-[1.5rem_1fr] gap-x-2">
              <span className="font-display font-bold tabular-nums">{index + 1}.</span>
              <div className="flex flex-col gap-1">
                <p
                  className={cn(
                    "leading-relaxed underline decoration-2 underline-offset-[6px]",
                    note.priority === "high" && "decoration-foreground",
                    note.priority === "medium" && "decoration-foreground/50",
                    note.priority === "low" && "decoration-foreground/40 decoration-dashed decoration-1",
                  )}
                >
                  {t(`notes.${note.id}`)}
                </p>
                <span className="text-xs text-muted-foreground">{t(`priority.${note.priority}`)}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-3 border-t pt-5">
        <p className="text-sm font-semibold">{t("rating")}</p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
          {SCORECARD.map((s) => (
            <div key={s.dimension} className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{tDomain(`dimensions.${s.dimension}`)}</dt>
              <dd className="font-display text-xl font-bold tabular-nums">
                {formatScore(s.value, locale)}
                <span className="text-sm font-normal text-muted-foreground">{s.scale}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}
