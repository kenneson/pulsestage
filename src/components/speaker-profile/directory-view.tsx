import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getPublicHref } from "@/i18n/seo";
import { formatScore } from "@/lib/format";
import {
  AUDIENCES,
  BR_STATES,
  DIRECTORY_PAGE_SIZE,
  filterDirectory,
  FORMATS,
  topTopics,
  type DirectoryEntry,
  type DirectoryFilters,
} from "@/lib/domain/speaker-profile";
import { Avatar } from "@/components/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { BadgeCheckIcon, MapPinIcon, SearchIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

async function SpeakerCard({ entry, href }: { entry: DirectoryEntry; href: string }) {
  const [t, locale] = await Promise.all([getTranslations("profile.directoryView"), getLocale()]);
  const place = [entry.city, entry.state].filter(Boolean).join(" · ");
  const { stats } = entry;
  return (
    <li className="flex">
      <Link
        href={href}
        className="flex w-full flex-col gap-4 rounded-md bg-card p-5 shadow-[0_14px_32px_-24px_color-mix(in_oklch,var(--foreground)_40%,transparent)] transition-shadow hover:shadow-[0_18px_36px_-20px_color-mix(in_oklch,var(--foreground)_45%,transparent)] dark:border"
      >
        <div className="flex items-start gap-3">
          <Avatar src={entry.avatarUrl} name={entry.name} email={entry.name} size={56} />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold">{entry.name}</p>
            {entry.headline ? <p className="line-clamp-2 text-sm text-muted-foreground">{entry.headline}</p> : null}
          </div>
        </div>
        {entry.topics.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label={t("topics")}>
            {entry.topics.slice(0, 4).map((topic) => (
              <li key={topic} className="rounded-full bg-highlight px-2.5 py-0.5 text-xs font-medium text-highlight-foreground">
                {topic}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-sm">
          <span className="inline-flex items-center gap-1 font-medium">
            <BadgeCheckIcon className="text-primary" />
            {t("sessions", { count: stats.verifiedSessions })}
          </span>
          <span className="text-muted-foreground">{t("people", { count: stats.peopleReached })}</span>
          {stats.rating !== null ? <span className="text-muted-foreground">{t("rating", { rating: formatScore(stats.rating, locale) })}</span> : null}
          {place ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPinIcon /> {place}
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function pageHref(basePath: string, filters: DirectoryFilters, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  if (page > 1) params.set("pagina", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Lista do diretório com filtros por GET (funciona sem JavaScript). Links mantêm o prefixo de idioma da URL. */
export async function DirectoryView({
  entries,
  filters,
  page,
  basePath,
  fixedTopic,
}: {
  entries: DirectoryEntry[];
  filters: DirectoryFilters;
  page: number;
  basePath: string;
  /** Página de tema: o tema vem da URL e não aparece no formulário. */
  fixedTopic?: string;
}) {
  const [t, tDomain, tCommon, href] = await Promise.all([
    getTranslations("profile.directoryView"),
    getTranslations("domain"),
    getTranslations("common.actions"),
    getPublicHref(),
  ]);
  const base = href(basePath);
  const results = filterDirectory(entries, { ...filters, tema: fixedTopic ?? filters.tema });
  const pages = Math.max(1, Math.ceil(results.length / DIRECTORY_PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = results.slice((current - 1) * DIRECTORY_PAGE_SIZE, current * DIRECTORY_PAGE_SIZE);
  const topics = topTopics(entries, 16);
  const ownFilters: DirectoryFilters = fixedTopic ? { ...filters, tema: undefined } : filters;
  const hasFilters = Object.values(ownFilters).some(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <form method="get" action={base} className="grid gap-3 rounded-md border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
        <div className="grid gap-2 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="q">{tCommon("search")}</Label>
          <Input id="q" name="q" type="search" defaultValue={filters.q} placeholder={t("searchPlaceholder")} maxLength={80} />
        </div>
        {fixedTopic ? null : filters.tema ? <input type="hidden" name="tema" value={filters.tema} /> : null}
        <div className="grid gap-2">
          <Label htmlFor="uf">{t("state")}</Label>
          <Select id="uf" name="uf" defaultValue={filters.uf ?? ""}>
            <option value="">{t("all")}</option>
            {BR_STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="formato">{t("format")}</Label>
          <Select id="formato" name="formato" defaultValue={filters.formato ?? ""}>
            <option value="">{t("all")}</option>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {tDomain(`formats.${f}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="publico">{t("audience")}</Label>
          <Select id="publico" name="publico" defaultValue={filters.publico ?? ""}>
            <option value="">{t("all")}</option>
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {tDomain(`audiences.${a}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit">
            <SearchIcon /> {t("filter")}
          </Button>
          {hasFilters ? (
            <Link href={base} className={buttonVariants({ variant: "ghost" })}>
              {t("clear")}
            </Link>
          ) : null}
        </div>
      </form>

      {topics.length > 0 ? (
        <nav aria-label={t("topics")} className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("topicsLabel")}</span>
          {topics.map((topic) => {
            const active = (fixedTopic ?? filters.tema) === topic.key;
            return (
              <Link
                key={topic.key}
                href={href(`/palestrantes/tema/${topic.key}`)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm",
                  active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {topic.label}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("count", { count: results.length })}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={
            entries.length === 0
              ? t("emptyNew")
              : t("emptyFiltered")
          }
          action={
            hasFilters || fixedTopic ? (
              <Link href={href("/palestrantes")} className={buttonVariants({ variant: "outline" })}>
                {t("seeAll")}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((e) => (
            <SpeakerCard key={e.slug} entry={e} href={href(`/p/${e.slug}`)} />
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label={t("pages")} className="flex items-center justify-center gap-2">
          {current > 1 ? (
            <Link href={pageHref(base, ownFilters, current - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {tCommon("previous")}
            </Link>
          ) : null}
          <span className="text-sm text-muted-foreground">
            {t("pageOf", { current, pages })}
          </span>
          {current < pages ? (
            <Link href={pageHref(base, ownFilters, current + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("next")}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
