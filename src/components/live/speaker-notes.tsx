"use client";

import { useId, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRightIcon, FileTextIcon, LockIcon } from "@/components/icons";

const STORAGE_KEY = "pulsestage.live.notesOpen";
const CHANGE_EVENT = "pulsestage:notes-open";

// Aberto/recolhido fica neste navegador (localStorage); sem armazenamento, fica aberto.
function readOpen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function writeOpen(open: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  } catch {
    // sem armazenamento: não guarda
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Notas do palestrante do item no telão (pergunta ou slide), só na sala ao vivo. Recolhível; a escolha fica
 * neste navegador. Texto grande e com quebras preservadas, para ler no celular durante a fala.
 */
export function SpeakerNotes({
  label,
  text,
}: {
  /** "Agora: Slide 3" ou "A seguir: Enquete…" (null = nada no telão nem a seguir) */
  label: string | null;
  /** nota do item; null = sem nota */
  text: string | null;
}) {
  const t = useTranslations("live.notes");
  const bodyId = useId();
  const open = useSyncExternalStore(subscribe, readOpen, () => true);
  const toggle = () => writeOpen(!open);

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={toggle}
          className="flex w-full items-center gap-2 rounded-md px-5 py-4 text-left max-md:min-h-14"
        >
          <FileTextIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <CardTitle className="min-w-0 flex-1">
            {t("title")}
            {!open && text ? <span className="ml-2 text-sm font-normal text-muted-foreground">· {label}</span> : null}
          </CardTitle>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground max-sm:hidden">
            <LockIcon aria-hidden className="size-3" /> {t("onlyYou")}
          </span>
          <ChevronRightIcon aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
          <span className="sr-only">{open ? t("hide") : t("show")}</span>
        </button>
      </CardHeader>
      {open ? (
        <CardContent id={bodyId} className="pb-5">
          {label ? <p className="text-xs font-medium text-muted-foreground">{label}</p> : null}
          {text ? (
            <p className="mt-1.5 whitespace-pre-wrap break-words text-base leading-relaxed max-md:text-lg">{text}</p>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">{t("empty")}</p>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
