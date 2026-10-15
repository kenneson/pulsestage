"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatInt } from "@/lib/format";
import { Input } from "@/components/ui/input";

export function OpenTextList({ items, emptyText }: { items: string[]; emptyText?: string }) {
  const t = useTranslations("analytics.openText");
  const tCommon = useTranslations("common.actions");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(locale);
    return q ? items.filter((text) => text.toLocaleLowerCase(locale).includes(q)) : items;
  }, [items, query, locale]);

  if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyText ?? t("empty")}</p>;

  return (
    <div className="flex flex-col gap-3">
      {items.length > 5 ? (
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPlaceholder")} aria-label={tCommon("search")} />
      ) : null}
      <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
        {filtered.map((text, index) => (
          <li key={`${index}-${text.slice(0, 20)}`} className="rounded-lg border bg-background px-3 py-2 text-sm">
            {text}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {t("count", { shown: formatInt(filtered.length, locale), total: formatInt(items.length, locale) })}
      </p>
    </div>
  );
}
