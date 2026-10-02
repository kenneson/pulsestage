# PulseStage — Prompt mestre para Claude Code

> Versão 2 (revisada). A seção 0 registra as decisões técnicas que resolvem os conflitos da versão 1 e prevalece sobre o restante do documento.

## Contexto

Quero construir uma aplicação SaaS web chamada provisoriamente **PulseStage**.

O produto será uma plataforma de interação em tempo real para:

- palestrantes;
- professores;
- instrutores;
- facilitadores;
- treinadores corporativos.

O conceito central do produto é:

> **Audience → Interaction → Data → Insight → Improvement**

A plataforma permite que um palestrante crie uma sessão/palestra, apresente perguntas e atividades interativas para a audiência em tempo real, visualize as respostas instantaneamente e, depois da palestra, colete feedback dos participantes.

Depois disso, os dados são consolidados em um dashboard com analytics e insights gerados por IA.

### Diferencial

Não quero construir apenas um clone de Mentimeter, Slido ou AhaSlides.

O diferencial é transformar os dados coletados durante e depois da palestra em **inteligência para ajudar o palestrante a melhorar suas próximas apresentações**.

A proposta de valor é:

> **Seu público fala. Você entende. Sua próxima palestra fica melhor.**

---

# 0. Decisões técnicas já tomadas (prevalecem sobre o restante do documento)

Estas decisões resolvem conflitos encontrados na primeira versão deste prompt. Em caso de divergência com qualquer outra seção, siga esta seção e a migration em `supabase/migrations/`.

## 0.1 Participantes não autenticam; toda escrita deles passa pelo servidor

- Participantes não usam Supabase Auth, nem Anonymous Sign-In (o limite de criação de usuários por IP atrapalharia eventos em que todos estão no mesmo Wi-Fi).
- Ao entrar por `/join/[code]`, o servidor cria um registro em `participants` e grava um cookie HTTP-only, `SameSite=Lax`, assinado com HMAC (`PARTICIPANT_TOKEN_SECRET`), contendo `participant_id` e `session_id`.
- Respostas e feedback são enviados para Server Actions ou Route Handlers, que validam o cookie, validam o payload com Zod e gravam usando um cliente Supabase server-side com a secret key (módulo marcado com `server-only`).
- O role `anon` não tem nenhuma permissão de escrita no banco.
- O conteúdo da interaction (título, opções) chega ao participante pelo servidor, sem nunca expor `is_correct` nem `points`.

## 0.2 Realtime só transmite dados sanitizados

- Duas tabelas de leitura pública alimentam o realtime: `session_live_state` (status, interaction ativa, participantes que entraram) e `interaction_results` (agregados por interaction).
- Ambas são mantidas por triggers no banco; nenhum cliente escreve nelas.
- Participantes e a tela de projetor (`/session/[id]/display`, pública) assinam apenas essas duas tabelas via Postgres Changes. Quando a interaction ativa muda, o participante busca o conteúdo dela no servidor.
- A tabela `responses` nunca é lida por anon. Só o dono da sessão assina `responses` (para ver respostas abertas na Control Room).
- "Conectados agora" usa Realtime Presence no canal da sessão. É um número informativo: pode ser inflado por um cliente malicioso, então não entra em métricas.
- Encapsular todo o realtime em `lib/realtime/` para permitir migrar para Broadcast depois.

## 0.3 Cálculos sensíveis acontecem no servidor

- Quiz: `isCorrect`, `points` e `responseTimeMs` são calculados no servidor a partir de `interactions.activated_at` e `interaction_options`. Nunca aceitar esses valores do cliente.
- Word cloud: a normalização (minúsculas, sem pontuação, espaços colapsados, stopwords em pt-BR, acentos preservados) acontece no servidor; o termo normalizado vai em `responses.aggregate_key`.
- `aggregate_key` por tipo: multiple_choice/quiz → id da opção; rating → valor como texto (`"4"`); word_cloud → termo normalizado; open_text → `null`.
- Ativar ou encerrar interaction: usar a função `set_active_interaction(session_id, interaction_id | null)`. O banco garante no máximo uma interaction ativa por sessão.
- Transições de status da sessão são validadas por trigger. Ao encerrar a sessão, a interaction ativa é fechada automaticamente.

## 0.4 Dados pessoais separados (LGPD)

- `participants` guarda apenas `display_name` opcional.
- E-mail e telefone ficam em `participant_contacts`, gravados só com consentimento explícito (`consent_given_at`, `consent_purpose`). No MVP, o campo de contato é opcional e fica fora do fluxo principal de entrada.
- A IA nunca recebe `display_name`, e-mail ou telefone.

## 0.5 Escalas do feedback e do scorecard

- Utilidade geral (`overall_rating`): 0–10, única pergunta obrigatória.
- Clareza, atenção/engajamento, conteúdo e aplicabilidade: 1–5.
- O Speaker Scorecard exibe as dimensões na escala 1–5 (não converter para 0–10).
- "Didática" saiu do scorecard porque nenhuma pergunta a mede.
- "Interação" é exibida como taxa de participação (%), nunca como nota.

## 0.6 Banco de dados

- O schema inicial já existe em `supabase/migrations/20261002000000_init.sql` (tabelas, índices, RLS, triggers e funções). Revise, aplique e faça qualquer alteração por novas migrations.
- `profiles.id` é o próprio `auth.users.id` (sem coluna `user_id`) e é criado por trigger no signup, a partir de `raw_user_meta_data.name`.
- `sessions.join_code` é gerado pelo banco (6 caracteres sem ambíguos) e é único apenas entre sessões não encerradas, o que permite códigos personalizados como `IA2026`. Em caso de colisão, tentar de novo.
- `sessions.estimated_duration_minutes` guarda a duração estimada.
- `responses` tem `unique (interaction_id, participant_id)`. Uma resposta duplicada vira o estado "você já respondeu", não um erro genérico.
- Feedback só é aceito com a sessão em `completed`.

## 0.7 Versões e chaves

- Usar as versões estáveis atuais de Next.js, `@supabase/ssr` e `@supabase/supabase-js`, seguindo a documentação oficial (a convenção de middleware/proxy mudou entre versões do Next.js).
- Supabase com o modelo novo de chaves: publishable key no cliente, secret key apenas no servidor.
- Sem infraestrutura extra (Redis, filas) no MVP.

---

# 1. Objetivo do MVP

O MVP precisa permitir o fluxo completo:

1. Criar uma conta.
2. Criar uma palestra/sessão.
3. Adicionar interações.
4. Iniciar a sessão.
5. Gerar código curto e QR Code.
6. Participantes acessarem pelo celular sem instalar aplicativo.
7. Participantes responderem às interações.
8. O palestrante visualizar os resultados em tempo real.
9. Exibir resultados em uma tela própria para projetor.
10. Encerrar a sessão.
11. Coletar feedback pós-evento.
12. Visualizar analytics.
13. Gerar insights utilizando IA.
14. Visualizar histórico e evolução do palestrante.

O fluxo ponta a ponta deve funcionar antes de qualquer funcionalidade secundária.

---

# 2. Stack obrigatória

Utilize:

- Next.js
- TypeScript
- App Router
- Tailwind CSS
- shadcn/ui
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Realtime
- Vercel
- Zod
- React Hook Form quando fizer sentido

Para gráficos, utilize uma biblioteca adequada e leve.

Para QR Code, utilize uma biblioteca madura do ecossistema React/Next.js.

Não introduza tecnologias desnecessárias.

---

# 3. Princípios de arquitetura

Quero uma arquitetura:

- modular;
- limpa;
- tipada;
- fácil de manter;
- preparada para crescimento;
- sem overengineering.

Separe claramente:

- UI;
- domínio;
- acesso a dados;
- autenticação;
- realtime;
- analytics;
- IA.

Evite colocar regras de negócio diretamente em componentes de UI.

Crie serviços/hooks/utilitários quando isso melhorar a organização.

Use TypeScript de forma rigorosa.

Evite `any`.

Utilize validação com Zod nas entradas importantes.

---

# 4. Estrutura conceitual do produto

O produto possui três grandes momentos:

## Antes da palestra

O palestrante:

- cria a sessão;
- define título;
- define descrição;
- define data;
- cria interações;
- organiza a ordem das interações.

## Durante a palestra

O palestrante:

- inicia a sessão;
- mostra QR Code;
- mostra código de entrada;
- ativa interações;
- acompanha respostas em tempo real;
- visualiza gráficos;
- pode controlar a interação atual.

Os participantes:

- entram pelo celular;
- não precisam instalar aplicativo;
- não precisam necessariamente criar conta;
- respondem às interações.

## Depois da palestra

Os participantes podem:

- avaliar a palestra;
- avaliar clareza;
- avaliar conteúdo;
- avaliar engajamento;
- escrever comentários;
- informar o que poderia melhorar.

O sistema:

- consolida os dados;
- calcula métricas;
- identifica padrões;
- gera insights;
- recomenda melhorias.

---

# 5. Personas

## Speaker

Usuário que cria e apresenta as sessões.

Pode ser:

- palestrante;
- professor;
- consultor;
- instrutor;
- coach;
- facilitador;
- treinador corporativo.

## Participant

Pessoa que participa da sessão.

Não deve precisar de conta.

Pode responder anonimamente.

Opcionalmente pode fornecer:

- nome;
- email;
- telefone/WhatsApp.

---

# 6. Session

Uma `session` representa uma palestra, aula, workshop ou treinamento.

Exemplo:

```text
Título:
Como a IA está mudando o mercado de trabalho

Data:
2026-10-10

Duração:
60 minutos

Participantes:
120

Código:
IA2026
```

Status possíveis:

```text
draft
live
paused
completed
```

Fluxo:

```text
draft → live
live → paused
paused → live
live → completed
paused → completed
```

Uma sessão possui um código curto.

Exemplo:

```text
IA2026
```

URL pública:

```text
/join/IA2026
```

---

# 7. Interaction

Criar uma abstração `Interaction`.

Tipos iniciais:

```text
multiple_choice
rating
word_cloud
open_text
quiz
```

Arquitetura preparada para:

```text
ranking
scale
q_and_a
image_poll
matrix
emoji
yes_no
```

Cada interaction deve possuir:

```text
id
session_id
type
title
description
position
is_active
settings
created_at
updated_at
```

Use JSONB em `settings` quando fizer sentido para configurações específicas de cada tipo.

---

# 8. Multiple Choice

Exemplo:

> Você já utiliza IA no seu trabalho?

Opções:

- Sim
- Não
- Estou começando
- Uso bastante

O resultado deve ser mostrado em tempo real.

Exemplo:

```text
SIM             48%
COMEÇANDO       29%
NÃO             14%
USO BASTANTE     9%
```

Permitir:

- múltipla escolha simples;
- opcionalmente permitir múltiplas respostas futuramente.

No MVP, priorizar uma única resposta.

---

# 9. Rating

Exemplo:

> Quanto você entende sobre IA?

Escala:

```text
1 → 5
```

Permitir configuração de:

- mínimo;
- máximo;
- label inicial;
- label final.

---

# 10. Word Cloud

Exemplo:

> Qual palavra representa sua maior dificuldade com IA?

Coletar respostas abertas curtas.

Normalizar:

- lowercase;
- espaços;
- pontuação;
- palavras muito comuns.

Contabilizar frequência.

Mostrar as palavras mais frequentes visualmente.

Não implementar NLP complexo no MVP.

---

# 11. Open Text

Exemplo:

> Em uma frase, o que você espera aprender hoje?

Permitir respostas livres.

O presenter deve conseguir visualizar as respostas em tempo real.

Também deve ser possível consultar essas respostas no analytics posteriormente.

---

# 12. Quiz

Suportar:

- pergunta;
- alternativas;
- resposta correta;
- pontuação;
- timer opcional;
- tempo de resposta;
- resultado.

Exemplo:

```text
Qual dessas tecnologias utiliza Large Language Models?

A) ...
B) ...
C) ...
D) ...
```

Registrar:

- opção selecionada;
- se acertou;
- tempo de resposta;
- pontos.

Ranking pode ser simples no MVP.

---

# 13. Participant Flow

O fluxo deve ser extremamente simples.

```text
QR CODE
   ↓
Código
   ↓
Tela de entrada
   ↓
Nome opcional
   ↓
Entrar
   ↓
Visualizar interação ativa
   ↓
Responder
   ↓
Resposta registrada
```

A experiência do participante deve ser:

- mobile-first;
- rápida;
- limpa;
- sem distrações.

Não exigir cadastro.

---

# 14. Anonymous vs identified participants

Permitir participação anônima.

Separar conceitualmente:

```text
anonymous response
```

de:

```text
identified participant
```

Não exigir nome/email/telefone para responder interações normais.

Caso o usuário forneça contato, armazenar apenas o necessário, em `participant_contacts`, com consentimento registrado (seção 0.4).

Considerar LGPD.

Não coletar dados pessoais desnecessários.

---

# 15. Presenter Dashboard

Criar:

```text
/dashboard
```

Mostrar:

- quantidade de sessões;
- sessões recentes;
- média geral;
- média de satisfação;
- taxa média de participação;
- atalhos para criar sessão.

---

# 16. Criar Session

Route:

```text
/dashboard/sessions/new
```

Campos:

- título;
- descrição;
- data;
- horário;
- duração estimada.

Após criar:

```text
/dashboard/sessions/[id]
```

---

# 17. Session Builder

A página de edição deve permitir:

- editar informações;
- criar interaction;
- editar interaction;
- excluir interaction;
- reordenar interactions;
- visualizar preview;
- iniciar sessão.

Layout sugerido:

```text
┌────────────────────────────────────┐
│ Minha palestra                     │
│                                    │
│ [Informações] [Interações]         │
│                                    │
│ 1. Enquete                         │
│ 2. Quiz                            │
│ 3. Word Cloud                      │
│ 4. Pergunta aberta                 │
│                                    │
│ [+ Adicionar interação]            │
│                                    │
│ [Iniciar sessão]                   │
└────────────────────────────────────┘
```

---

# 18. Live Control Room

Route:

```text
/dashboard/sessions/[id]/live
```

Essa é uma das partes mais importantes.

A interface deve ser otimizada para uso durante uma palestra.

Mostrar:

- título;
- status;
- QR Code;
- código;
- participantes conectados;
- total de respostas;
- lista de interações;
- interaction atual;
- resultados em tempo real;
- controles.

Exemplo:

```text
SESSION LIVE

128 participantes

Código:
IA2026

Current interaction:

"Você já utiliza IA no trabalho?"

[Ativar]
[Encerrar]

Resultados:

Sim       48%
Não       14%
Começando 29%
Bastante   9%
```

---

# 19. Audience Display

Criar:

```text
/session/[id]/display
```

Essa tela será usada em:

- projetor;
- TV;
- segunda tela;
- monitor.

Ela deve ser visualmente limpa.

Exemplo:

```text
┌──────────────────────────────────────┐
│                                      │
│       VOCÊ JÁ USA IA NO DIA A DIA?  │
│                                      │
│       SIM       ████████     48%     │
│       NÃO       ███          14%     │
│       COMEÇANDO █████        29%     │
│                                      │
│             73 respostas             │
└──────────────────────────────────────┘
```

Atualização em tempo real.

---

# 20. Supabase Realtime

Utilizar Supabase Realtime.

O presenter e os participantes devem receber alterações sem refresh.

Para o MVP (detalhes na seção 0.2):

- Postgres Changes apenas em `session_live_state`, `interaction_results` e, para o dono da sessão, `responses`;
- Realtime Presence para "conectados agora";
- estruturar o código para permitir migração futura para Broadcast;
- evitar polling agressivo; ao reconectar, recarregar o estado atual do servidor.

Eventos importantes:

- participant entrou;
- interaction ativada;
- interaction encerrada;
- resposta recebida;
- sessão pausada;
- sessão encerrada.

---

# 21–30. Banco de dados e segurança

O schema completo está em `supabase/migrations/20261002000000_init.sql`. Esta seção resume o que existe; a migration é a fonte da verdade.

```text
profiles               perfil do speaker (id = auth.users.id)
sessions               palestra: status, join_code, scheduled_at, estimated_duration_minutes,
                       started_at, ended_at
interactions           perguntas/atividades: type, position, is_active, settings JSONB,
                       activated_at, closed_at
interaction_options    opções de multiple choice e quiz (is_correct, points)
participants           participante pseudônimo da sessão (display_name opcional)
participant_contacts   e-mail/telefone com consentimento (LGPD)
responses              uma por participante por interaction; value JSONB, aggregate_key
feedback               avaliação pós-evento (overall 0–10, dimensões 1–5)
insights               saída validada da IA, com confidence, provider, model, generation_id
session_live_state     estado público em tempo real (mantido por trigger)
interaction_results    agregados públicos em tempo real (mantidos por trigger)
```

## Settings por tipo de interaction (validar com Zod, um schema por tipo)

```text
multiple_choice  { }                                     opções em interaction_options
rating           { min: 1, max: 5, minLabel?, maxLabel? }
word_cloud       { maxLength: 30 }
open_text        { maxLength: 280, showOnDisplay: boolean }
quiz             { timerSeconds?: number }               opções com is_correct e points
```

## Formato de `responses.value` (sempre gravado pelo servidor)

```json
{ "optionId": "..." }
{ "value": 4 }
{ "text": "ansiedade", "normalized": "ansiedade" }
{ "text": "Quero aprender mais sobre IA" }
{ "optionId": "...", "isCorrect": true, "points": 100, "responseTimeMs": 4300 }
```

## Row Level Security (já implementado na migration)

### Speaker

Um speaker só pode:

- acessar, criar, editar e excluir as próprias sessions;
- gerenciar interactions e options das próprias sessions;
- ler participants, contatos, responses e feedback das próprias sessions;
- criar, ler e excluir insights das próprias sessions.

### Participant

- Não acessa o banco diretamente para escrita: entra, responde e envia feedback pelo servidor.
- Como anon, lê apenas `session_live_state` e `interaction_results` de sessões que já saíram do draft.
- Não vê dados de outros participantes nem de outras sessões.

### Regras gerais

- Nunca expor a secret key no frontend.
- Toda Server Action do speaker usa o cliente com a sessão do usuário (RLS ativo). A secret key é usada apenas nos fluxos do participante, sempre após validar o cookie assinado.

---

# 31. Rotas

Estrutura sugerida:

```text
/
 /login
 /signup

 /dashboard
 /dashboard/sessions
 /dashboard/sessions/new
 /dashboard/sessions/[id]
 /dashboard/sessions/[id]/live
 /dashboard/sessions/[id]/analytics

 /join/[code]

 /session/[id]/participate
 /session/[id]/display

 /feedback/[id]
```

---

# 32. Feedback pós-evento

Quando a sessão terminar, disponibilizar:

```text
/feedback/[id]
```

Experiência curta.

Perguntas:

1. De 0 a 10, quanto essa palestra foi útil para você? (obrigatória → `overall_rating`)
2. Clareza do palestrante, de 1 a 5 (`clarity_rating`)
3. Capacidade de manter sua atenção, de 1 a 5 (`engagement_rating`)
4. Qualidade do conteúdo, de 1 a 5 (`content_rating`)
5. O quanto você consegue aplicar o que viu, de 1 a 5 (`applicability_rating`)
6. Qual foi a parte mais valiosa? (opcional)
7. O que poderia ser melhor? (opcional)
8. Comentários adicionais. (opcional)

Só a primeira pergunta é obrigatória. As notas 1–5 devem ser botões grandes de toque, não sliders.

O feedback é vinculado ao participante pelo cookie quando ele existir; sem cookie, é aceito como anônimo. Um feedback por participante.

Não tornar o formulário cansativo.

Mobile-first.

---

# 33. Analytics

Route:

```text
/dashboard/sessions/[id]/analytics
```

Mostrar:

## Overview

- total de participantes;
- participantes únicos;
- total de respostas;
- response rate;
- participation rate;
- média geral;
- satisfação;
- clareza;
- conteúdo;
- engajamento;
- aplicabilidade.

---

# 34. Session Analytics

Mostrar os resultados de cada interaction.

Para multiple choice:

- distribuição;
- percentual;
- total.

Para rating:

- média;
- mediana quando possível;
- distribuição.

Para word cloud:

- termos;
- frequência.

Para open text:

- respostas;
- busca;
- agrupamento posterior por IA.

Para quiz:

- taxa de acerto;
- tempo médio;
- ranking simples.

---

# 35. Audience Pulse

Criar uma métrica simples de engajamento durante a palestra.

O MVP pode utilizar:

```text
respostas / participantes ativos
```

por interaction ou janela de tempo.

Mostrar um gráfico temporal.

Exemplo:

```text
ENGAJAMENTO

100 ┤                         ╭───╮
 80 ┤          ╭────╮       ╭╯   ╰╮
 60 ┤     ╭────╯    ╰───────╯     ╰──╮
 40 ┤─────╯                            ╰
 20 ┤
    └────────────────────────────────────
      10    20    30    40    50    60
```

Não afirmar que isso mede "atenção" diretamente.

Chamar de:

**Participation / Engagement Signal**

e deixar claro que é uma métrica baseada em participação.

---

# 36. Speaker Scorecard

Criar uma seção:

```text
Speaker Scorecard
```

Dimensões (média do feedback, escala 1–5):

- Clareza;
- Conteúdo;
- Engajamento;
- Aplicabilidade.

Mais um indicador separado, que não é nota:

- Participação: taxa de resposta às interações durante a sessão (%).

Exemplo:

```text
Clareza          4.6 / 5
Conteúdo         4.5 / 5
Engajamento      3.9 / 5
Aplicabilidade   4.7 / 5

Participação     78% das oportunidades de resposta
Utilidade geral  8.7 / 10
```

Mostrar também:

- quantidade de respostas;
- período;
- sessão analisada.

Não apresentar a métrica como verdade absoluta.

---

# 37. Histórico e evolução

Criar:

```text
/dashboard/analytics
```

Mostrar evolução das métricas entre sessões.

Exemplo:

```text
               Jan   Fev   Mar   Abr

Clareza        4.1   4.2   4.4   4.6
Engajamento    3.6   3.8   3.7   4.0
Participação   61%   66%   64%   72%
```

Mostrar quantidade de avaliações por sessão.

---

# 38. Insight mais importante

O sistema deve permitir identificar situações como:

```text
Clareza: 4.6 / 5
Participação: 52%
```

E explicar:

> "A clareza foi avaliada positivamente, enquanto o sinal de participação foi relativamente menor."

Não concluir automaticamente que o palestrante "é ruim" ou qualquer outra avaliação subjetiva.

A IA deve trabalhar com evidências.

---

# 39. AI Architecture

Criar uma camada abstrata:

```typescript
interface AIProvider {
  generateInsights(input: InsightInput): Promise<Insights>
}
```

Preparar para:

- Groq;
- OpenAI;
- Anthropic;
- outros providers.

O aplicativo deve funcionar sem IA caso as credenciais não estejam configuradas.

---

# 40. AI Input

Enviar dados agregados e necessários.

Exemplos:

- título;
- descrição;
- interactions;
- resultados;
- médias;
- participation rate;
- respostas abertas;
- feedback;
- comentários;
- evolução da participação.

Não enviar dados pessoais desnecessários.

---

# 41. AI Output

Retornar JSON estruturado.

Exemplo:

```json
{
  "summary": "Resumo da sessão.",
  "strengths": [
    {
      "title": "Aplicabilidade prática",
      "description": "Os participantes avaliaram positivamente os exemplos.",
      "evidence": [
        "72% avaliaram aplicabilidade com nota 9 ou 10"
      ]
    }
  ],
  "attention_points": [
    {
      "title": "Ritmo inicial",
      "description": "Alguns comentários indicaram que a introdução poderia ser mais curta.",
      "evidence": [
        "14 comentários mencionaram ritmo ou duração"
      ]
    }
  ],
  "recommendations": [
    {
      "title": "Adicionar uma interação no início",
      "description": "Considere inserir uma pergunta nos primeiros minutos.",
      "priority": "medium"
    }
  ]
}
```

Validar tudo com Zod.

Nunca confiar cegamente no JSON retornado pelo modelo.

---

# 42. Regras para AI Insights

A IA deve separar:

1. **Observed data**
2. **Interpretation**
3. **Recommendation**

Não inventar evidências.

Não inventar números.

Se houver poucos dados, dizer que existe baixa confiança.

Exemplo:

> "A amostra possui apenas 6 respostas; esse padrão deve ser interpretado com cautela."

---

# 43. IA como Speaker Coach

Futuramente, o sistema poderá agir como um coach baseado em dados.

Exemplo:

```text
SEU PONTO FORTE

Aplicabilidade

Os participantes mencionaram exemplos práticos
positivamente em várias respostas.

PONTO DE ATENÇÃO

Engajamento

A participação caiu nas interações finais.

RECOMENDAÇÃO

Experimente inserir uma interação curta antes
do último bloco da apresentação.
```

No MVP, implementar apenas análise pós-sessão.

---

# 44. Design System

Utilizar:

- Tailwind;
- shadcn/ui;
- cards;
- dialogs;
- tabs;
- dropdowns;
- toast;
- badges;
- progress bars;
- skeletons;
- empty states.

Visual:

- SaaS moderno;
- profissional;
- limpo;
- bastante espaço em branco;
- foco nos dados;
- gráficos fáceis de entender;
- sem excesso de cores.

Não transformar a interface em um dashboard visualmente poluído.

---

# 45. Presenter Mode

O presenter precisa conseguir operar a sessão com poucos cliques.

A interface deve privilegiar:

- interaction atual;
- próximo interaction;
- participantes;
- respostas;
- QR Code;
- código;
- controles rápidos.

Criar atalhos de teclado quando fizer sentido, mas isso é opcional no MVP.

---

# 46. Mobile Participant Experience

O participante provavelmente estará segurando o celular durante a palestra.

Portanto:

- botões grandes;
- textos curtos;
- pouco scroll;
- feedback visual imediato;
- loading mínimo;
- animações discretas;
- evitar formulários longos.

---

# 47. Loading / Error States

Implementar estados para:

- carregando;
- sessão inexistente;
- sessão encerrada;
- interaction não disponível;
- conexão perdida;
- resposta enviada;
- resposta duplicada;
- sessão expirada;
- erro de autenticação.

---

# 48. Duplicate Responses

Definir comportamento claro.

Por padrão:

- um participante responde uma vez por interaction.

Se necessário, preparar arquitetura para permitir múltiplas respostas futuramente.

---

# 49. Demo Data

Criar seed/demo data.

Criar:

## Speaker

```text
Demo Speaker
```

## Session 1

```text
Como a IA está mudando o mercado
```

## Session 2

```text
Comunicação para líderes
```

Cada sessão deve possuir:

- participants;
- interactions;
- responses;
- feedback;
- dados suficientes para popular analytics.

Criar dados realistas.

---

# 50. Environment Variables

Criar:

```text
.env.example
```

Com:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=

# Apenas no servidor
SUPABASE_SECRET_KEY=
PARTICIPANT_TOKEN_SECRET=

AI_PROVIDER=
AI_API_KEY=
AI_MODEL=
```

O arquivo `.env.example` já existe na raiz do repositório.

Não commitar secrets.

---

# 51. Segurança

Garantir:

- RLS;
- validação server-side;
- autorização server-side;
- limites contra abuso sem infraestrutura extra no MVP: tamanho máximo de texto, uma resposta por participante (constraint), limite de participantes por sessão e de entradas por cookie;
- sanitização;
- não expor secrets;
- não confiar em IDs enviados pelo cliente;
- verificar ownership;
- proteger endpoints públicos contra abuso básico.

---

# 52. LGPD

Considerar desde o início:

- consentimento quando necessário;
- minimização de dados;
- possibilidade de participação anônima;
- não coletar dados pessoais sem necessidade;
- separar dados de contato de respostas quando possível;
- permitir exclusão futura;
- deixar arquitetura preparada para políticas de retenção.

Não precisa implementar um centro completo de privacidade no MVP.

---

# 53. O que NÃO implementar no MVP

Não implementar agora:

- pagamentos;
- assinatura;
- Stripe;
- WhatsApp;
- email automático;
- integração PowerPoint;
- integração Google Slides;
- editor completo de apresentações;
- gravação de vídeo;
- transcrição;
- análise de voz;
- análise de slides;
- certificados;
- organizações;
- equipes;
- marketplace;
- app mobile nativo.

A arquitetura deve permitir essas funcionalidades futuramente.

---

# 54. Roadmap futuro

## V2

- email pós-evento;
- WhatsApp;
- templates;
- banco de perguntas;
- IA gerando perguntas;
- IA gerando quizzes;
- importação de PDF;
- comparação de sessões;
- speaker evolution;
- gamificação.

## V3

- PowerPoint;
- Google Slides;
- análise de gravação;
- transcrição;
- análise de voz;
- palavras repetidas;
- velocidade da fala;
- pausas;
- estrutura da apresentação;
- cruzamento entre vídeo + respostas + feedback.

## V4

- equipes;
- organizações;
- múltiplos speakers;
- analytics corporativo;
- planos pagos;
- API;
- integrações.

---

# 55. Filosofia do produto

O produto não deve apenas perguntar:

> "As pessoas gostaram?"

Ele deve tentar responder:

> "O que aconteceu durante essa palestra?"

> "O que as pessoas entenderam?"

> "Onde participaram mais?"

> "Onde participaram menos?"

> "O que consideraram valioso?"

> "O que poderia ser melhor?"

> "Quais padrões estão aparecendo em várias palestras?"

> "O que o palestrante deveria experimentar na próxima apresentação?"

---

# 56. Métricas principais

O MVP deve acompanhar:

### Participation Rate

```text
participantes que responderam
/
participantes conectados
```

### Response Rate

```text
respostas
/
oportunidades de resposta
```

### Average Rating

Média das avaliações.

### Engagement Signal

Sinal baseado na participação ao longo da sessão.

### Feedback Response Rate

```text
feedbacks
/
participantes
```

Não confundir essas métricas com medidas diretas de atenção, aprendizado ou qualidade objetiva.

---

# 57. UX do produto

A experiência do speaker deve ser:

```text
CRIAR
  ↓
PREPARAR
  ↓
APRESENTAR
  ↓
INTERAGIR
  ↓
ANALISAR
  ↓
APRENDER
  ↓
MELHORAR
```

Esse ciclo deve aparecer naturalmente na arquitetura do produto.

---

# 58. Fases de implementação

Não tente construir tudo simultaneamente.

## FASE 1 — Setup

- Next.js;
- TypeScript;
- Tailwind;
- shadcn;
- Supabase;
- Auth;
- estrutura inicial.

Validar:

```bash
npm run lint
npm run build
```

---

## FASE 2 — Database

A migration inicial já existe. Nesta fase:

- revisar `supabase/migrations/20261002000000_init.sql`;
- aplicar no projeto Supabase (local com Supabase CLI ou remoto);
- gerar os tipos TypeScript do banco (`supabase gen types`);
- criar o seed (seção 49);
- validar o RLS com testes manuais: speaker A não vê dados do speaker B; anon não escreve em nenhuma tabela; anon não lê `responses`.

---

## FASE 3 — Authentication

Implementar:

- signup;
- login;
- logout;
- sessão;
- proteção das rotas.

---

## FASE 4 — Sessions

Implementar:

- listar;
- criar;
- editar;
- excluir;
- visualizar;
- status.

---

## FASE 5 — Interaction Builder

Implementar:

- criar;
- editar;
- excluir;
- reordenar;
- tipos;
- options.

---

## FASE 6 — Participant Flow

Implementar:

```text
/join/[code]
```

e:

```text
/session/[id]/participate
```

---

## FASE 7 — Realtime

Implementar:

- interaction ativa;
- responses;
- participant presence;
- resultados.

---

## FASE 8 — Presenter Control Room

Implementar:

- controle;
- QR;
- código;
- resultados;
- participantes.

---

## FASE 9 — Audience Display

Criar:

```text
/session/[id]/display
```

---

## FASE 10 — Feedback

Implementar:

```text
/feedback/[id]
```

---

## FASE 11 — Analytics

Criar dashboard completo.

---

## FASE 12 — AI

Implementar:

- provider abstraction;
- agregação de dados;
- prompt;
- structured output;
- validação Zod;
- insights.

---

## FASE 13 — Polish

Revisar:

- UX;
- responsividade;
- loading;
- erros;
- segurança;
- acessibilidade;
- performance.

---

# 59. Critério de aceitação do MVP

O MVP será considerado funcional quando for possível:

### Speaker

1. Criar conta.
2. Fazer login.
3. Criar palestra.
4. Criar multiple choice.
5. Criar rating.
6. Criar word cloud.
7. Criar open text.
8. Criar quiz.
9. Iniciar sessão.
10. Mostrar QR Code.
11. Mostrar código.
12. Controlar interaction.
13. Visualizar resultados em tempo real.
14. Abrir audience display.
15. Encerrar sessão.
16. Visualizar analytics.
17. Visualizar feedback.
18. Gerar AI insights.

### Participant

1. Escanear/acessar QR Code.
2. Entrar na sessão.
3. Informar nome opcional.
4. Responder.
5. Ver confirmação.
6. Continuar acompanhando a interação atual.
7. Responder feedback.

---

# 60. Qualidade do código

Antes de finalizar cada fase:

- executar TypeScript;
- executar lint;
- executar build;
- verificar erros;
- corrigir warnings importantes;
- revisar componentes;
- evitar duplicação;
- verificar RLS;
- testar fluxos principais.

Não deixar código propositalmente quebrado para "terminar depois".

---

# 61. Processo de desenvolvimento com Claude Code

Antes de implementar:

1. Analise o repositório. Ele já contém este documento, `CLAUDE.md`, `.env.example` e a migration inicial.
2. Identifique o que já existe.
3. Não sobrescreva código existente sem necessidade (ao rodar `create-next-app`, preserve esses arquivos).
4. Apresente a arquitetura proposta.
5. Crie um plano de implementação.
6. Comece pela FASE 1.
7. Implemente.
8. Valide.
9. Faça commit (Conventional Commits, em português) e push.
10. Só depois avance.

Após cada fase, informe:

```text
FASE:
STATUS:

Implementado:
- ...
- ...
- ...

Validação:
- TypeScript: OK/ERRO
- Lint: OK/ERRO
- Build: OK/ERRO

Próxima fase:
...
```

---

# 62. Importante sobre escopo

Priorize sempre o fluxo principal.

Se houver dúvida entre:

```text
implementar mais funcionalidades
```

e:

```text
deixar o fluxo principal mais sólido
```

escolha a segunda opção.

Não adicione funcionalidades fora do escopo sem necessidade.

---

# 63. Resultado esperado

Quero terminar com uma aplicação SaaS funcional, moderna e preparada para deploy na Vercel.

O fluxo principal deve ser extremamente sólido:

```text
Speaker
   ↓
Create Session
   ↓
Create Interactions
   ↓
Start Session
   ↓
QR Code
   ↓
Participants Join
   ↓
Realtime Interaction
   ↓
Responses
   ↓
Feedback
   ↓
Analytics
   ↓
AI Insights
   ↓
Speaker Improvement
```

O produto deve transmitir a sensação de:

> **"Finalmente consigo entender o que realmente aconteceu durante minha palestra."**

Comece agora pela análise do projeto existente e pela proposta de arquitetura.

Não implemente tudo de uma vez.

Siga as fases acima e valide cada etapa antes de continuar.
