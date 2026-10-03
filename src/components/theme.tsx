"use client";

import { useSyncExternalStore } from "react";
import { Toaster } from "sonner";
import { MoonIcon, SunIcon } from "@/components/icons";
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
