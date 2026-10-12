import Link from "next/link";
import { formatInt, formatScore } from "@/lib/format";
import {
  AUDIENCE_LABEL,
  AUDIENCES,
  BR_STATES,
  DIRECTORY_PAGE_SIZE,
  filterDirectory,
  FORMAT_LABEL,
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

function SpeakerCard({ entry }: { entry: DirectoryEntry }) {
  const place = [entry.city, entry.state].filter(Boolean).join(" · ");
  const { stats } = entry;
  return (
    <li className="flex">
      <Link
        href={`/p/${entry.slug}`}
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
          <ul className="flex flex-wrap gap-1.5" aria-label="Temas">
            {entry.topics.slice(0, 4).map((t) => (
              <li key={t} className="rounded-full bg-highlight px-2.5 py-0.5 text-xs font-medium text-highlight-foreground">
                {t}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-sm">
          <span className="inline-flex items-center gap-1 font-medium">
            <BadgeCheckIcon className="text-primary" />
            {formatInt(stats.verifiedSessions)} {stats.verifiedSessions === 1 ? "sessão" : "sessões"}
          </span>
          <span className="text-muted-foreground">{formatInt(stats.peopleReached)} pessoas</span>
          {stats.rating !== null ? <span className="text-muted-foreground">nota {formatScore(stats.rating)}</span> : null}
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

/** Lista do diretório com filtros por GET (funciona sem JavaScript). */
export function DirectoryView({
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
  const results = filterDirectory(entries, { ...filters, tema: fixedTopic ?? filters.tema });
  const pages = Math.max(1, Math.ceil(results.length / DIRECTORY_PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = results.slice((current - 1) * DIRECTORY_PAGE_SIZE, current * DIRECTORY_PAGE_SIZE);
  const topics = topTopics(entries, 16);
  const ownFilters: DirectoryFilters = fixedTopic ? { ...filters, tema: undefined } : filters;
  const hasFilters = Object.values(ownFilters).some(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <form method="get" action={basePath} className="grid gap-3 rounded-md border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
        <div className="grid gap-2 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="q">Buscar</Label>
          <Input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Nome, tema ou cidade" maxLength={80} />
        </div>
        {fixedTopic ? null : filters.tema ? <input type="hidden" name="tema" value={filters.tema} /> : null}
        <div className="grid gap-2">
          <Label htmlFor="uf">Estado</Label>
          <Select id="uf" name="uf" defaultValue={filters.uf ?? ""}>
            <option value="">Todos</option>
            {BR_STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="formato">Formato</Label>
          <Select id="formato" name="formato" defaultValue={filters.formato ?? ""}>
            <option value="">Todos</option>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABEL[f]}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="publico">Público</Label>
          <Select id="publico" name="publico" defaultValue={filters.publico ?? ""}>
            <option value="">Todos</option>
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {AUDIENCE_LABEL[a]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit">
            <SearchIcon /> Filtrar
          </Button>
          {hasFilters ? (
            <Link href={basePath} className={buttonVariants({ variant: "ghost" })}>
              Limpar
            </Link>
          ) : null}
        </div>
      </form>

      {topics.length > 0 ? (
        <nav aria-label="Temas" className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Temas:</span>
          {topics.map((t) => {
            const active = (fixedTopic ?? filters.tema) === t.key;
            return (
              <Link
                key={t.key}
                href={`/palestrantes/tema/${t.key}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm",
                  active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {results.length === 1 ? "1 palestrante" : `${formatInt(results.length)} palestrantes`}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          title="Nenhum palestrante encontrado"
          description={
            entries.length === 0
              ? "O diretório está começando. Palestrantes aparecem aqui depois da primeira sessão verificada."
              : "Tente outro tema ou tire algum filtro."
          }
          action={
            hasFilters || fixedTopic ? (
              <Link href="/palestrantes" className={buttonVariants({ variant: "outline" })}>
                Ver todos
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((e) => (
            <SpeakerCard key={e.slug} entry={e} />
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="Páginas" className="flex items-center justify-center gap-2">
          {current > 1 ? (
            <Link href={pageHref(basePath, ownFilters, current - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Anterior
            </Link>
          ) : null}
          <span className="text-sm text-muted-foreground">
            Página {current} de {pages}
          </span>
          {current < pages ? (
            <Link href={pageHref(basePath, ownFilters, current + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Próxima
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
