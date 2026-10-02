"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type EvolutionPoint = {
  label: string;
  clarity: number | null;
  engagement: number | null;
  content: number | null;
  applicability: number | null;
};

const SERIES = [
  { key: "clarity", name: "Clareza", color: "#4f46e5" },
  { key: "engagement", name: "Engajamento", color: "#0891b2" },
  { key: "content", name: "Conteúdo", color: "#16a34a" },
  { key: "applicability", name: "Aplicabilidade", color: "#d97706" },
] as const;

export function EvolutionChart({ points }: { points: EvolutionPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
          <YAxis domain={[1, 5]} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
          <Tooltip formatter={(value) => (typeof value === "number" ? value.toFixed(1).replace(".", ",") : "—")} />
          <Legend />
          {SERIES.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
