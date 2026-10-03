# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Speaker (quem apresenta):** palestrantes de eventos, professores, instrutores, consultores, coaches, facilitadores e treinadores corporativos, com peso igual na comunicação. Cria a sessão antes, opera a sala ao vivo durante (muitas vezes num notebook ao lado do palco, com passador de slides) e analisa depois.
- **Participant (audiência):** qualquer pessoa na plateia, no celular, sem conta e sem baixar app. Nome opcional; pode responder anonimamente.
- **Projetor:** tela pública (projetor, TV, segunda tela) vista de longe por toda a sala.

## Product Purpose

Plataforma web de interação em tempo real para quem apresenta para um público: enquetes, escalas, nuvem de palavras, perguntas abertas e quiz respondidos pelo celular, resultados ao vivo no projetor, feedback pós-evento e analytics. Sucesso é o speaker entender o que aconteceu na apresentação e fazer a próxima melhor.

Conceito central: **Audience → Interaction → Data → Insight → Improvement**.
Proposta de valor: **“Seu público fala. Você entende. Sua próxima palestra fica melhor.”**

## Positioning

Não é mais um clone de Mentimeter, Slido ou AhaSlides. A interação ao vivo é o meio; o diferencial é transformar os dados de durante e depois da sessão em inteligência para melhorar as próximas apresentações: sinal de participação ao longo da sessão, scorecard do feedback, evolução entre sessões e insights com IA baseados só nos dados da sessão.

## Operating Context

- Ciclo do speaker: criar → preparar → apresentar → interagir → analisar → aprender → melhorar.
- Ao vivo: sala de controle no notebook, tela do projetor em outra aba/tela, audiência entra por QR Code ou código curto (ex.: `IA2026`), seta → do teclado avança interações.
- Depois: o público avalia a sessão (utilidade 0–10 obrigatória; clareza, engajamento, conteúdo e aplicabilidade 1–5) e o speaker vê analytics e gera insights.
- Idioma: português do Brasil.

## Capabilities and Constraints

- Cinco tipos de interação: Enquete, Escala, Nuvem de palavras, Pergunta aberta, Quiz (com pontos, tempo e ranking).
- Login do speaker por e-mail/senha ou Google. Participantes sem conta (cookie assinado), uma resposta por interação.
- Métricas medem participação, não atenção nem aprendizado; nunca apresentá-las como tal.
- A IA recebe só dados agregados e trechos de respostas, nunca nomes ou contatos.
- LGPD: contato do participante opcional, com consentimento, separado das respostas.
- Preço: **grátis durante o beta**. Não prometer como será depois; planos pagos estão no roadmap e não decididos.
- Stack: Next.js 16 (App Router), Tailwind v4, componentes estilo shadcn escritos à mão, Supabase, tema claro/escuro.

## Brand Commitments

- Nome: PulseStage. Tagline e proposta de valor acima.
- Tom: profissional, claro, honesto sobre o que os dados significam; sem exagero.

## Evidence on Hand

- O próprio produto: telas reais (sala ao vivo, projetor, participante, analytics) e dados de demonstração em `supabase/seed.sql`.
- **Não existem** depoimentos, logos de clientes, números de uso, cases ou imprensa. Não fabricar nenhum deles.

## Product Principles

1. O fluxo principal ao vivo é sagrado: poucos cliques, nada que atrapalhe quem está no palco.
2. Participar leva segundos: sem conta, sem app, botões grandes.
3. Dados honestos: métricas explicadas pelo que medem, confiança proporcional à amostra.
4. Melhoria contínua é o produto: cada sessão deve ensinar algo para a próxima.
5. Privacidade por padrão: anonimato possível, mínimo de dados pessoais.

## Accessibility & Inclusion

- Participante no celular, muitas vezes em pé e com rede instável: alvos grandes, pouco texto, feedback imediato.
- Projetor lido de longe e em salas claras: contraste alto e tipografia grande.
- Respeitar `prefers-reduced-motion` (já há regra global em `globals.css`).
