"use client";

import { useEffect } from "react";
import { animate, AnimatePresence, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import * as m from "motion/react-m";
import type { Locale } from "@/lib/domain/locale";
import { formatInt, formatPercent, formatScore } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE_OUT, SPRING } from "./presets";

type NumberFormat = "int" | "percent" | "score";

function formatAs(format: NumberFormat, value: number, locale: Locale): string {
  if (format === "percent") return formatPercent(value);
  if (format === "score") return formatScore(Math.round(value * 10) / 10, locale);
  return formatInt(Math.round(value), locale);
}

/**
 * Número que conta até o valor novo (percentual, pontos, média). `from` é de onde começa ao montar
 * (padrão: o próprio valor, sem animar). Com movimento reduzido, troca direto. `render` monta o texto
 * com o número já arredondado (ex.: `t("points", { points })`); só pode vir de um componente cliente.
 */
export function AnimatedNumber({
  value,
  from,
  format = "int",
  locale,
  duration = 0.9,
  render,
  className,
}: {
  value: number;
  from?: number;
  format?: NumberFormat;
  locale: Locale;
  duration?: number;
  render?: (value: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(from ?? value);
  const text = useTransform(motionValue, (v) => (render ? render(Math.round(v)) : formatAs(format, v, locale)));

  useEffect(() => {
    if (reduce) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration, ease: EASE_OUT });
    return () => controls.stop();
  }, [motionValue, value, duration, reduce]);

  return <m.span className={cn("tabular-nums", className)}>{text}</m.span>;
}

/** Preenchimento de barra de resultado: cresce do zero ao aparecer e acompanha cada voto com uma mola. */
export function AnimatedBarFill({ pct, className, delay = 0 }: { pct: number; className?: string; delay?: number }) {
  return (
    <m.div
      className={cn("h-full rounded-full", className)}
      initial={{ width: "0%" }}
      animate={{ width: `${Math.round(pct * 100)}%` }}
      transition={{ ...SPRING.bar, delay }}
    />
  );
}

/**
 * Item de lista que entra, sai e muda de lugar deslizando (ranking que reordena, respostas novas no topo).
 * Use dentro de `AnimatedList`.
 */
export function AnimatedItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <m.li
      layout="position"
      className={className}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={SPRING.soft}
    >
      {children}
    </m.li>
  );
}

/** Lista com entrada e saída de itens (`AnimatedItem`). Os itens que já estavam não animam ao montar. */
export function AnimatedList({ as = "ul", children, className }: { as?: "ul" | "ol"; children: React.ReactNode; className?: string }) {
  const List = as === "ol" ? m.ol : m.ul;
  return (
    <List className={className}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </List>
  );
}

/** Confirmação de resposta: o círculo surge com mola e o ✓ se desenha. */
export function AnimatedCheck({ className }: { className?: string }) {
  return (
    <m.span
      className={cn("grid size-14 place-items-center rounded-full bg-primary/15 text-primary", className)}
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={SPRING.snappy}
    >
      <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <m.path
          d="M20 6L9 17l-5-5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.12 }}
        />
      </svg>
    </m.span>
  );
}
