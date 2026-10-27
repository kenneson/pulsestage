"use client";

import { useTranslations } from "next-intl";
import { contentBlocks, toEmbedUrl } from "@/lib/domain/content";
import { optionImageSrc } from "@/lib/option-images/url";
import { cn } from "@/lib/utils";

/** Player do YouTube/Vimeo (endereço já convertido por `toEmbedUrl`). */
export function VideoEmbed({ url, title, className }: { url: string; title: string; className?: string }) {
  const embed = toEmbedUrl(url);
  if (!embed) return null;
  return (
    <iframe
      src={embed}
      title={title}
      loading="lazy"
      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      referrerPolicy="strict-origin-when-cross-origin"
      className={cn("aspect-video w-full rounded-lg border bg-muted", className)}
    />
  );
}

/** Como o slide de conteúdo fica: título, texto em blocos, imagem e vídeo (prévia do palestrante). */
export function ContentPreview({
  title,
  body,
  imagePath,
  videoUrl,
}: {
  title: string;
  body: string;
  imagePath: string | null;
  videoUrl: string | null;
}) {
  const t = useTranslations("builder.content");
  const blocks = contentBlocks(body);
  return (
    <div className="flex flex-col gap-3">
      {title ? <p className="font-display text-lg font-bold leading-tight">{title}</p> : null}
      {blocks.map((block, index) =>
        block.kind === "paragraph" ? (
          <p key={index} className="text-sm leading-relaxed">
            {block.text}
          </p>
        ) : (
          <ul key={index} className="list-disc pl-5 text-sm leading-relaxed">
            {block.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ),
      )}
      {imagePath ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem pública do Storage
        <img src={optionImageSrc(imagePath)} alt="" className="max-h-56 w-auto max-w-full self-start rounded-lg border object-contain" />
      ) : null}
      {videoUrl ? <VideoEmbed url={videoUrl} title={t("videoTitle")} /> : null}
    </div>
  );
}
