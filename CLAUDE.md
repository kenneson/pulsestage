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
  `cqw` para escalar com a tela). Seções de slides e de gamificação/sorteio; exemplos do relatório e da conversa com
  a IA em `components/landing/report-preview.tsx` e `ai-chat-preview.tsx` (o relatório espelha o analytics: confiança
  geral e prioridade por recomendação). Só fatos do produto, nunca números de uso.
- **Perfil público e diretório** (migration `20261014000000_speaker_profiles.sql`): colunas de perfil público em `profiles`
  (`public_enabled`, `public_slug`, título, temas, cidade/UF, formatos, públicos, experiência declarada, links e as opções
  `contact_enabled/show_ratings/promote_on_survey`), `sessions.public_listed` e `contact_requests` (gravada só pelo servidor).
  `speaker_session_facts()` entrega os fatos de cada sessão encerrada; o critério de verificação (5 pessoas respondendo,
  10 min de palestra), notas, faixas de público, slug, temas e filtros do diretório ficam em `lib/domain/speaker-profile.ts`.
  O trigger `lock_session_timing` impede o speaker de mexer em início/fim/pausas pelo cliente (sessão nova nasce rascunho).
  Painel: `/dashboard/perfil-publico` e `/dashboard/convites` (selo de não lidos). Público: `/p/[slug]` (com OG image),
  `/palestrantes` e `/palestrantes/tema/[tema]` (filtros por GET, lidos com a secret key em `lib/data/speaker-profile.ts`),
  `sitemap.ts` e `robots.ts`. Convite: honeypot, até 3 por hora por hash de IP e 30 por dia por palestrante; e-mail opcional
  via Resend (`RESEND_API_KEY`, `CONTACT_EMAIL_FROM`). Card “Conheça o palestrante” depois da pesquisa. Sem feed, curtidas
  ou seguidores: é portfólio, não rede social.
- **MCP para assistentes de IA** (Claude, ChatGPT, Claude Code…): `/api/mcp` (SDK `@modelcontextprotocol/sdk`,
  `WebStandardStreamableHTTPServerTransport` sem estado, um `McpServer` por requisição em `lib/mcp/server.ts`). Login
  pelo servidor OAuth 2.1 do Supabase (registro dinâmico; consentimento em `/oauth/consent`, ações em
  `features/integrations/actions.ts`); `lib/mcp/auth.ts` valida o token com `auth.getUser` e consulta como o usuário
  (RLS). Metadados em `/.well-known/oauth-protected-resource[/api/mcp]` e cópia do AS em
  `/.well-known/oauth-authorization-server`. Ferramentas: list/get/create/update session, add/update/move/delete
  interaction, list_survey_templates, get_session_results (sem dados pessoais), prompt `plan_from_slides`. O assistente
  lê o PDF no chat e manda `after_slide` (página do PDF); `lib/domain/mcp.ts` converte para `interactionInputSchema` e
  ordena sem limitar ao número de slides (a posição vale quando o PDF chegar). Escrita compartilhada com o painel em
  `features/interactions/core.ts` e `features/sessions/core.ts`. Painel: `/dashboard/integracoes` (passo a passo,
  pedidos de exemplo, assistentes conectados com revogar). Não inicia/encerra sessão ao vivo de propósito.
- **Participação da plateia (leva 1)** (migration `20261015000000_audience_engagement.sql`): opções por sessão
  (`qa_enabled`, `qa_moderated`, `reactions_enabled`, `profanity_filter`, `moderate_open_text`) na aba “Participação” e
  no card da sala ao vivo (`components/engagement/engagement-settings.tsx`). **Ranking** é o 6º tipo: o servidor grava
  `{order, points}` (Borda, `lib/domain/ranking.ts`) e o trigger soma os pontos em `interaction_results.counts`.
  **Moderação**: `responses.moderation` (`visible|pending|hidden`); só as visíveis entram em counts/recent;
  `recompute_interaction_results()` refaz o agregado depois de `moderate_response()`/`set_term_visibility()`.
  **Filtro de palavrões** (`lib/domain/profanity.ts`): o que for barrado é gravado oculto (`metadata.filtered`), sem
  avisar quem enviou. **Perguntas da plateia** em `audience_questions` + `audience_question_votes` (trigger conta curtidas);
  celular lê por `/api/participant/[id]/questions` (só quando o painel está aberto, a cada 6 s), telão por
  `/api/session/[id]/questions` (só com `session_live_state.show_questions`); `show_questions()`/`moderate_question()`.
  **Reações** em `reactions`; o telão busca `/api/session/[id]/reactions?after=` a cada 1,5 s (nada de realtime por
  toque); limite por pessoa em memória (`allowReaction`). Analytics: perguntas e picos de reação (com o que estava no
  telão). Tudo também no MCP (ranking, perguntas sem nome, reações).
- **Idiomas** (next-intl 4, migration `20261016000000_locales.sql`; guia completo em `docs/I18N.md`): `pt-BR`, `es-419`
  (espanhol latino neutro, "tú") e `en-US`. Regras puras em `lib/domain/locale.ts`. Páginas públicas aceitam `/es` e `/en`
  (o `proxy.ts` reescreve, grava `x-pulsestage-locale` e o cookie `NEXT_LOCALE`); sem prefixo vale o cookie, depois o
  `Accept-Language`. `profiles.locale` (cadastro/seletor, vira cookie no login) e `sessions.locale` (formulário da
  sessão): o celular e o telão usam o da sessão via `<SessionIntl>`; também o filtro de palavrões, a nuvem
  (`normalizeTerm(text, locale)`), as sugestões da IA e o modelo padrão de pesquisa (`survey_templates.locale`, mesmo
  slug nos três idiomas). Textos em `messages/<locale>/<área>.json`; chaves tipadas e `satisfies Messages` acusam falta no
  `tsc`; `tests/i18n.test.ts` confere chaves e parâmetros. Regras puras devolvem chaves (`validation.*`, `messageKey`),
  traduzidas por `getMessageTranslator()` (servidor) ou `translateMessage()` (cliente). Rótulos das constantes do domínio
  (em português, para MCP/IA) aparecem na tela pela área `domain`. Textos novos: sempre nos três idiomas. E-mails do
  Supabase Auth com os três idiomas em `supabase/templates/` (colar no painel).
- **Realtime resistente**: `useLiveState` relê `session_live_state` ao conectar (e 3 s depois), expõe `refresh()` (a sala
  ao vivo chama após cada ação) e aceita `pollMs` (só o projetor, 10 s). Nunca usar `pollMs` para participantes.
- **Auditoria de produto** (migration `20261017000000_audit_fixes.sql`): pesquisa anônima (de quem não entrou) com
  limite por IP via `survey_responses.ip_hash` (HMAC com segredo do servidor em `lib/request-ip.ts`, nunca o IP); essas
  respostas aparecem ao speaker mas ficam fora da nota pública e do selo "verificado". Limite de código errado por hash
  de IP, em memória. A plateia entra com a sessão em rascunho e espera no celular. **Ensaio** ("Testar sessão",
  `startRehearsalAction`/`endRehearsalAction`): `sessions.is_test`/`rehearsal_of`, cópia oculta já ao vivo, fora de
  listas, estatísticas e perfil público; encerrar apaga a cópia. Sala ao vivo em tela própria (sem barra lateral, por
  `usePathname` em `components/live/live-room-frame.tsx`), "Próxima" em destaque e controle único "No telão agora"
  (`screen-switcher.tsx`, regras em `lib/domain/screen.ts`); leituras periódicas por GET em `/api/live/[sessionId]/*`
  (perguntas, moderação, reações, sorteio; só o dono) com `usePolling` (`lib/realtime/use-polling.ts`; nunca Server
  Action para polling). Ranking do quiz no telão só durante a sessão; sorteio até 24 h após o fim
  (`RAFFLE_PUBLIC_WINDOW_MS`). Anônimo não escreve em tabela nenhuma; `responses` saiu do Realtime.
- **Animações** (Motion, `motion` 14, motion.dev): `MotionProvider` (`components/motion/motion-provider.tsx`: `LazyMotion`
  com `domMax` no bundle, `strict`, `reducedMotion="user"`) em `app/session/[id]/layout.tsx` (celular e telão) e no layout
  do painel. Sempre `m.*` de `motion/react-m` e só em arquivo `"use client"` (fora do provider, `m.*` renderiza sem
  animar). Presets em `components/motion/presets.ts`; peças em `components/motion/animated.tsx` (`AnimatedNumber`,
  `AnimatedBarFill`, `AnimatedList`/`AnimatedItem`, `AnimatedCheck`). `ResultsView` anima só com `animated` (telão e
  sala ao vivo); a análise e o relatório ficam estáticos. Celular: troca de tela por `AnimatePresence`, alternativas
  em sequência com toque, ranking que "voa" (`layoutId`). Telão: troca de tela (slide → slide é direta), código de
  entrada letra a letra, ranking do quiz com mola e pontos contando, perguntas da plateia que reordenam. Sala ao vivo:
  pílula do "No telão agora" desliza (`layoutId`). Regras visuais em `DESIGN.md`.
- **Sala de espera e resultado do quiz** (sem migration): no QR Code de entrada, o telão (`components/display/join-lobby.tsx`)
  busca `/api/session/[id]/lobby` (secret key; só quando `screenContent` dá `join`, em rascunho ou ao vivo; releitura de
  3 s, pois em rascunho o telão não lê o estado ao vivo, e na hora quando `participant_count` muda) e mostra as 48 pessoas
  mais recentes com avatar e nome, entrando com mola e flutuando. `publicName()` (`lib/domain/lobby.ts`) tira da sala o
  nome com palavrão (filtro da sessão ligado); o ranking do quiz no telão usa o mesmo filtro. No celular,
  `useQuizResult` (`components/participant/quiz-result.tsx`) acompanha o último quiz e, quando o tempo acaba (com a
  folga) ou a pergunta sai do ar, busca `/api/participant/[id]/quiz-result?interaction=`. O servidor só revela depois
  que ninguém mais pode responder (`quizReveal` em `lib/domain/quiz-result.ts`; quiz que nunca foi ao ar não revela) e
  devolve acertou, pontos, resposta certa e a posição da própria pessoa (`rankQuiz`/`standingIn`, ranking em memória
  por 5 s em `lib/data/quiz-result.ts`). A tela de resultado fica até a próxima pergunta.
- **Celular estilo app** (abaixo de 768 px): painel com barra superior fixa e barra de abas embaixo
  (`components/dashboard/mobile-nav.tsx`: Visão geral, Sessões, Nova sessão, Pesquisas e "Mais", que abre uma folha com o
  resto do menu, idioma, tema e sair); a barra lateral só aparece a partir de `md`. Confirmações e diálogos viram folhas
  inferiores; botões, campos e abas com 44 px de toque; sala ao vivo com "Anterior/Próxima" fixos no rodapé. PWA:
  `app/manifest.ts`, `app/icon.tsx`, `app/apple-icon.tsx`, `favicon.ico`. **Regra:** ajuste de celular só com `max-md:`/
  `max-sm:` (ou `md:contents`/`md:hidden`); a partir de `md` nada muda. Conferência: capturas de 1440 px antes e depois,
  comparadas pixel a pixel.
- **Leva Mentimeter** (migration `20261020000000_menti_features.sql`, já aplicada): 12 tipos (novos: `points_100`,
  `matrix_2x2`, `pin_image`, `guess_number`, `quiz_text`, `content`). Respostas com várias chaves gravam `value.tally`, que o
  banco soma em `interaction_results.counts` (`response_tally()`, numérico). Gabarito privado em `interactions.answer_key`
  (nunca vai ao público); notas em `interactions.speaker_notes` e `sessions.slide_notes`. Regras em `lib/domain/answers.ts`,
  `scoring.ts` (`guessOutcome`, `quizTextOutcome`), `results.ts`, `content.ts` (`toEmbedUrl`). Telão: `reveal_results()`,
  `reveal_answer()`, `set_segment_filter()` (enquete com `settings.isSegment`), `set_leaderboard_mode()` (pessoas/equipes)
  em `session_live_state`. `sessions.pace = 'self'`: qualquer pergunta aceita resposta, sem cronômetro nem bônus; sala ao
  vivo vira "Acompanhamento" (`/api/live/[id]/progress`). Equipes em `session_teams` + `participants.team_id`
  (`features/teams/`). Marca: `profiles.brand_logo_path/brand_color`, bucket público `brand`, `sessions.use_brand`,
  contraste em `lib/domain/brand.ts`, `<BrandScope>` na área da sessão. Modelos de sessão em `lib/domain/session-templates.ts`
  (`/dashboard/sessions/modelos`). PowerPoint: `/office` (office.js), `/office/manifest.xml`, cartão em Integrações.
- **Sessão em etapas** (`lib/domain/session-steps.ts`, `components/sessions/session-stepper.tsx`): `?etapa=configuracoes|
  slides|enquetes|pesquisa|sorteio|pronto` (o `?aba=` antigo ainda funciona). Criar a sessão leva direto a Slides; cada
  etapa carrega só os próprios dados.

## Mapa do código
- `src/lib/domain/` regras puras (status, interações, palavras, resultados, métricas). Sem I/O.
- `src/lib/data/` leituras no servidor. `sessions.ts`/`analytics.ts` usam o cliente do speaker (RLS);
  `public.ts` usa a secret key e devolve só dados sanitizados.
- `src/features/*/actions.ts` Server Actions (toda escrita passa por aqui).
- `src/lib/realtime/` hooks de realtime (trocar Postgres Changes por Broadcast só mexe aqui).
- `src/features/*/core.ts` regras de escrita compartilhadas entre Server Actions e MCP (`sessions`, `interactions`,
  `library`); as `actions.ts` só validam, traduzem e revalidam.
- `src/lib/mcp/` servidor MCP (`server.ts`, `auth.ts`, `metadata.ts`, `results.ts`); conversão em `lib/domain/mcp.ts`.
- `src/i18n/` next-intl: `request.ts`, `provider.tsx`, `session-intl.tsx`, `server.ts` (`getMessageTranslator`), `seo.ts`
  (`localeAlternates`, `getPublicHref`), `cookie.ts`, `messages.ts`, `namespaces.ts`, `types.d.ts`. Guia em `docs/I18N.md`.
- `messages/<locale>/<área>.json` textos nos três idiomas (`pt-BR`, `es-419`, `en-US`), mesmas chaves.
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
- Nenhum texto visível fixo no código: tudo pelo next-intl, nos três idiomas (`docs/I18N.md`).

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
