"use client";

import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  savePublicProfileAction,
  setSessionListedAction,
  type PublicProfileFormState,
  type PublicProfileFormValues,
} from "@/features/speaker-profile/actions";
import { AUDIENCES, BR_STATES, FORMATS, MAX_TOPICS } from "@/lib/domain/speaker-profile";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { BadgeCheckIcon, CheckIcon, CopyIcon, ExternalIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const initial: PublicProfileFormState = {};

function Toggle({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 accent-primary" />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function CheckGroup<T extends string>({
  legend,
  name,
  options,
  labels,
  selected,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  labels: Record<T, string>;
  selected: readonly string[];
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option}
            className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10"
          >
            <input type="checkbox" name={name} value={option} defaultChecked={selected.includes(option)} className="size-4 accent-primary" />
            {labels[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PublicProfileForm({ initialValues, profileUrlBase }: { initialValues: PublicProfileFormValues; profileUrlBase: string }) {
  const t = useTranslations("profile.form");
  const tDomain = useTranslations("domain");
  const tCommon = useTranslations("common.actions");
  const [state, action, pending] = useActionState(savePublicProfileAction, initial);
  const v = state.values ?? initialValues;
  const formatLabels = Object.fromEntries(FORMATS.map((f) => [f, tDomain(`formats.${f}`)])) as Record<(typeof FORMATS)[number], string>;
  const audienceLabels = Object.fromEntries(AUDIENCES.map((a) => [a, tDomain(`audiences.${a}`)])) as Record<
    (typeof AUDIENCES)[number],
    string
  >;

  useEffect(() => {
    if (state.success) toast.success(state.success);
  }, [state]);

  return (
    <form action={action} className="grid gap-6">
      <Toggle
        name="publicEnabled"
        label={t("publish")}
        description={t("publishHint")}
        defaultChecked={v.publicEnabled}
      />

      <Field>
        <Label htmlFor="slug">{t("slug")}</Label>
        <div className="flex items-center overflow-hidden rounded-md border border-input focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40">
          <span className="shrink-0 bg-muted px-3 py-2 text-sm text-muted-foreground">{profileUrlBase}/p/</span>
          <input
            id="slug"
            name="slug"
            required
            minLength={3}
            maxLength={40}
            pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]"
            defaultValue={v.slug}
            className="h-10 min-w-0 flex-1 bg-transparent px-2 text-base outline-none md:text-sm"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {t("slugHint")}
        </p>
      </Field>

      <Field>
        <Label htmlFor="headline">{t("headline")}</Label>
        <Input
          id="headline"
          name="headline"
          maxLength={120}
          defaultValue={v.headline}
          placeholder={t("headlinePlaceholder")}
        />
      </Field>

      <Field>
        <Label htmlFor="topics">{t("topics")}</Label>
        <Input
          id="topics"
          name="topics"
          defaultValue={v.topics}
          placeholder={t("topicsPlaceholder")}
        />
        <p className="text-xs text-muted-foreground">{t("topicsHint", { max: MAX_TOPICS })}</p>
      </Field>

      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field>
          <Label htmlFor="city">{t("city")}</Label>
          <Input id="city" name="city" maxLength={80} defaultValue={v.city} autoComplete="address-level2" />
        </Field>
        <Field>
          <Label htmlFor="state">{t("state")}</Label>
          <Select id="state" name="state" defaultValue={v.state}>
            <option value="">—</option>
            {BR_STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <CheckGroup legend={t("formats")} name="formats" options={FORMATS} labels={formatLabels} selected={v.formats} />
      <CheckGroup legend={t("audiences")} name="audiences" options={AUDIENCES} labels={audienceLabels} selected={v.audiences} />

      <Field>
        <Label htmlFor="experience">{t("experience")}</Label>
        <Textarea
          id="experience"
          name="experience"
          maxLength={600}
          defaultValue={v.experience}
          placeholder={t("experiencePlaceholder")}
        />
        <p className="text-xs text-muted-foreground">
          {t("experienceHint")}
        </p>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="websiteUrl">{t("website")}</Label>
          <Input id="websiteUrl" name="websiteUrl" maxLength={200} defaultValue={v.websiteUrl} placeholder={t("websitePlaceholder")} inputMode="url" />
        </Field>
        <Field>
          <Label htmlFor="linkedinUrl">LinkedIn</Label>
          <Input
            id="linkedinUrl"
            name="linkedinUrl"
            maxLength={200}
            defaultValue={v.linkedinUrl}
            placeholder={t("linkedinPlaceholder")}
            inputMode="url"
          />
        </Field>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium">{t("options")}</p>
        <Toggle
          name="contactEnabled"
          label={t("contactEnabled")}
          description={t("contactEnabledHint")}
          defaultChecked={v.contactEnabled}
        />
        <Toggle
          name="showRatings"
          label={t("showRatings")}
          description={t("showRatingsHint")}
          defaultChecked={v.showRatings}
        />
        <Toggle
          name="promoteOnSurvey"
          label={t("promoteOnSurvey")}
          description={t("promoteOnSurveyHint")}
          defaultChecked={v.promoteOnSurvey}
        />
      </div>

      {state.error ? <Alert>{state.error}</Alert> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? tCommon("saving") : t("submit")}
        </Button>
      </div>
    </form>
  );
}

export function ShareProfileLink({ url }: { url: string }) {
  const t = useTranslations("profile.share");
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 text-sm">{url}</code>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            toast.error(t("copyFailed"));
          }
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />} {copied ? t("copied") : t("copyLink")}
      </Button>
      <Link href={url} target="_blank" className="inline-flex min-h-9 items-center gap-1.5 px-2 text-sm font-medium text-primary hover:underline">
        {t("open")} <ExternalIcon />
      </Link>
    </div>
  );
}

export type SessionVisibilityItem = {
  id: string;
  title: string;
  date: string;
  audience: string;
  rating: string | null;
  listed: boolean;
  verified: boolean;
  reason: string | null;
};

/** Sessões encerradas: escolher quais aparecem no perfil e ver se cada uma conta como verificada. */
export function SessionVisibilityList({ sessions }: { sessions: SessionVisibilityItem[] }) {
  const t = useTranslations("profile.sessions");
  const [optimistic, setListed] = useOptimistic(
    sessions,
    (list, change: { id: string; listed: boolean }) => list.map((s) => (s.id === change.id ? { ...s, listed: change.listed } : s)),
  );
  const [, startTransition] = useTransition();

  return (
    <ul className="divide-y rounded-md border">
      {optimistic.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <label className={cn("flex min-w-0 flex-1 items-start gap-3", s.verified ? "cursor-pointer" : "cursor-default")}>
            <input
              type="checkbox"
              checked={s.listed && s.verified}
              disabled={!s.verified}
              className="mt-1 size-4 accent-primary disabled:opacity-40"
              aria-label={t("showOnProfile", { title: s.title })}
              onChange={(e) => {
                const listed = e.target.checked;
                startTransition(async () => {
                  setListed({ id: s.id, listed });
                  const result = await setSessionListedAction(s.id, listed);
                  if (!result.ok) toast.error(result.error);
                });
              }}
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-medium">{s.title}</span>
              <span className="text-xs text-muted-foreground">
                {s.date} · {s.audience}
                {s.rating ? ` · ${t("rating", { rating: s.rating })}` : ""}
              </span>
              {s.reason ? <span className="text-xs text-muted-foreground">{s.reason}</span> : null}
            </span>
          </label>
          {s.verified ? (
            <Badge variant="secondary" className="gap-1">
              <BadgeCheckIcon className="text-primary" /> {t("verified")}
            </Badge>
          ) : (
            <Badge variant="outline">{t("notCounted")}</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
