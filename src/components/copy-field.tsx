"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CheckIcon, CopyIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Texto para copiar (endereço, comando ou prompt de exemplo). `label`: já traduzido, completa “Copiar {label}”. */
export function CopyField({ value, label, multiline = false, className }: { value: string; label: string; multiline?: boolean; className?: string }) {
  const t = useTranslations("dashboard.copyField");
  const tActions = useTranslations("common.actions");
  const [copied, setCopied] = useState(false);
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <code
        className={cn(
          "min-w-0 flex-1 rounded-md bg-muted px-3 py-2 text-sm",
          multiline ? "whitespace-pre-wrap break-words font-sans" : "truncate",
        )}
      >
        {value}
      </code>
      <Button
        variant="outline"
        size="sm"
        aria-label={t("copyLabel", { label })}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            toast.error(t("copyFailed"));
          }
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />} {copied ? t("copied") : tActions("copy")}
      </Button>
    </div>
  );
}
