"use client";

import { useLocale, useTranslations } from "next-intl";
import { acceptsResponses, isScoredType } from "@/lib/domain/interactions";
import { optionImageSrc } from "@/lib/option-images/url";
import { ClockIcon, FileTextIcon, PlayIcon } from "@/components/icons";
import type { InteractionDraft } from "./draft";

const Thumb = ({ path }: { path: string }) => (
  // eslint-disable-next-line @next/next/no-img-element -- imagem pública do Storage
  <img src={optionImageSrc(path)} alt="" className="size-12 shrink-0 rounded-md border bg-muted object-cover" />
);

/** Ícone de "tem notas do palestrante" (na linha da etiqueta do tipo). */
export function NotesBadge({ draft }: { draft: InteractionDraft }) {
  const t = useTranslations("builder.summary");
  if (!draft.notes.trim()) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={t("hasNotes")}>
      <FileTextIcon aria-hidden width={14} height={14} />
      <span className="sr-only md:not-sr-only">{t("notes")}</span>
    </span>
  );
}

/** Resumo útil de cada item do roteiro: alternativas, faixa, respostas aceitas, miniatura e ajustes. */
export function InteractionSummary({ draft }: { draft: InteractionDraft }) {
  const t = useTranslations("builder.summary");
  const locale = useLocale();
  const { type, settings: s, options } = draft;
  // Sem separador de milhar até 9999 (anos como 1995 ficam como se escrevem).
  const number = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: s.decimals, useGrouping: Math.abs(n) >= 10000 }).format(n);
  const labels = options.map((o) => o.label).join(" · ");

  let line: string | null = null;
  let thumb: string | null = null;
  switch (type) {
    case "multiple_choice":
    case "quiz":
    case "ranking":
    case "points_100":
      line = labels;
      break;
    case "matrix_2x2":
      line = [s.xLabel && s.yLabel ? `${s.xLabel} × ${s.yLabel}` : null, labels].filter(Boolean).join(" · ");
      break;
    case "rating":
      line = t("range", { min: s.min, max: s.max });
      break;
    case "guess_number":
      line = [t("range", { min: number(s.numMin), max: number(s.numMax) }), s.unit].filter(Boolean).join(" ");
      break;
    case "quiz_text":
      line = t("accepted", { count: draft.accepted.filter((a) => a.trim()).length });
      break;
    case "pin_image":
      thumb = s.imagePath;
      break;
    case "content":
      thumb = s.imagePath;
      line = s.body.split("\n").find((l) => l.trim())?.replace(/^[-•*]\s+/, "") ?? null;
      break;
    default:
      break;
  }

  const chips: React.ReactNode[] = [];
  if (type === "multiple_choice" && s.maxChoices > 1) chips.push(t("maxChoices", { count: s.maxChoices }));
  if (type === "multiple_choice" && s.isSegment) chips.push(t("segment"));
  if (type === "multiple_choice" && s.optionStyle === "images") chips.push(t("imageGrid"));
  if (type === "content" && s.videoUrl) {
    chips.push(
      <span key="video" className="inline-flex items-center gap-1">
        <PlayIcon aria-hidden width={12} height={12} /> {t("video")}
      </span>,
    );
  }
  if (acceptsResponses(type) && s.timerSeconds !== null) {
    chips.push(
      <span key="timer" className="inline-flex items-center gap-1">
        <ClockIcon aria-hidden width={12} height={12} /> {t("timer", { seconds: s.timerSeconds })}
      </span>,
    );
  }
  if (acceptsResponses(type) && s.hideResults) chips.push(t("hidden"));
  if (acceptsResponses(type) && !isScoredType(type) && s.showResultsOnPhone) chips.push(t("onPhone"));
  if ((type === "quiz_text" || type === "guess_number") && s.maxPoints) chips.push(t("points", { points: s.maxPoints }));

  if (!line && !thumb && chips.length === 0) return null;
  return (
    <div className="mt-1 flex items-start gap-3">
      {thumb ? <Thumb path={thumb} /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {line ? <p className="truncate text-sm text-muted-foreground">{line}</p> : null}
        {chips.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {chips.map((chip, index) => (
              <li key={index} className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
