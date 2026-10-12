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
- Identidade visual "Campus" (desde 2026-10-12, substitui "Roteiro com deixas"): universitária e corporativa, acolhedora
  para escolas. Fatos do produto em `PRODUCT.md`, sistema visual em `DESIGN.md`, contrato da landing em
  `.impeccable/surfaces/`. Azul acadêmico = ação e ao vivo (primary), âmbar = atenção (`standby`), amarelo = marca-texto;
  cores `rev-*` = uma por tipo de interação (`components/interaction-type-tag.tsx`). Fontes: Plus Jakarta Sans
  (`font-display`) para títulos, numerais e códigos; Geist para interface. Escuro em azul-marinho. Não inventar
  depoimentos, logos ou números na landing.
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
- **Exportação**: relatório em `/dashboard/sessions/[id]/relatorio` (PDF via `window.print`, estilos `@media print`
  em `globals.css`, sempre claro); CSV em `.../exportar?tipo=interacoes|pesquisa` com `lib/domain/csv.ts`
  (`;`, BOM UTF-8, proteção contra fórmulas).
- **IA no roteiro**: “Gerar com IA” (só aparece com IA configurada) sugere 5 perguntas a partir do título,
  descrição e duração; limite de 8 s por speaker, em memória.
- Navegação do painel: barra lateral com ícones (`components/dashboard/nav-links.tsx`); ícones novos vão em
  `components/icons.tsx`, no mesmo traço. Design aprovado no Claude Design (link no histórico do projeto).
- Imports de valor entre módulos de `lib/domain/` usam extensão `.ts` (os testes rodam no Node sem compilar).
- **Slides** (migration `20261010000000_session_slides.sql`): o speaker envia o PDF na aba “Slides”; o navegador
  converte cada página em imagem com pdf.js (build `legacy`, em `lib/slides/convert-pdf.ts`) e grava no bucket privado
  `slides` (`{speaker}/{sessão}/{lote}/001.webp`). O PDF nunca é enviado. `sessions.slides_batch/slide_count/slides_format`
  apontam o deck atual; `interactions.after_slide` diz depois de quantos slides a pergunta entra (null = no fim).
  Regras do deck (sequência, próximo/anterior, posicionar) em `lib/domain/deck.ts`. Ao vivo, `show_slide()` grava
  `session_live_state.current_slide` e encerra a pergunta ativa; projetor e sala recebem URLs assinadas (12 h) geradas
  no servidor (`lib/data/slides.ts`). Navegação compartilhada em `components/live/use-deck-controls.ts` (→/PageDown,
  ←/PageUp); o projetor aceita o teclado só quando o dono da sessão está logado nele. Excluir sessão/conta apaga os
  arquivos; duplicar copia para um lote novo.
- **Nova pergunta ao vivo**: botão no card Roteiro da sala ao vivo (`components/live/add-interaction-dialog.tsx`,
  reaproveita `InteractionForm` com `actions`). `addLiveInteractionAction` cria, posiciona logo depois do item no telão
  (`insertAfterItem` em `lib/domain/deck.ts`) e, com “Lançar agora”, ativa. O cursor do deck guarda o item, não o
  índice, para sobreviver a perguntas inseridas durante a apresentação.
- **Tempo de palestra** (migration `20261010010000_session_timing.sql`): `sessions.paused_at/paused_seconds`, mantidos
  pelo trigger `validate_session_status` (soma o tempo parado ao retomar ou encerrar). Regras em `lib/domain/timing.ts`
  (duração = fim − início − pausas). Cronômetro na sala ao vivo (`components/live/talk-timer.tsx`, âmbar ao passar do
  previsto); duração real no cabeçalho do analytics e do relatório.
- **Nuvem de palavras** (`components/results/word-cloud.tsx`): `d3-cloud` calcula as posições no navegador (semente fixa,
  espera as fontes, reduz o tamanho até caberem todas) e o React desenha o SVG; palavras deslizam (transform em CSS) quando
  as contagens mudam. A normalização dos termos continua no servidor (seção 0.3). O d3-cloud usa o campo `weight` dos
  itens: o destaque pela contagem se chama `emphasis`.
- **Linha do tempo** (migration `20261011000000_session_timeline.sql`): `session_events` (status, slide, abertura e
  fechamento de pergunta), gravada só por triggers e por `show_slide()`; RLS de leitura para o dono. `lib/domain/timeline.ts`
  monta os trechos (slide, pergunta, QR, pausa) e o tempo por slide; sessões anteriores usam `legacyEvents` (só perguntas).
  Gráfico em `components/analytics/talk-timeline.tsx` (eixo com `d3-scale`; cores `--timeline-slide/--timeline-question`,
  par validado para daltonismo nos dois temas; tooltip, legenda e tabela).
- **Ranking do quiz no telão** (migration `20261011010000_quiz_leaderboard.sql`): `show_leaderboard()` liga
  `session_live_state.show_leaderboard` (fecha a pergunta ativa); `show_slide()` e a abertura de uma pergunta desligam.
  O projetor busca `/api/session/[id]/leaderboard` (secret key, só enquanto o ranking está no telão; nome escolhido ou
  “Participante XXXX”, pontos e posições). `lib/domain/leaderboard.ts` calcula a posição atual e a de antes do último
  quiz; `components/display/quiz-leaderboard.tsx` anima (linhas deslizam, pontos sobem). Também vira trecho na linha do tempo.
- **Gamificação** (migration `20261012000000_gamification.sql`): `participants.avatar` (chave de `AVATARS` em
  `lib/domain/gamification.ts`, escolhida na entrada; vira emoji no ranking do telão, no analytics e no celular).
  `settings.optionStyle` (`text`|`shapes`) em enquete e quiz: forma + cor por posição (`optionShape`, tokens `--shape-1..8`,
  `components/option-shape.tsx`); a forma e o texto sempre acompanham a cor. `interaction_options.image_path` aponta para o
  bucket público `option-images` (`{speaker}/{uuid}.webp`, reduzida a 800 px no navegador em `lib/option-images/upload.ts`);
  o servidor só aceita imagens da pasta do próprio speaker e apaga do Storage só a imagem que nenhuma alternativa usa mais
  (`lib/data/option-images.ts`; duplicar reaproveita o arquivo). Quiz com `settings.speedBonus` e tempo: `quizPoints()`
  dá de 100% a 50% dos pontos conforme o tempo, calculado no servidor.
- **Sorteio** (migration `20261013000000_raffles.sql`): opcional por sessão (`sessions.raffle_eligibility`: `survey` = quem
  respondeu a pesquisa, `everyone` = todos; null = sem sorteio). Prêmios em `raffle_prizes` (físico/digital, quantidade,
  mensagem só para o ganhador). Números em `raffle_entries` (criados por `raffle_ticket()` quando a pessoa passa a concorrer;
  o celular busca `/api/participant/[id]/raffle`). `draw_raffle()` sorteia no banco (`gen_random_uuid()`, uma vitória por
  pessoa, trava a sessão) e liga `session_live_state.show_raffle/raffle_drawn_at`; `forfeit_raffle_winner()` tira o ausente.
  Tempos em `lib/domain/raffle.ts`: o telão (`components/display/raffle-stage.tsx`) gira a roleta até
  `RAFFLE_SUSPENSE_MS`, quando `/api/session/[id]/raffle` passa a entregar o ganhador, desacelera e revela (som em
  `lib/raffle/sound.ts`, Web Audio, liberado no primeiro clique); celulares e sala ao vivo só sabem após `RAFFLE_REVEAL_MS`.
  Com sorteio, encerrar a sessão não sai da sala ao vivo (card `components/live/raffle-panel.tsx`). Gestão na aba “Sorteio”
  e em `/dashboard/sorteios` (entrega via coluna `delivered_at`, único update permitido ao speaker).
- **URL pública** (`lib/domain/app-url.ts`, usada em `lib/env.ts`): QR Code e links usam `NEXT_PUBLIC_APP_URL`, mas um
  endereço `*.vercel.app` de deploy/branch (protegido por login da Vercel) é trocado pelo domínio de produção
  (`VERCEL_PROJECT_PRODUCTION_URL`); sem `https://`, completa.
- **Landing** (`src/app/page.tsx`, contrato em `.impeccable/surfaces/`): manchete na largura toda e palco de demonstração
  (`components/landing/stage-demo.tsx`, 4 cenas simuladas: enquete, nuvem, quiz e ranking, sorteio; texto do telão em
  `cqw` para escalar com a tela). Seções de slides e de gamificação/sorteio. Só fatos do produto, nunca números de uso.
- **Realtime resistente**: `useLiveState` relê `session_live_state` ao conectar (e 3 s depois), expõe `refresh()` (a sala
  ao vivo chama após cada ação) e aceita `pollMs` (só o projetor, 10 s). Nunca usar `pollMs` para participantes.
- **Próxima tarefa:** aplicar migrations + seed num Supabase de teste e rodar o fluxo ponta a ponta
  (seção "Teste manual" do README). `src/lib/supabase/database.types.ts` foi escrito à mão:
  substitua por `npm run db:types` após ligar o projeto.

## Mapa do código
- `src/lib/domain/` regras puras (status, interações, palavras, resultados, métricas). Sem I/O.
- `src/lib/data/` leituras no servidor. `sessions.ts`/`analytics.ts` usam o cliente do speaker (RLS);
  `public.ts` usa a secret key e devolve só dados sanitizados.
- `src/features/*/actions.ts` Server Actions (toda escrita passa por aqui).
- `src/lib/realtime/` hooks de realtime (trocar Postgres Changes por Broadcast só mexe aqui).
- `src/lib/ai/` abstração `AIProvider` (Groq/OpenAI/Anthropic via fetch; `complete()` genérico, saída validada com Zod).
  Casos de uso em `ai/index.ts`: `generateInsights` e `suggestInteractions` (sugestões passam pelo mesmo
  `interactionInputSchema` do builder antes de chegar à UI).
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
