# PulseStage

> Seu público fala. Você entende. Sua próxima palestra fica melhor.

Interação em tempo real para palestrantes (enquete, escala, nuvem de palavras, pergunta aberta e quiz),
com tela de projetor, feedback pós-evento, analytics, evolução entre sessões e insights com IA.

**Stack:** Next.js (App Router) · TypeScript estrito · Tailwind v4 · componentes estilo shadcn/ui ·
Supabase (Auth, Postgres, RLS, Realtime) · Zod · Recharts · Vercel.

> ⚠️ Dependências instaladas e `tsc`/`lint`/`build` passando, mas o fluxo ainda não foi testado contra um
> Supabase real (veja "Teste manual" e `CLAUDE.md`).

## Rodando localmente

1. **Dependências:** `npm install`
2. **Supabase:** crie um projeto em supabase.com (ou use `npx supabase start` com Docker).
3. **Banco:** aplique as migrations de `supabase/migrations/` em ordem
   (`npx supabase db push` com o projeto linkado, ou cole no SQL Editor).
   Opcional: rode `supabase/seed.sql` para dados de demonstração
   (login `demo@pulsestage.app` / `demo123456`, duas sessões encerradas e um rascunho).
4. **Variáveis:** copie `.env.example` para `.env.local` e preencha.
   Gere o segredo do participante com `openssl rand -base64 48`.
5. **Realtime:** confirme em *Realtime → Settings* que o acesso público a canais está permitido
   (Presence dos participantes usa a publishable key).
6. **Auth:** em *Authentication → URL Configuration*, adicione `http://localhost:3000/**`
   e `https://SEU-APP.vercel.app/**` às Redirect URLs. Sem isso, o retorno do login cai no Site URL e falha.
   - **Login com Google (opcional):** no Google Cloud, crie um ID do cliente OAuth (Aplicativo da Web) com a URI
     de redirecionamento `https://<projeto>.supabase.co/auth/v1/callback`. Cole o Client ID e o Client Secret em
     *Authentication → Sign In / Providers → Google* no Supabase. Nenhuma variável de ambiente é necessária.
7. `npm run dev` → http://localhost:3000

Tipos do banco: depois de linkar o projeto, `npm run db:types` substitui o arquivo escrito à mão.

## Teste manual (ponta a ponta)

1. Crie uma conta, crie uma sessão e adicione uma interação de cada tipo (use o ícone de olho para pré-visualizar).
2. Clique em **Iniciar sessão** → sala ao vivo. Abra **Tela do projetor** em outra aba.
3. Num celular (ou janela anônima), acesse o QR/código, entre e responda. Os resultados devem aparecer
   no projetor e na sala sem recarregar.
4. Teste: responder duas vezes, quiz com tempo esgotado, pausar/retomar, encerrar a interação.
5. **Encerrar sessão** → o celular e o projetor mostram o link de avaliação. Envie alguns feedbacks.
6. Abra o analytics da sessão e, com `AI_PROVIDER`/`AI_API_KEY` configurados, gere os insights.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run lint` | ESLint (flat config do Next) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | testes unitários dos módulos puros (`node --test`) |
| `npm run db:types` | gera `database.types.ts` a partir do Supabase linkado |

## Arquitetura em uma página

- **Participantes não têm conta.** Entram por `/join/[código]`; o servidor cria o registro e grava um cookie
  HTTP-only assinado (HMAC). Toda resposta passa por Server Action, que valida o cookie e calcula acerto,
  pontos, tempo do quiz e normalização da nuvem de palavras. O papel `anon` não escreve em nada.
- **Realtime público** lê só `session_live_state` e `interaction_results`, mantidas por triggers.
  "Conectados agora" vem do Presence e é apenas informativo.
- **RLS** garante que o speaker só vê as próprias sessões.
- **LGPD:** contato do participante fica em `participant_contacts`, separado e com consentimento.
  A IA recebe só dados agregados, sem nomes ou contatos.
- **Métricas:** “sinal de participação” = respostas ÷ participantes presentes em cada interação.
  Mede participação, não atenção.

## Status

| Fase | Situação |
|---|---|
| Especificação e schema | ✅ |
| Código do MVP (auth, sessões, builder, ao vivo, projetor, participante, feedback, analytics, evolução, IA) | ✅ compila (tsc, lint, build), ⏳ falta teste ponta a ponta |
| Tema escuro (toggle claro/escuro, segue o sistema por padrão) | ✅ |
| Polimento: loading/skeletons, diálogos de confirmação, página `/privacidade` | ✅ |
| Login e cadastro com Google | ✅ |
| Testes unitários do domínio (sessão, palavras, datas, resultados, métricas) | ✅ |
| Testes de integração e E2E | ⏳ |
| Deploy na Vercel | ✅ |

Especificação completa em `docs/PROMPT.md`.
