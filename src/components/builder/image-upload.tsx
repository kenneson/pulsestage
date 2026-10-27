"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ImageIcon, RefreshIcon, TrashIcon, XIcon } from "@/components/icons";
import { optionImageSrc } from "@/lib/option-images/url";
import { OptionImageError, uploadOptionImage } from "@/lib/option-images/upload";
import { translateAnyMessage } from "@/i18n/errors";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/** Envio de imagem para o bucket option-images (mesmo fluxo das alternativas: reduz a 800 px, WebP). */
function useImageUpload(onChange: (path: string | null) => void, onBusy: (busy: boolean) => void) {
  const t = useTranslations("builder.images");
  const tRoot = useTranslations();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function pick(file: File) {
    setUploading(true);
    onBusy(true);
    try {
      onChange(await uploadOptionImage(file));
    } catch (e) {
      toast.error(e instanceof OptionImageError ? translateAnyMessage(tRoot, e.message) : t("uploadFailed"));
    } finally {
      setUploading(false);
      onBusy(false);
    }
  }

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept={ACCEPT}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) void pick(file);
      }}
    />
  );
  return { uploading, open: () => input.current?.click(), fileInput };
}

const Spinner = () => <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;

/** Imagem opcional da alternativa: miniatura com "remover" ou botão para escolher o arquivo. */
export function OptionImagePicker({
  path,
  index,
  onChange,
  onBusy,
}: {
  path: string | null;
  index: number;
  onChange: (path: string | null) => void;
  onBusy: (busy: boolean) => void;
}) {
  const t = useTranslations("builder.images");
  const { uploading, open, fileInput } = useImageUpload(onChange, onBusy);

  if (path) {
    return (
      <span className="relative shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem pública do Storage */}
        <img src={optionImageSrc(path)} alt="" className="size-10 rounded-md border object-cover max-md:size-11" />
        <button
          type="button"
          aria-label={t("remove", { number: index + 1 })}
          onClick={() => onChange(null)}
          className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border bg-background text-muted-foreground hover:text-foreground max-md:-right-2 max-md:-top-2 max-md:size-7"
        >
          <XIcon width={12} height={12} />
        </button>
      </span>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="max-md:size-11"
        aria-label={t("add", { number: index + 1 })}
        title={t("addTitle")}
        disabled={uploading}
        onClick={open}
      >
        {uploading ? <Spinner /> : <ImageIcon />}
      </Button>
      {fileInput}
    </>
  );
}

/**
 * Imagem da própria pergunta ("Marcar na imagem" e slide de conteúdo): prévia grande com trocar/remover,
 * ou área para escolher o arquivo.
 */
export function ImageField({
  id,
  path,
  onChange,
  onBusy,
  required = false,
  children,
}: {
  id: string;
  path: string | null;
  onChange: (path: string | null) => void;
  onBusy: (busy: boolean) => void;
  required?: boolean;
  /** sobreposto à prévia (ex.: grade do mapa de calor) */
  children?: React.ReactNode;
}) {
  const t = useTranslations("builder.images");
  const { uploading, open, fileInput } = useImageUpload(onChange, onBusy);

  if (path) {
    return (
      <div className="flex flex-col gap-2">
        <div className="relative w-fit max-w-full overflow-hidden rounded-lg border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem pública do Storage */}
          <img src={optionImageSrc(path)} alt={t("preview")} className="block max-h-72 w-auto max-w-full object-contain" />
          {children}
        </div>
        <div className="flex flex-wrap gap-2 max-md:grid max-md:grid-cols-2">
          <Button id={id} variant="outline" size="sm" className="max-md:h-11" disabled={uploading} onClick={open}>
            {uploading ? <Spinner /> : <RefreshIcon />} {t("replace")}
          </Button>
          {!required ? (
            <Button variant="ghost" size="sm" className="max-md:h-11" disabled={uploading} onClick={() => onChange(null)}>
              <TrashIcon /> {t("removeImage")}
            </Button>
          ) : null}
        </div>
        {fileInput}
      </div>
    );
  }

  return (
    <>
      <button
        id={id}
        type="button"
        disabled={uploading}
        onClick={open}
        className={cn(
          "flex min-h-28 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
          required && "border-primary/50",
        )}
      >
        <span className="grid size-10 place-items-center rounded-lg bg-muted [&_svg]:size-5">{uploading ? <Spinner /> : <ImageIcon />}</span>
        <span className="font-medium">{uploading ? t("uploading") : t("choose")}</span>
        <span className="text-xs text-muted-foreground">{t("chooseHint")}</span>
      </button>
      {fileInput}
    </>
  );
}
