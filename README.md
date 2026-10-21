# PulseStage

> Seu público fala. Você entende. Sua próxima palestra fica melhor.

Interação em tempo real para aulas, palestras e treinamentos. Seis tipos de pergunta (enquete, escala, nuvem de
palavras, pergunta aberta, quiz e ranking), perguntas da plateia e reações, slides em PDF na mesma sequência, telão,
sorteio, pesquisa pós-evento por modelo, analytics, evolução entre sessões e insights com IA. Em português, espanhol
latino e inglês.

**Stack:** Next.js 16 (App Router) · TypeScript estrito · Tailwind v4 · componentes estilo shadcn/ui ·
Supabase (Auth, Postgres, RLS, Realtime, Storage) · Zod · next-intl · Recharts/d3 · Vercel.

## Rodando localmente

1. **Dependências:** `npm install`
2. **Supabase:** crie um projeto em supabase.com, ou rode localmente com Docker: `npx supabase init` cria um
   `supabase/config.toml` local (o repositório não traz um) e `npx supabase start` sobe o banco.
3. **Banco:** aplique as migrations de `supabase/migrations/` em ordem
   (`npx supabase db push` com o projeto linkado, ou cole no SQL Editor). A mais recente é
   `20261017000000_audit_fixes.sql`.
   Opcional: rode `supabase/seed.sql` para dados de demonstração
   (login `demo@pulsestage.app` / `demo123456`, duas sessões encerradas e um rascunho).
4. **Variáveis:** copie `.env.example` para `.env.local` e preencha (tabela abaixo).
   Gere o segredo do participante com `openssl rand -base64 48`.
5. **Realtime:** confirme em *Realtime → Settings* que o acesso público a canais está permitido
   (Presence dos participantes usa a publishable key).
6. **Auth:** em *Authentication → URL Configuration*, adicione `http://localhost:3000/**`
   e `https://SEU-APP.vercel.app/**` às Redirect URLs. Sem isso, o retorno do login cai no Site URL e falha.
   - **Login com Google (opcional):** no Google Cloud, crie um ID do cliente OAuth (Aplicativo da Web) com a URI
     de redirecionamento `https://<projeto>.supabase.co/auth/v1/callback`. Cole o Client ID e o Client Secret em
     *Authentication → Sign In / Providers → Google* no Supabase. Nenhuma variável de ambiente é necessária.
7. **Assistentes de IA (MCP, opcional):** para conectar o Claude, o ChatGPT e outros clientes MCP, ligue o servidor
   OAuth do Supabase em *Authentication → OAuth Server*: ative o OAuth 2.1, use `/oauth/consent` como
   *Authorization Path* e ligue o *Dynamic client registration*. O *Site URL* (em *URL Configuration*) precisa ser o
   domínio público do app, porque o consentimento abre em Site URL + `/oauth/consent`. Local: no `config.toml` criado
   pelo `supabase init`, `[auth.oauth_server] enabled = true` e `allow_dynamic_registration = true`. O servidor MCP
   fica em `/api/mcp`.
8. **E-mails do login em três idiomas:** em *Authentication → Emails*, cole o HTML de `supabase/templates/`
   (`confirmation.html`, `recovery.html`, `email_change.html`) no template correspondente, com o assunto indicado em
   `supabase/templates/README.md`.
9. `npm run dev` → http://localhost:3000

Tipos do banco: `src/lib/supabase/database.types.ts` é gerado do banco. Depois de mudar o schema (migration nova),
rode `npm run db:types` com o projeto linkado; não edite o arquivo à mão.

### Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | sim | chave pública (ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`, criada pela integração da Vercel) |
| `SUPABASE_SECRET_KEY` | sim | só no servidor (ou `SUPABASE_SERVICE_ROLE_KEY`); fluxo do participante, telão, exclusão de conta |
| `PARTICIPANT_TOKEN_SECRET` | sim | 32+ caracteres; assina o cookie do participante e calcula o hash do IP dos limites de abuso |
| `NEXT_PUBLIC_APP_URL` | local | endereço público do QR Code e dos links; na Vercel pode ficar vazio (usa o domínio de produção) |
| `NEXT_PUBLIC_APP_TIME_ZONE` | não | fuso padrão (`America/Sao_Paulo`); cada palestrante tem o próprio fuso na conta |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | não | IA (`groq`, `openai` ou `anthropic`); sem elas, "Gerar com IA" e os insights somem. `AI_MODEL` vazio usa o padrão do provedor |
| `RESEND_API_KEY`, `CONTACT_EMAIL_FROM` | não | aviso por e-mail dos convites do perfil público |

## Teste manual (ponta a ponta)

1. Crie uma conta, crie uma sessão e adicione uma interação de cada um dos 6 tipos (use o ícone de olho para
   pré-visualizar).
2. Ainda em rascunho, entre pelo celular com o código: a tela fica esperando o início. Use **Testar sessão** para
   abrir um ensaio (cópia oculta, já ao vivo, com link para abrir como participante); **Encerrar ensaio** apaga a cópia.
3. Clique em **Iniciar sessão** → sala ao vivo (tela própria, sem barra lateral). Abra **Tela do projetor** em outra
   aba. Avance com **Próxima** e escolha o que está no telão pelo controle único.
4. Num celular (ou janela anônima), acesse o QR/código, entre e responda. Os resultados devem aparecer
   no projetor e na sala sem recarregar.
5. Teste: responder duas vezes, quiz com tempo esgotado, pausar/retomar (o cronômetro para e volta), encerrar a interação.
6. Slides: noutra sessão, envie um PDF na aba **Slides**, posicione as perguntas entre os slides e, ao vivo,
   avance com → / PageDown (e volte com ← / PageUp) na sala ao vivo e na tela do projetor aberta logado.
   Ao vivo, use **Nova pergunta** para criar uma pergunta e lançá-la na hora ou deixá-la como a próxima.
7. **Encerrar sessão** → o celular e o projetor mostram o link da pesquisa. Responda pelo celular que entrou e por
   uma janela anônima que não entrou: as duas aparecem para você, mas só a primeira conta na nota pública.
8. Abra o analytics da sessão e, com `AI_PROVIDER`/`AI_API_KEY` configurados, gere os insights.
9. Participação: com a sessão ao vivo, num celular toque nas reações e em **Perguntar ao palestrante**; noutro, curta a
   pergunta. Na sala ao vivo, **Destacar** e **Mostrar no telão**; numa nuvem, mande um palavrão e confira que ele
   fica em **Moderar palavras** e fora do telão. Crie um **Ranking** e ordene pelo celular.
10. MCP: em **Integrações**, copie o endereço e conecte um assistente (ou `claude mcp add --transport http pulsestage
   <endereço>`). Anexe um PDF, peça as perguntas, confira a sessão criada e envie o mesmo PDF na aba **Slides**.
11. Idiomas: abra `/es` e `/en` (landing, login, diretório) e troque pelo seletor de idioma. Crie uma sessão com
   **Idioma da sessão** = Español: o celular e o telão aparecem em espanhol mesmo com o navegador em português, a
   pesquisa padrão é a "Evaluación general" e "weón" fica fora da nuvem. Veja `docs/I18N.md`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run lint` | ESLint (flat config do Next) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | testes unitários (`node --test`, sem compilar): regras de `lib/domain/`, cookie do participante, MCP e traduções |
| `npm run db:types` | gera `database.types.ts` a partir do Supabase linkado |

## Arquitetura em uma página

- **Participantes não têm conta.** Entram por `/join/[código]`; o servidor cria o registro e grava um cookie
  HTTP-only assinado (HMAC). Toda resposta passa por Server Action, que valida o cookie e calcula acerto,
  pontos, tempo do quiz e normalização da nuvem de palavras. O papel `anon` não escreve em nada.
- **Realtime público** lê só `session_live_state` e `interaction_results`, mantidas por triggers.
  "Conectados agora" vem do Presence e é apenas informativo.
- **RLS** garante que o speaker só vê as próprias sessões.
- **LGPD:** contato do participante fica em `participant_contacts`, separado e com consentimento.
  A IA recebe dados agregados e trechos de respostas abertas e comentários, nunca nomes ou contatos.
  Limites de abuso (pesquisa sem ter entrado, código errado, convites) usam um hash do IP com segredo do servidor;
  o IP não é guardado. Detalhes em `/privacidade`.
- **MCP (assistentes de IA):** `/api/mcp` (Streamable HTTP, sem estado) aceita o access token do servidor OAuth
  do Supabase (consentimento em `/oauth/consent`) e roda as ferramentas como o próprio palestrante, com RLS.
  O assistente lê o PDF no chat; o PulseStage recebe só as perguntas com `after_slide`.
- **Métricas:** “sinal de participação” = respostas ÷ participantes presentes em cada interação.
  Mede participação, não atenção.

## Status

| Fase | Situação |
|---|---|
| Especificação e schema | ✅ |
| Código do MVP (auth, sessões, builder, ao vivo, projetor, participante, feedback, analytics, evolução, IA) | ✅ |
| Tema escuro (toggle claro/escuro, segue o sistema por padrão) | ✅ |
| Polimento: loading/skeletons, diálogos de confirmação, página `/privacidade` | ✅ |
| Login e cadastro com Google | ✅ |
| "Como funciona" na home e guia de uso em `/dashboard/guia` | ✅ |
| Identidade visual "Campus" (azul acadêmico, Plus Jakarta Sans, escuro em azul-marinho; substitui "Roteiro com deixas") | ✅ |
| Pesquisas pós-evento por modelo (5 prontos + modelos próprios, pontos fortes/fracos por dimensão) | ✅ |
| Navegação lateral com ícones, conta e configurações (perfil, preferências, segurança, LGPD) | ✅ |
| Duplicar sessão e biblioteca de perguntas | ✅ |
| Exportar relatório (PDF pela impressão do navegador) e CSV das respostas e da pesquisa | ✅ |
| IA sugere perguntas para o roteiro (“Gerar com IA”) | ✅ |
| Slides em PDF dentro da sessão (slides e perguntas na mesma sequência, passador avança tudo) | ✅ |
| Nova pergunta durante a sessão ao vivo (lançar agora ou deixar como próxima) | ✅ |
| Tempo de palestra: cronômetro ao vivo (previsto × real, sem pausas) e duração no analytics e relatório | ✅ |
| Nuvem de palavras com layout d3-cloud (animada, no telão, sala ao vivo e analytics) | ✅ |
| Linha do tempo da palestra no analytics (slides, perguntas, QR e pausas; tempo por slide) | ✅ |
| Ranking do quiz animado no telão (“Mostrar ranking”) | ✅ |
| Gamificação: avatares, alternativas com formas/cores e imagens, bônus de velocidade | ✅ |
| Sorteio de prêmios (pesquisa ou todos), número da sorte, telão com suspense e som, controle de entrega | ✅ |
| Perfil público verificado do palestrante, diretório `/palestrantes` (filtros e páginas por tema) e convites | ✅ |
| Participação da plateia: ranking (6º tipo), perguntas da plateia com curtidas e telão, reações ao vivo, filtro de palavrões e moderação | ✅ |
| Servidor MCP (Claude, ChatGPT e outros): criar sessões e perguntas a partir dos slides, OAuth, página Integrações | ✅ |
| Idiomas: português, espanhol latino e inglês americano (next-intl, `/es` e `/en`, idioma por sessão, palavrões e IA por idioma) | ✅ |
| Realtime resistente a eventos perdidos (releitura ao conectar, após ações e no projetor) | ✅ |
| Auditoria de produto: pesquisa anônima com limite por IP (fora da nota pública), entrada antes do início, modo ensaio, sala ao vivo em tela própria, leituras por GET, limite de código errado | ✅ |
| Animações com Motion (motion.dev): troca de tela no celular e no telão, alternativas e toques, barras e números que contam, ranking do quiz, listas que reordenam; respeita "reduzir movimento" | ✅ |
| Testes unitários (domínio, cookie do participante, MCP, traduções nos três idiomas) | ✅ |
| Testes de integração e E2E | ⏳ |
| Deploy na Vercel | ✅ |

Especificação completa em `docs/PROMPT.md`.
