"use client";

import { useTranslations } from "next-intl";
import type { PublicInteraction } from "@/lib/domain/interactions";
import { contentBlocks, toEmbedUrl } from "@/lib/domain/content";
import { optionImageSrc } from "@/lib/option-images/url";
import { MonitorIcon } from "@/components/icons";

/** Slide de conteúdo no ritmo próprio (e na pré-visualização): texto em blocos, imagem e vídeo embutido. */
export function ContentBody({ interaction }: { interaction: PublicInteraction }) {
  const t = useTranslations("participant.answer");
  const { body, imagePath, videoUrl } = interaction.settings;
  const embed = videoUrl ? toEmbedUrl(videoUrl) : null;
  return (
    <div className="flex flex-col gap-4 text-base leading-relaxed">
      {contentBlocks(body).map((block, index) =>
        block.kind === "paragraph" ? (
          <p key={index}>{block.text}</p>
        ) : (
          <ul key={index} className="flex list-disc flex-col gap-1 pl-5">
            {block.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ),
      )}
      {imagePath ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem pública do Storage
        <img src={optionImageSrc(imagePath)} alt="" className="h-auto w-full rounded-xl border bg-muted" />
      ) : null}
      {embed ? (
        <div className="aspect-video w-full overflow-hidden rounded-xl border bg-muted">
          <iframe
            src={embed}
            title={t("video", { title: interaction.title })}
            className="size-full"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : null}
    </div>
  );
}

/** Slide de conteúdo ao vivo: o conteúdo está no telão; o celular só mostra o título. */
export function ContentFollowScreen({ interaction }: { interaction: PublicInteraction }) {
  const t = useTranslations("participant.answer");
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-muted text-muted-foreground">
        <MonitorIcon width={30} height={30} />
      </span>
      <h2 className="text-2xl font-semibold max-md:text-balance">{interaction.title}</h2>
      <p className="text-muted-foreground">{t("followScreen")}</p>
    </div>
  );
}
