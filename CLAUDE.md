# PulseStage — instruções para o Claude Code

## Leia primeiro
- Especificação completa: `docs/PROMPT.md`. A **seção 0** registra decisões técnicas que prevalecem sobre o resto do documento.
- Banco: `supabase/migrations/`. A migration inicial é a fonte da verdade do schema. Nunca edite uma migration já aplicada; crie uma nova.

## Status
- Dependências instaladas (Next 16.3); `tsc --noEmit`, `lint`, `build` e `npm test` passam sem ajustes.
- Tema escuro: classe `dark` no `<html>`, aplicada antes da pintura por script no `app/layout.tsx`
  (preferência em `localStorage.theme`, senão a do sistema); toggle e Toaster em `components/theme.tsx`.
  Cores novas devem usar os tokens de `globals.css` (inclui `--chart-1..4`) ou ter variante `dark:`.
- Confirmações usam `useConfirm()` (`components/ui/confirm-dialog.tsx`, `<dialog>` nativo), nunca `window.confirm`.
- `/privacidade` descreve cookies, IA e retenção: atualize-a ao mudar o que é coletado ou enviado à IA.
- `/dashboard/guia` cita os rótulos reais dos botões: ao renomear um botão ou mudar um fluxo, atualize o guia.
- Identidade visual "Roteiro com deixas" (caderno do diretor de cena): fatos do produto em `PRODUCT.md`, sistema visual em
  `DESIGN.md`, contrato da landing em `.impeccable/surfaces/`. Verde = VAI (primary), âmbar = atenção (`standby`),
  papéis de revisão `rev-*` = um por tipo de interação (`components/interaction-type-tag.tsx`), Courier Prime (`font-script`)
  para falas, deixas, códigos e numerais. Não inventar depoimentos, logos ou números na landing.
- Deploy na Vercel feito; `npm test` cobre os módulos puros de `lib/domain/`.
- **Pesquisas pós-evento por modelo** (migration `20261003000000_survey_templates.sql`, já aplicada) substituem o
  formulário fixo das seções 0.5 e 32 do PROMPT.md. Modelos em `survey_templates` (plataforma: `owner_id` null + slug;
  speaker: dono). A sessão escolhe `survey_template_id`; ao encerrar, um trigger copia as perguntas para
  `session_surveys`/`session_survey_questions` (editar o modelo não muda relatórios). Respostas em
  `survey_responses`/`survey_answers`, gravadas pelo servidor. Regras em `lib/domain/survey.ts` (dimensões,
  validação, NPS, pontos fortes/fracos). A tabela `feedback` é legado: convertida por `convert_legacy_feedback()`.
- `database.types.ts` agora é gerado do banco (não editar à mão).
- **Conta** (`/dashboard/conta`, migration `20261003010000_profile_settings.sql`): perfil com foto (bucket `avatars`,
  cada usuário só grava na própria pasta) e mini-bio; preferências (fuso, pesquisa e duração padrão) lidas por
  `getSpeakerProfile()` (`lib/data/profile.ts`); datas formatadas e interpretadas no fuso do speaker; exportação
  em JSON e exclusão de conta (único uso da secret key fora do fluxo do participante).
- **Biblioteca** (`/dashboard/biblioteca`): `lib/domain/library.ts` agrupa perguntas iguais de várias sessões;
  `features/library/actions.ts` duplica sessões e copia perguntas (com alternativas, acerto e pontos) via RLS.
- Navegação do painel: barra lateral com ícones (`components/dashboard/nav-links.tsx`); ícones novos vão em
  `components/icons.tsx`, no mesmo traço. Design aprovado no Claude Design (link no histórico do projeto).
- Imports de valor entre módulos de `lib/domain/` usam extensão `.ts` (os testes rodam no Node sem compilar).
- **Próxima tarefa:** aplicar migrations + seed num Supabase de teste e rodar o fluxo ponta a ponta
  (seção "Teste manual" do README). `src/lib/supabase/database.types.ts` foi escrito à mão:
  substitua por `npm run db:types` após ligar o projeto.

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
