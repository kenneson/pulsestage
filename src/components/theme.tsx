"use client";

import { useState, useSyncExternalStore } from "react";
import { Toaster } from "sonner";
import { MonitorIcon, MoonIcon, SunIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

// A classe `dark` no <html> é a fonte da verdade: aplicada antes da pintura pelo script do layout
// raiz (preferência salva ou do sistema) e alterada aqui pelo toggle.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function useIsDark() {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

export function ThemeToggle() {
  const dark = useIsDark();
  const label = dark ? "Usar tema claro" : "Usar tema escuro";

  function toggle() {
    document.documentElement.classList.toggle("dark", !dark);
    try {
      localStorage.setItem("theme", dark ? "light" : "dark");
    } catch {
      // armazenamento bloqueado (aba anônima): o tema vale só até recarregar
    }
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={label} title={label}>
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}

export function ThemedToaster() {
  const dark = useIsDark();
  return <Toaster position="top-center" richColors theme={dark ? "dark" : "light"} />;
}

type ThemeChoiceValue = "light" | "dark" | "system";

function readChoice(): ThemeChoiceValue {
  try {
    const saved = localStorage.getItem("theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

/** Claro, escuro ou seguir o sistema (preferência deste navegador). */
export function ThemeChoice() {
  // Re-renderiza quando o toggle da barra lateral muda a classe do <html>.
  useIsDark();
  const choice = useSyncExternalStore(subscribe, readChoice, () => "system" as ThemeChoiceValue);
  // "Sistema" pode não mudar a classe do <html>: força a releitura da escolha salva.
  const [, rerender] = useState(0);

  function choose(next: ThemeChoiceValue) {
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      // armazenamento bloqueado: aplica só nesta aba
    }
    const dark = next === "dark" || (next === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    rerender((n) => n + 1);
  }

  const options: { value: ThemeChoiceValue; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Claro", icon: <SunIcon /> },
    { value: "dark", label: "Escuro", icon: <MoonIcon /> },
    { value: "system", label: "Sistema", icon: <MonitorIcon /> },
  ];

  return (
    <div role="radiogroup" aria-label="Tema" className="inline-flex w-fit overflow-hidden rounded-md border">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={choice === o.value}
          onClick={() => choose(o.value)}
          className={
            choice === o.value
              ? "inline-flex min-h-10 items-center gap-2 bg-foreground px-3.5 text-sm font-medium text-background"
              : "inline-flex min-h-10 items-center gap-2 px-3.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          }
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
