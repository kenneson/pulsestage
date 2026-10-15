"use client";

import { useEffect, useRef } from "react";

/** Campo escondido com o fuso do navegador (preenchido depois da hidratação: o servidor não sabe o fuso). */
export function TimeZoneInput() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  }, []);
  return <input ref={ref} type="hidden" name="timeZone" defaultValue="" />;
}
