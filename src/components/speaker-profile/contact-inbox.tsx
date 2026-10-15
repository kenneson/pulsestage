"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { deleteContactAction, updateContactAction } from "@/features/speaker-profile/actions";
import { ORG_KINDS, type OrgKind } from "@/lib/domain/speaker-profile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ArchiveIcon, MailIcon, TrashIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export type InboxItem = {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  orgKind: string | null;
  message: string;
  eventDate: string | null;
  eventCity: string | null;
  receivedAt: string;
  read: boolean;
  archived: boolean;
};

type Change = { id: string; read?: boolean; archived?: boolean; removed?: boolean };

const isOrgKind = (v: string | null): v is OrgKind => v !== null && (ORG_KINDS as readonly string[]).includes(v);

/** Convites recebidos pelo perfil público: abrir marca como lido; arquivar e excluir. */
export function ContactInbox({ items }: { items: InboxItem[] }) {
  const t = useTranslations("profile.invites");
  const tDomain = useTranslations("domain");
  const tCommon = useTranslations("common.actions");
  const [view, setView] = useState<"inbox" | "archived">("inbox");
  const [openId, setOpenId] = useState<string | null>(null);
  const [list, apply] = useOptimistic(items, (current, change: Change) =>
    change.removed
      ? current.filter((i) => i.id !== change.id)
      : current.map((i) =>
          i.id === change.id
            ? { ...i, read: change.read ?? i.read, archived: change.archived ?? i.archived }
            : i,
        ),
  );
  const [, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();

  const run = (change: Change, task: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      apply(change);
      const result = await task();
      if (!result.ok && result.error) toast.error(result.error);
    });

  const visible = list.filter((i) => (view === "archived" ? i.archived : !i.archived));
  const archivedCount = list.filter((i) => i.archived).length;

  return (
    <div className="flex flex-col gap-4">
      {confirmDialog}
      <div role="tablist" aria-label={t("folders")} className="flex gap-1 border-b">
        {(
          [
            ["inbox", t("inbox", { count: list.length - archivedCount })],
            ["archived", t("archived", { count: archivedCount })],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={cn(
              "min-h-11 border-b-2 px-3 text-sm font-medium",
              view === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={view === "archived" ? t("emptyArchived") : t("emptyInbox")}
          description={view === "archived" ? undefined : t("emptyInboxHint")}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((item) => {
            const open = openId === item.id;
            return (
              <li key={item.id} className={cn("rounded-md border bg-card", !item.read && "border-primary/40")}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => {
                    setOpenId(open ? null : item.id);
                    if (!item.read) run({ id: item.id, read: true }, () => updateContactAction({ id: item.id, read: true }));
                  }}
                  className="flex w-full flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3 text-left"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      {!item.read ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-label={t("unread")} /> : null}
                      <span className={cn("truncate", !item.read && "font-semibold")}>{item.name}</span>
                      {item.organization ? <span className="truncate text-sm text-muted-foreground">· {item.organization}</span> : null}
                    </span>
                    <span className={cn("text-sm text-muted-foreground", !open && "line-clamp-1")}>{item.message}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{item.receivedAt}</span>
                </button>
                {open ? (
                  <div className="flex flex-col gap-3 border-t px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {isOrgKind(item.orgKind) ? <Badge variant="secondary">{tDomain(`orgKinds.${item.orgKind}`)}</Badge> : null}
                      {item.eventDate ? <Badge variant="outline">{t("eventDate", { date: item.eventDate })}</Badge> : null}
                      {item.eventCity ? <Badge variant="outline">{item.eventCity}</Badge> : null}
                    </div>
                    <p className="whitespace-pre-line break-words text-sm">{item.message}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`mailto:${item.email}?subject=${encodeURIComponent(t("replySubject"))}`}
                        className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        <MailIcon /> {t("reply", { email: item.email })}
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          run({ id: item.id, archived: !item.archived }, () =>
                            updateContactAction({ id: item.id, archived: !item.archived }),
                          )
                        }
                      >
                        <ArchiveIcon /> {item.archived ? t("unarchive") : t("archive")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          run({ id: item.id, read: false }, () => updateContactAction({ id: item.id, read: false }))
                        }
                      >
                        {t("markUnread")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={async () => {
                          const ok = await confirm({
                            title: t("deleteTitle", { name: item.name }),
                            description: t("deleteDescription"),
                            confirmLabel: tCommon("delete"),
                            destructive: true,
                          });
                          if (ok) run({ id: item.id, removed: true }, () => deleteContactAction(item.id));
                        }}
                      >
                        <TrashIcon /> {tCommon("delete")}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
