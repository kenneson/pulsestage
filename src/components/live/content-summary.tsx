"use client";

import { useTranslations } from "next-intl";
import { contentBlocks } from "@/lib/domain/content";
import type { PublicInteraction } from "@/lib/domain/interactions";
import { optionImageSrc } from "@/lib/option-images/url";
import { ImageIcon, PlayIcon } from "@/components/icons";

/**
 * Slide de conteúdo no telão, visto da sala ao vivo: o texto (para acompanhar a fala) e se há imagem
 * ou vídeo. Não recebe respostas. O vídeo toca só no telão.
 */
export function ContentSummary({ interaction }: { interaction: PublicInteraction }) {
  const t = useTranslations("live.content");
  const { body, imagePath, videoUrl } = interaction.settings;
  const blocks = contentBlocks(body);
  return (
    <div className="flex flex-col gap-3">
      {blocks.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg bg-muted/50 px-4 py-3">
          {blocks.map((block, index) =>
            block.kind === "paragraph" ? (
              <p key={index} className="text-sm leading-relaxed max-md:text-base">
                {block.text}
              </p>
            ) : (
              <ul key={index} className="list-disc pl-5 text-sm leading-relaxed max-md:text-base">
                {block.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ),
          )}
        </div>
      ) : null}
      {imagePath || videoUrl ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {imagePath ? (
            <span className="inline-flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem pública do Storage */}
              <img src={optionImageSrc(imagePath)} alt="" className="h-12 w-auto max-w-24 rounded border object-cover" />
              <ImageIcon aria-hidden className="size-4" /> {t("hasImage")}
            </span>
          ) : null}
          {videoUrl ? (
            <span className="inline-flex items-center gap-1.5">
              <PlayIcon aria-hidden className="size-4" /> {t("hasVideo")}
            </span>
          ) : null}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">{t("noResponses")}</p>
    </div>
  );
}
