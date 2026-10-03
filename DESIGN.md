---
name: PulseStage
description: "Roteiro com deixas: o caderno do diretor de cena para quem apresenta a um público."
colors:
  background: "oklch(0.985 0.002 250)"
  foreground: "oklch(0.2 0.012 260)"
  card: "oklch(1 0 0)"
  primary: "oklch(0.5 0.13 152)"
  primary-foreground: "oklch(0.99 0.004 152)"
  muted: "oklch(0.955 0.004 250)"
  muted-foreground: "oklch(0.47 0.012 260)"
  accent: "oklch(0.95 0.006 250)"
  border: "oklch(0.9 0.005 250)"
  input: "oklch(0.86 0.006 250)"
  ring: "oklch(0.6 0.13 152)"
  destructive: "oklch(0.56 0.21 27)"
  standby: "oklch(0.78 0.15 70)"
  standby-foreground: "oklch(0.3 0.06 60)"
  highlight: "oklch(0.93 0.13 102)"
  rev-blue: "oklch(0.91 0.045 240)"
  rev-pink: "oklch(0.92 0.045 5)"
  rev-yellow: "oklch(0.95 0.08 100)"
  rev-green: "oklch(0.92 0.055 152)"
  rev-gold: "oklch(0.88 0.09 78)"
  rev-foreground: "oklch(0.22 0.012 260)"
  rev-blue-ink: "oklch(0.46 0.13 245)"
  rev-pink-ink: "oklch(0.48 0.17 8)"
  rev-yellow-ink: "oklch(0.46 0.1 95)"
  rev-green-ink: "oklch(0.46 0.12 152)"
  rev-gold-ink: "oklch(0.48 0.11 65)"
  chart-1: "oklch(0.5 0.13 245)"
  chart-2: "oklch(0.55 0.17 8)"
  chart-3: "oklch(0.52 0.13 152)"
  chart-4: "oklch(0.65 0.14 70)"
  background-dark: "oklch(0.13 0 0)"
  foreground-dark: "oklch(0.95 0.004 250)"
  card-dark: "oklch(0.175 0 0)"
  muted-dark: "oklch(0.235 0 0)"
  muted-foreground-dark: "oklch(0.72 0 0)"
  border-dark: "oklch(1 0 0 / 11%)"
  primary-dark: "oklch(0.76 0.15 152)"
  primary-foreground-dark: "oklch(0.17 0.02 152)"
  standby-dark: "oklch(0.8 0.15 72)"
  highlight-dark: "oklch(0.86 0.15 100)"
  destructive-dark: "oklch(0.7 0.19 22)"
typography:
  display:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "clamp(2.6rem, 6vw, 5.5rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "clamp(2.1rem, 4.4vw, 3.9rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "clamp(1.9rem, 3.4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  script-body:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.1em"
  ui-label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  gutter: "16px"
  gutter-md: "24px"
  section: "80px"
  section-md: "112px"
  act-gap: "48px"
  act-gap-lg: "64px"
  container: "1152px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.ui-label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-lg:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.accent}"
  button-cue:
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-cue-hover:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
  badge-live:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  badge-standby:
    backgroundColor: "{colors.standby}"
    textColor: "{colors.standby-foreground}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  type-tag-poll:
    backgroundColor: "{colors.rev-blue}"
    textColor: "{colors.rev-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  type-tag-rating:
    backgroundColor: "{colors.rev-pink}"
    textColor: "{colors.rev-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  type-tag-word-cloud:
    backgroundColor: "{colors.rev-yellow}"
    textColor: "{colors.rev-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  type-tag-open-text:
    backgroundColor: "{colors.rev-green}"
    textColor: "{colors.rev-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  type-tag-quiz:
    backgroundColor: "{colors.rev-gold}"
    textColor: "{colors.rev-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  script-page:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "32px"
  input:
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "40px"
---

# Design System: PulseStage

## Overview

**Creative North Star: "Roteiro com deixas"**

A palestra é um espetáculo com roteiro, e o PulseStage é o caderno do diretor de cena. A superfície é uma página de roteiro branca (branco frio, nunca creme) sobre um campo quase branco e frio; a voz de roteiro (Courier Prime) fala nas falas-manchete, nos números de deixa, nos códigos e nos dados tabulares, enquanto a Geist cuida de toda a interface operacional. A cor não decora: ela tem função de palco. Verde é a luz de deixa VAI (ação principal e estado ao vivo), âmbar é atenção (próxima deixa, pausa), amarelo é o marca-texto do diretor, e cinco papéis de revisão coloridos identificam os cinco tipos de interação em todo o produto.

No escuro, a página vira coxia: palco preto neutro, quase sem matiz, com as mesmas cores funcionando como fita de marcação, mais claras e mais saturadas. A densidade é de documento de trabalho: colunas de leitura curtas, numerais tabulares, rubricas entre parênteses, linhas tracejadas onde o roteiro divide cenas. Recusa explícita do visual SaaS índigo anterior e do hero dividido com captura de tela mais fileira de cards de recursos.

Honestidade de dados é parte da linguagem visual: a confiança de uma nota é desenhada pelo peso do sublinhado, amostras pequenas recebem traço tracejado, e todo estado ao vivo vem com rótulo de texto além da cor.

**Key Characteristics:**
- Página de roteiro branca, sombra suave, cantos quase retos (4px).
- Duas vozes: Courier Prime (roteiro) e Geist (interface).
- Verde VAI, âmbar atenção, amarelo marca-texto; cada um com um só significado.
- Cinco papéis de revisão, um por tipo de interação, com tinta correspondente.
- Coxia neutra no escuro; borda substitui a sombra.
- Estado sempre rotulado em texto; confiança como peso de linha.

## Colors

Campo frio e neutro, tinta quase preta, e cores de palco com significado fixo.

### Primary
- **Luz de deixa VAI** (`primary`; `primary-dark` na coxia): ação principal (botão padrão, CTA "Criar minha sessão"), estado ao vivo (badge `live`), lâmpada de deixa acesa, resposta correta do quiz, foco (`ring`), cursor e `accent-color` de controles nativos. Nunca decoração.

### Secondary
- **Luz de deixa âmbar** (`standby`, texto `standby-foreground`): atenção, próxima deixa, sessão pausada (badge `warning`), barras de participação baixa (< 60%) no sinal de participação.
- **Marca-texto do diretor** (`highlight`, texto `highlight-foreground`): a última frase da fala-manchete (`<mark>`), a seleção de texto (`::selection`) e, no escuro, o número do ato ("Ato I.") nos títulos de ato.

### Tertiary
- **Papéis de revisão** (`rev-blue`, `rev-pink`, `rev-yellow`, `rev-green`, `rev-gold`, sempre com texto `rev-foreground`): um papel por tipo de interação. Enquete = azul, Escala = rosa, Nuvem de palavras = amarelo, Pergunta aberta = verde, Quiz = dourado.
- **Tintas de revisão** (`rev-*-ink`): a mesma família em tom escuro (claro no escuro) para texto e traço sobre o campo: rótulo do tipo na folha de deixas, nome da cor do papel, barras da enquete-demo.
- **Séries de gráfico** (`chart-1..4`): azul, rosa, verde, âmbar alinhados às tintas, só para séries do gráfico de evolução.

### Neutral
- **Campo frio** (`background`): fundo da aplicação; faixas alternadas usam `muted` a 40%.
- **Página de roteiro** (`card`): branco puro, a superfície onde o roteiro é escrito.
- **Tinta** (`foreground`): texto, contorno do botão de deixa, barra líder nos resultados.
- **Lápis** (`muted-foreground`): rubricas, metadados, legendas, estados executados.
- **Pauta** (`border`, `input`): divisões, tabela, campos. Tracejada para separar cenas.
- **Coxia** (`background-dark`, `card-dark`, `muted-dark`): pretos neutros sem matiz; `border-dark` é branco a 11%.
- **Erro** (`destructive`): só ações destrutivas e erros.

### Named Rules
**The One Meaning Rule.** Verde é VAI, âmbar é atenção, amarelo é marca-texto. Nenhuma dessas cores é usada para outra coisa, e nenhuma decora.

**The Revision Paper Rule.** Cada tipo de interação tem um papel e só um, igual no construtor, na sala ao vivo, no analytics e na landing (`TYPE_PAPER`). Um tipo novo exige um papel novo; nunca reaproveite um existente.

**The White Page Rule.** A página do roteiro é branca e fria. Creme, bege ou papel envelhecido estão fora deste mundo.

## Typography

**Display Font:** Courier Prime (com Courier New, monospace), pesos 400/700, itálico.
**Body Font:** Geist (com ui-sans-serif, system-ui, sans-serif).
**Label/Mono Font:** Courier Prime, em caixa alta espaçada.

**Character:** A Courier Prime é a voz do roteiro: personagem em caixa alta, fala em negrito, rubrica entre parênteses em itálico. A Geist é a voz do sistema: botões, formulários, explicações, perguntas exibidas ao público.

### Hierarchy
- **Display** (700, `clamp(2.6rem, 6vw, 5.5rem)`, 0.98): fecho da página ("A próxima deixa é sua."). Uma vez por página.
- **Headline** (700, `clamp(2.1rem, 4.4vw, 3.9rem)`, 1.05): a fala-manchete do hero, precedida do personagem ("PALESTRANTE.") na margem.
- **Title** (700, `clamp(1.9rem, 3.4vw, 3rem)`, 1.05): títulos de ato ("Ato I. Antes: escreva o roteiro"); o número do ato em `muted-foreground`.
- **Script body** (400, 1rem, 1.625): rubricas e prosa de cena, máximo 58–60ch.
- **Body** (400, 1rem a 1.125rem, 1.625): explicações em Geist, máximo ~52ch em blocos estreitos e `max-w-xl` nos parágrafos de seção.
- **Label** (700, 0.75rem, 0.1em, caixa alta): números e estados de deixa, rótulos de tipo, cabeçalhos de tabela, slugs de cena.
- **UI label** (500, 0.875rem): botões e rótulos de formulário.

### Named Rules
**The Two Voices Rule.** Courier Prime para o que pertence ao roteiro (falas-manchete, números de deixa, códigos como `IA2026`, dados tabulares, slugs de cena); Geist para o que o usuário opera ou lê como instrução. Pergunta exibida ao público é Geist, mesmo dentro de uma página em Courier.

**The No Kicker Rule.** Nenhum rótulo pequeno em caixa alta sobre um título. Rótulos em caixa alta só existem como dispositivos do roteiro com função própria: slug de cena, número de deixa, nome do tipo, cabeçalho de tabela.

**The Tabular Rule.** Todo número que muda ou se compara usa `tabular-nums`.

## Layout

Container de 1152px (`max-w-6xl`) com calha de 16px, 24px a partir de 768px. Seções separadas por fio superior (`border-t`), com faixas alternadas em `muted/40`; respiro vertical de 80px, 112px a partir de 768px. Cada ato é uma grade de duas colunas assimétricas a partir de 1024px (`2fr 3fr`, invertida para `3fr 2fr` no ato seguinte), com espaço de 48px, 64px no desktop.

A página do roteiro no hero tem margem de deixas de 13rem à esquerda (furos de fichário, deixa, botão VAI) e o texto à direita; a fala recua 9rem para abrir espaço ao nome do personagem. No celular, a margem de deixas vira uma faixa horizontal acima da fala, separada por fio tracejado. Os papéis de revisão se empilham com sobreposição de 8px e recuo progressivo de 0.75rem por folha.

## Elevation & Depth

Híbrido por tema. No claro, as superfícies de papel se elevam só por sombra suave e longa, sem borda; no escuro (coxia), a sombra some na escuridão e uma borda fina de 11% de branco faz o contorno (`dark:border`). Não há sombras duras nem deslocadas.

### Shadow Vocabulary
- **Página do roteiro** (`box-shadow: 0 24px 48px -28px color-mix(in oklch, var(--foreground) 35%, transparent)`): a folha do hero.
- **Folha solta** (`box-shadow: 0 24px 48px -32px color-mix(in oklch, var(--foreground) 40%, transparent)`): folha de deixas, notas do diretor.
- **Papel de revisão** (`box-shadow: 0 10px 24px -18px color-mix(in oklch, var(--foreground) 45%, transparent)`): folhas empilhadas por tipo.
- **Halo da lâmpada** (`box-shadow: 0 0 0 4px color-mix(in oklch, var(--primary|--standby) 30%, transparent)`): lâmpada de deixa acesa.
- **Tecla** (`box-shadow: inset 0 -2px 0 var(--border)`): `<kbd>`.

### Named Rules
**The Paper Not Box Rule.** No claro, papel tem sombra e não tem borda; no escuro, tem borda e não depende de sombra.

## Shapes

Cantos quase retos: superfícies de papel e etiquetas de tipo em 4px (`rounded-sm`), botões, badges e campos em 6px. Círculos completos só para lâmpadas de deixa, furos de fichário e trilhos de barra. Fios tracejados dividem cenas (margem de deixas, rubrica do telão, placeholder da demo); fios contínuos dividem seções e linhas de tabela.

## Components

### Buttons
- **Shape:** cantos suaves (6px).
- **Primary:** fundo `primary`, texto `primary-foreground`, Geist 500, 36px de altura (44px no `lg` dos CTAs); hover em `primary` a 90%.
- **Hover / Focus:** transição de cor; foco com anel de 2px em `ring` e afastamento de 2px.
- **Outline / Ghost:** outline com borda `input` sobre `background`; ghost transparente com hover `accent`. Navegação do topo usa ghost.
- **Botão de deixa (VAI):** contorno de 2px em tinta, Courier Prime negrito em caixa alta, lâmpada à esquerda; no hover inverte para tinta cheia. Desabilitado enquanto a deixa corre.

### Chips
- **Etiqueta de tipo (`TypeTag`):** papel de revisão do tipo, texto `rev-foreground`, Courier Prime 0.75rem negrito em caixa alta, 4px. Sempre com o nome do tipo escrito.
- **Badges de estado:** `live` = verde VAI; `warning` = âmbar (pausa); sempre com texto.

### Cards / Containers
- **Corner Style:** 4px nas superfícies de papel.
- **Background:** `card` (branco) sobre `background` ou `muted/40`.
- **Shadow Strategy:** ver Paper Not Box.
- **Border:** só no escuro.
- **Internal Padding:** 24px, 32px a partir de 640px; página do hero 20px a 64px conforme largura.

### Inputs / Fields
- **Style:** borda `input`, fundo transparente, 6px, 40px de altura.
- **Focus:** borda `ring` com anel de 3px em `ring` a 40%.
- **Disabled:** 50% de opacidade, cursor bloqueado.

### Navigation
- Logo à esquerda; à direita, ghost "Como funciona" (oculto no celular), alternador de tema, ghost "Entrar" e primário "Criar conta" (oculto no celular).

### Lâmpada de deixa
Círculo de 16px com contorno de 2px. Apagada: tinta a 10–25%. Atenção: âmbar com halo. VAI: verde com halo. Transição de 300ms em cor e halo. É decorativa para leitores de tela (`aria-hidden`): o estado é sempre escrito ao lado ("Em espera", "Atenção", "VAI", "Executada").

### Barras de resultado
Trilho `muted` arredondado; barra líder em tinta (`foreground`), demais em tinta a 35%, resposta correta do quiz em `primary` com "✓" no rótulo. Percentual tabular ao lado. Largura anima 700ms ease-out.

### Notas com confiança
Sublinhado de 2px em tinta cheia para confiança alta, tinta a 50% para média, 1px tracejado a 40% para baixa; sempre seguido de "confiança X · N respostas".

## Do's and Don'ts

### Do:
- **Do** usar `primary` só para ação principal, ao vivo, correto e foco.
- **Do** marcar cada tipo de interação com seu papel de revisão (`TYPE_PAPER`) em toda tela onde o tipo aparece.
- **Do** escrever o estado ao lado de toda cor de estado (lâmpada, badge, barra).
- **Do** desenhar confiança como peso de sublinhado: contínuo e pesado para amostra grande, tracejado e fino para amostra pequena, com a amostra escrita.
- **Do** usar Courier Prime para códigos, números de deixa e numerais tabulares; Geist para botões, formulários e perguntas ao público.
- **Do** dar às superfícies de papel sombra suave no claro e borda fina no escuro.
- **Do** respeitar `prefers-reduced-motion` (regra global; a demo pula direto ao resultado).

### Don't:
- **Don't** usar rótulos kicker ou eyebrow sobre títulos.
- **Don't** usar creme, bege ou papel envelhecido para a página.
- **Don't** reutilizar um papel de revisão para outra coisa que não o seu tipo.
- **Don't** usar verde, âmbar ou amarelo como decoração.
- **Don't** comunicar estado só por cor.
- **Don't** pôr borda em superfícies de papel no tema claro.
- **Don't** voltar ao índigo SaaS nem ao hero dividido com captura de tela e fileira de cards de recursos.
