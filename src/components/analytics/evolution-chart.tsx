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
  { key: "clarity", name: "Clareza", color: "var(--chart-1)" },
  { key: "engagement", name: "Engajamento", color: "var(--chart-2)" },
  { key: "content", name: "Conteúdo", color: "var(--chart-3)" },
  { key: "applicability", name: "Aplicabilidade", color: "var(--chart-4)" },
] as const;

export function EvolutionChart({ points }: { points: EvolutionPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
          <YAxis domain={[1, 5]} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
          <Tooltip
            contentStyle={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--card-foreground)" }}
            formatter={(value) => (typeof value === "number" ? value.toFixed(1).replace(".", ",") : "—")}
          />
          <Legend />
          {SERIES.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
