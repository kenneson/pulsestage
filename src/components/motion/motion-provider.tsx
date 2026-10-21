"use client";

import { domMax, LazyMotion, MotionConfig } from "motion/react";
import { SPRING } from "./presets";

/**
 * Liga o Motion numa área (celular, telão, painel). Os componentes usam `m.*` (de `motion/react-m`):
 * fora deste provider eles só renderizam, sem animar (a análise e o relatório ficam estáticos).
 * `domMax` vem junto do bundle (sem chunk extra que, numa rede ruim, deixaria conteúdo invisível) e inclui
 * as animações de layout (ranking, listas que reordenam). `reducedMotion="user"`: com "reduzir movimento"
 * ligado no sistema, transformações e layout viram troca direta; opacidade e cor continuam.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={SPRING.soft}>
      <LazyMotion features={domMax} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
