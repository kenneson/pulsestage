"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { Logo } from "@/components/logo";
import { isUuid } from "@/lib/action-result";
import { normalizeJoinCode } from "@/lib/domain/session";

// Suplemento de conteúdo: escolhe a sessão pelo código e mostra o telão dela dentro do slide.
// A escolha fica nas configurações do próprio suplemento no arquivo (Office.context.document.settings):
// ao abrir a apresentação de novo, o slide já mostra o telão daquela sessão.

const OFFICE_JS = "https://appsforoffice.microsoft.com/lib/1/hosted/office.js";
const SETTING = "pulsestageSessionId";

type OfficeSettings = {
  get(name: string): unknown;
  set(name: string, value: unknown): void;
  remove(name: string): void;
  saveAsync(callback?: () => void): void;
};
type OfficeGlobal = {
  onReady(callback?: (info: { host: string | null }) => void): Promise<{ host: string | null }>;
  context?: { document?: { settings?: OfficeSettings } };
};

function officeSettings(): OfficeSettings | null {
  const office = (window as unknown as { Office?: OfficeGlobal }).Office;
  return office?.context?.document?.settings ?? null;
}

/** Carrega o office.js uma vez. Ele apaga history.pushState/replaceState em alguns hosts: devolvemos os originais. */
function loadOffice(): Promise<OfficeGlobal | null> {
  return new Promise((resolve) => {
    const existing = (window as unknown as { Office?: OfficeGlobal }).Office;
    if (existing) return resolve(existing);
    const { pushState, replaceState } = window.history;
    const script = document.createElement("script");
    script.src = OFFICE_JS;
    script.async = true;
    const done = (office: OfficeGlobal | null) => {
      window.history.pushState = pushState;
      window.history.replaceState = replaceState;
      resolve(office);
    };
    script.onload = () => {
      const office = (window as unknown as { Office?: OfficeGlobal }).Office ?? null;
      if (!office) return done(null);
      // Fora do Office, onReady resolve logo com host null.
      office.onReady().then(() => done(office), () => done(null));
    };
    script.onerror = () => done(null);
    document.head.appendChild(script);
  });
}

/** Aceita o código (ex.: "KX4P2M") ou o link do telão (…/session/<id>/display). */
function sessionIdFromLink(value: string): string | null {
  const match = /\/session\/([0-9a-f-]{36})\/display/i.exec(value);
  return match && isUuid(match[1]) ? match[1]! : null;
}

export function OfficeAddin({ initialSessionId }: { initialSessionId: string | null }) {
  const t = useTranslations("integrations.office.addin");
  const [ready, setReady] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId && isUuid(initialSessionId) ? initialSessionId : null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    loadOffice().then(() => {
      if (!alive) return;
      const saved = officeSettings()?.get(SETTING);
      if (typeof saved === "string" && isUuid(saved)) setSessionId((current) => current ?? saved);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const choose = (id: string | null) => {
    const settings = officeSettings();
    if (settings) {
      if (id) settings.set(SETTING, id);
      else settings.remove(SETTING);
      settings.saveAsync();
    }
    setSessionId(id);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const fromLink = sessionIdFromLink(code);
    if (fromLink) return choose(fromLink);
    const normalized = normalizeJoinCode(code);
    if (!normalized) {
      setError(t("errors.empty"));
      inputRef.current?.focus();
      return;
    }
    setChecking(true);
    try {
      const res = await fetch(`/office/session?code=${encodeURIComponent(normalized)}`, { cache: "no-store" });
      if (res.status === 429) setError(t("errors.tooMany"));
      else if (!res.ok) setError(t("errors.notFound"));
      else {
        const body: unknown = await res.json();
        const id = typeof body === "object" && body !== null && "id" in body ? (body as { id: unknown }).id : null;
        if (typeof id === "string" && isUuid(id)) choose(id);
        else setError(t("errors.notFound"));
      }
    } catch {
      setError(t("errors.network"));
    } finally {
      setChecking(false);
    }
  };

  if (sessionId) {
    return (
      <div className="group relative h-dvh w-full overflow-hidden bg-[#0d1324]">
        <iframe
          src={`/session/${sessionId}/display`}
          title={t("frameTitle")}
          className="size-full border-0"
          allow="autoplay; fullscreen"
        />
        {/* Some na apresentação; aparece ao passar o mouse ou com o foco do teclado. */}
        <button
          type="button"
          onClick={() => choose(null)}
          className="absolute right-2 top-2 rounded-md bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          {t("change")}
        </button>
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-6">
      <Logo href={null} />
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Label htmlFor="office-code">{t("codeLabel")}</Label>
        <Input
          ref={inputRef}
          id="office-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("codePlaceholder")}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="font-display text-lg tracking-widest"
        />
        {error ? <Alert>{error}</Alert> : null}
        <Button type="submit" disabled={checking || !ready}>
          {checking ? t("checking") : t("show")}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </main>
  );
}
