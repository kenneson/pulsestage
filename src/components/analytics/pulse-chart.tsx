"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PulsePoint } from "@/lib/domain/metrics";

export function PulseChart({ points }: { points: PulsePoint[] }) {
  const data = points.map((p, index) => ({
    label: p.minute !== null ? `${p.minute} min` : `#${index + 1}`,
    title: p.title,
    rate: p.rate === null ? null : Math.round(p.rate * 100),
    responses: p.responses,
    eligible: p.eligible,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
          <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
          <Tooltip
            content={({ active, payload }) => {
              const item = active ? payload?.[0]?.payload : undefined;
              if (!item) return null;
              const d = item as (typeof data)[number];
              return (
                <div className="max-w-64 rounded-md border bg-background px-3 py-2 text-xs shadow-md">
                  <p className="font-medium">{d.title}</p>
                  <p className="text-muted-foreground">
                    {d.rate ?? "—"}% · {d.responses} de {d.eligible} presentes
                  </p>
                </div>
              );
            }}
          />
          <Line type="monotone" dataKey="rate" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
