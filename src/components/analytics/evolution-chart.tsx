"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Uma linha por sessão: rótulo do eixo X + média de cada dimensão (1–5) ou null. */
export type EvolutionPoint = { label: string } & Record<string, number | string | null>;
export type EvolutionSeries = { key: string; name: string };

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export function EvolutionChart({ points, series }: { points: EvolutionPoint[]; series: EvolutionSeries[] }) {
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
          {series.map((s, index) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
