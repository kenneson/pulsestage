"use client";

import { useEffect, useState } from "react";
import { audioReady, unlockAudio } from "./sound";

/** Libera o som no primeiro clique, toque ou tecla na página (regra de autoplay dos navegadores). */
export function useAudioUnlock(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      window.setTimeout(() => setReady(audioReady()), 60);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  return ready;
}
