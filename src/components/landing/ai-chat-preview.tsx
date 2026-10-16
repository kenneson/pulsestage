import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { CheckIcon } from "@/components/icons";

// Conversa de exemplo da seção de IA (dados simulados, rotulados).
const AI_PLAN = [
  { slide: 2, paper: "bg-rev-yellow", type: "word_cloud", text: "cloud" },
  { slide: 7, paper: "bg-rev-gold", type: "quiz", text: "quiz" },
  { slide: 12, paper: "bg-rev-pink", type: "rating", text: "scale" },
  { slide: null, paper: "bg-rev-green", type: "open_text", text: "open" },
] as const;

export async function AiChatPreview({ className }: { className?: string }) {
  const [t, tDomain] = await Promise.all([getTranslations("landing.ai"), getTranslations("domain")]);
  return (
    <figure className={cn("reveal flex flex-col gap-4 rounded-sm bg-card p-5 dark:border sm:p-6", className)}>
      <div className="ml-auto flex max-w-[85%] flex-col items-end gap-2">
        <span className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
          <span className="grid size-8 place-items-center rounded-md bg-destructive/15 text-[10px] font-bold text-destructive">PDF</span>
          <span className="flex flex-col leading-tight">
            <span className="font-medium">{t("fileName")}</span>
            <span className="text-xs text-muted-foreground">{t("pages", { count: 18 })}</span>
          </span>
        </span>
        <p className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">{t("request")}</p>
      </div>

      <div className="flex max-w-[92%] flex-col gap-3 rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm">
        <p>{t("proposal")}</p>
        <ol className="flex flex-col gap-2">
          {AI_PLAN.map((item) => (
            <li key={item.text} className={cn("flex flex-col gap-0.5 rounded-md px-3 py-2 text-rev-foreground", item.paper)}>
              <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                {item.slide === null ? t("atEnd") : t("afterSlide", { n: item.slide })} · {tDomain(`interactionTypes.${item.type}.label`)}
              </span>
              <span className="font-medium leading-snug">{t(`plan.${item.text}`)}</span>
            </li>
          ))}
        </ol>
        <p>{t("confirmQuestion")}</p>
      </div>

      <p className="ml-auto rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">{t("confirmAnswer")}</p>

      <p className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium">
        <CheckIcon className="text-primary" /> {t("saved", { count: AI_PLAN.length })}
      </p>
      <figcaption className="text-xs text-muted-foreground">{t("caption")}</figcaption>
    </figure>
  );
}
