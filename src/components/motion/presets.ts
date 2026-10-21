import type { Transition } from "motion/react";

// Movimento do PulseStage (Motion, motion.dev). O movimento explica uma mudança de estado: a pergunta que
// chega, o toque registrado, o resultado que cresce, quem subiu no ranking. Loop só na espera (o avatar
// respirando no celular); nada de enfeite.

/** Molas: `snappy` para toques e selos, `soft` para entrar e trocar de tela, `bar` para barras de resultado. */
export const SPRING = {
  snappy: { type: "spring", stiffness: 520, damping: 30, mass: 0.7 },
  soft: { type: "spring", stiffness: 260, damping: 30 },
  bar: { type: "spring", stiffness: 110, damping: 20, mass: 0.9 },
} as const satisfies Record<string, Transition>;

/** Mesma curva de `--ease-out` em globals.css. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Atraso entre itens de uma lista que entra (alternativas, linhas do ranking). */
export const STAGGER_S = 0.045;

/** Entrada e saída de tela (celular e telão): sobe um pouco e aparece. */
export const SCREEN = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: SPRING.soft },
  exit: { opacity: 0, y: -10, transition: { duration: 0.14, ease: "easeIn" } },
} as const;

/** Toque: o botão afunda de leve. */
export const TAP = { scale: 0.96 } as const;
