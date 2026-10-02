import { z } from "zod";

// Saída esperada do modelo. Tudo é validado: nunca confiar no JSON retornado.

const text = (max: number) => z.string().trim().min(1).max(max);

const findingSchema = z.object({
  title: text(120),
  description: text(800),
  evidence: z.array(text(300)).min(1).max(6),
});

export const insightOutputSchema = z.object({
  summary: text(1200),
  data_quality: z.object({
    confidence: z.enum(["low", "medium", "high"]),
    note: text(500),
  }),
  strengths: z.array(findingSchema).max(5),
  attention_points: z.array(findingSchema).max(5),
  recommendations: z
    .array(
      z.object({
        title: text(120),
        description: text(800),
        priority: z.enum(["low", "medium", "high"]),
      }),
    )
    .max(5),
});

export type InsightOutput = z.infer<typeof insightOutputSchema>;
