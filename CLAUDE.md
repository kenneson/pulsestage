# PulseStage — instruções para o Claude Code

## Leia primeiro
- Especificação completa: `docs/PROMPT.md`. A **seção 0** registra decisões técnicas que prevalecem sobre o resto do documento.
- Banco: `supabase/migrations/`. A migration inicial é a fonte da verdade do schema. Nunca edite uma migration já aplicada; crie uma nova.

## Status
- Fase 0 (especificação + schema) concluída.
- Próxima: **Fase 1 — Setup**. Ao rodar `create-next-app`, preserve `docs/`, `supabase/`, `CLAUDE.md`, `README.md`, `.env.example` e `.gitignore`.

## Regras inegociáveis
- TypeScript estrito, sem `any`. Zod em toda entrada (formulários, Server Actions, Route Handlers, saída da IA).
- Participantes não usam Supabase Auth e nunca escrevem direto no banco: tudo passa pelo servidor após validar o cookie assinado (seção 0.1).
- Secret key do Supabase só em módulos com `import "server-only"`.
- Realtime público só lê `session_live_state` e `interaction_results` (seção 0.2).
- Quiz e word cloud: cálculo no servidor (seção 0.3).
- Regras de negócio fora dos componentes de UI.

## Validação antes de fechar cada fase
```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Ao final de cada fase
1. Relatório no formato da seção 61 do `docs/PROMPT.md`.
2. Atualize a tabela de status no `README.md` e a seção "Status" deste arquivo.
3. Commit em Conventional Commits (português) e push.
