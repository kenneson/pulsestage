# PulseStage — instruções para o Claude Code

## Leia primeiro
- Especificação completa: `docs/PROMPT.md`. A **seção 0** registra decisões técnicas que prevalecem sobre o resto do documento.
- Banco: `supabase/migrations/`. A migration inicial é a fonte da verdade do schema. Nunca edite uma migration já aplicada; crie uma nova.

## Status
- Código do MVP **escrito sem instalar dependências nem compilar** (o ambiente de criação não tinha rede).
  Já validado: testes dos módulos puros (`npm test`) e uma checagem de tipos interna com stubs das libs.
- **Primeira tarefa:** `npm install`, depois `npx tsc --noEmit`, `npm run lint` e `npm run build`, corrigindo
  o que aparecer. Pontos mais prováveis de ajuste:
  - versões das libs (Next 16, zod 4, recharts 3, @supabase/ssr 0.7): confirme a API de cada uma;
  - `src/proxy.ts` é a convenção do Next 16. Em Next 15, renomeie para `src/middleware.ts` com função `middleware`;
  - regras novas do `eslint-plugin-react-hooks` (ex.: setState durante render no `control-room.tsx`);
  - `src/lib/supabase/database.types.ts` foi escrito à mão: substitua por `npm run db:types` após ligar o projeto.
- Depois: aplicar migrations + seed num Supabase de teste e rodar o fluxo ponta a ponta (seção "Teste manual" do README).

## Mapa do código
- `src/lib/domain/` regras puras (status, interações, palavras, resultados, métricas). Sem I/O.
- `src/lib/data/` leituras no servidor. `sessions.ts`/`analytics.ts` usam o cliente do speaker (RLS);
  `public.ts` usa a secret key e devolve só dados sanitizados.
- `src/features/*/actions.ts` Server Actions (toda escrita passa por aqui).
- `src/lib/realtime/` hooks de realtime (trocar Postgres Changes por Broadcast só mexe aqui).
- `src/lib/ai/` abstração `AIProvider` (Groq/OpenAI/Anthropic via fetch, saída validada com Zod).
- `src/components/ui/` componentes no estilo shadcn/ui escritos à mão (sem Radix); ícones em `components/icons.tsx`.

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
