import { useTranslations } from "next-intl";
import type { PublicInteraction } from "@/lib/domain/interactions";
import { contentBlocks, toEmbedUrl } from "@/lib/domain/content";
import { optionImageSrc } from "@/lib/option-images/url";
import { cn } from "@/lib/utils";

// Slide de conteúdo (título, texto em blocos, imagem e vídeo). Sem "use client": serve ao telão, à sala ao vivo,
// ao celular no ritmo próprio e à análise. O texto é renderizado como texto (nada de HTML do palestrante).
// Vídeo só do YouTube/Vimeo, no player embutido sem autoplay (ninguém leva um susto com som no auditório).

type Variant = "compact" | "display";

export function ContentSlide({
  interaction,
  variant = "compact",
  showTitle = false,
}: {
  interaction: Pick<PublicInteraction, "title" | "settings">;
  variant?: Variant;
  /** telão e celular: o título faz parte do slide; na sala ao vivo e na análise, o card já mostra */
  showTitle?: boolean;
}) {
  const t = useTranslations("results.content");
  const big = variant === "display";
  const { body, imagePath, videoUrl } = interaction.settings;
  const blocks = contentBlocks(body);
  const embed = videoUrl ? toEmbedUrl(videoUrl) : null;
  const media = embed ? (
    <div className={cn("w-full overflow-hidden rounded-2xl border bg-black", big ? "max-w-5xl" : "")}>
      <iframe
        src={embed}
        title={t("video", { title: interaction.title })}
        className="aspect-video w-full"
        loading="lazy"
        allow="encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  ) : imagePath ? (
    // eslint-disable-next-line @next/next/no-img-element -- imagem pública do Storage
    <img
      src={optionImageSrc(imagePath)}
      alt=""
      className={cn("mx-auto w-auto max-w-full rounded-2xl border object-contain", big ? "max-h-[58vh]" : "max-h-72")}
    />
  ) : null;
  // Telão com texto e mídia: lado a lado; só um dos dois: centralizado.
  const split = big && media !== null && blocks.length > 0;

  return (
    <article
      className={cn(
        "grid w-full min-w-0 items-center",
        big ? "gap-10 max-md:gap-6" : "gap-4",
        split && "md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]",
      )}
    >
      {showTitle || blocks.length > 0 ? (
        <div className={cn("grid min-w-0", big ? "gap-6" : "gap-3", big && !split && "text-center")}>
          {showTitle ? (
            <h1
              className={cn(
                "font-semibold leading-tight text-balance break-words",
                big ? "text-5xl md:text-6xl max-md:text-3xl" : "text-xl",
              )}
            >
              {interaction.title}
            </h1>
          ) : null}
          {blocks.map((block, index) =>
            block.kind === "paragraph" ? (
              <p
                key={index}
                className={cn(
                  "text-pretty break-words",
                  big ? "text-3xl leading-snug text-foreground/90 max-md:text-xl" : "text-sm leading-relaxed",
                )}
              >
                {block.text}
              </p>
            ) : (
              <ul
                key={index}
                className={cn(
                  "grid list-disc break-words marker:text-primary",
                  big ? "gap-3 pl-10 text-3xl leading-snug max-md:pl-6 max-md:text-xl" : "gap-1.5 pl-5 text-sm",
                  big && !split && "mx-auto w-fit text-left",
                )}
              >
                {block.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ),
          )}
        </div>
      ) : null}
      {media}
    </article>
  );
}
