# PulseStage

> Seu público fala. Você entende. Sua próxima palestra fica melhor.

Plataforma de interação em tempo real para palestrantes, professores e facilitadores: enquetes, quizzes, nuvem de palavras e perguntas abertas durante a apresentação, feedback depois dela e insights gerados por IA para melhorar a próxima.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Postgres, Auth, Realtime) · Zod · Vercel

## Estado atual

| Fase | Status |
| --- | --- |
| 0 — Especificação e schema do banco | ✅ concluída |
| 1 — Setup do projeto Next.js | ⏳ próxima |
| 2 a 13 | pendentes |

A especificação completa está em [`docs/PROMPT.md`](docs/PROMPT.md). O schema do banco, com RLS e triggers, está em [`supabase/migrations/`](supabase/migrations/).

## Como continuar o desenvolvimento

1. Clone o repositório e abra a pasta no Claude Code.
2. Crie um projeto no Supabase e copie `.env.example` para `.env.local`, preenchendo as chaves.
3. Peça ao Claude Code: *"Leia o CLAUDE.md e comece pela Fase 1."*

## Variáveis de ambiente

Veja [`.env.example`](.env.example). Nunca faça commit de `.env.local`.
