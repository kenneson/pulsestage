---
name: PulseStage
description: "Campus: interação ao vivo com cara de universidade e de empresa, acolhedora para escolas."
colors:
  background: "oklch(0.982 0.005 255)"
  foreground: "oklch(0.22 0.035 262)"
  card: "oklch(1 0 0)"
  primary: "oklch(0.52 0.19 262)"
  primary-foreground: "oklch(0.99 0.005 262)"
  muted: "oklch(0.955 0.01 258)"
  muted-foreground: "oklch(0.48 0.025 262)"
  accent: "oklch(0.95 0.014 258)"
  border: "oklch(0.905 0.012 258)"
  input: "oklch(0.86 0.015 258)"
  ring: "oklch(0.6 0.17 262)"
  destructive: "oklch(0.56 0.21 27)"
  standby: "oklch(0.78 0.15 70)"
  standby-foreground: "oklch(0.3 0.06 60)"
  highlight: "oklch(0.92 0.13 98)"
  rev-blue: "oklch(0.91 0.045 240)"
  rev-pink: "oklch(0.92 0.045 5)"
  rev-yellow: "oklch(0.95 0.08 100)"
  rev-green: "oklch(0.92 0.055 152)"
  rev-gold: "oklch(0.88 0.09 78)"
  rev-violet: "oklch(0.9 0.05 300)"
  rev-foreground: "oklch(0.22 0.012 260)"
  rev-blue-ink: "oklch(0.46 0.13 245)"
  rev-pink-ink: "oklch(0.48 0.17 8)"
  rev-yellow-ink: "oklch(0.46 0.1 95)"
  rev-green-ink: "oklch(0.46 0.12 152)"
  rev-gold-ink: "oklch(0.48 0.11 65)"
  rev-violet-ink: "oklch(0.47 0.15 300)"
  chart-1: "oklch(0.5 0.13 245)"
  chart-2: "oklch(0.55 0.17 8)"
  chart-3: "oklch(0.52 0.13 152)"
  chart-4: "oklch(0.65 0.14 70)"
  background-dark: "oklch(0.16 0.03 264)"
  foreground-dark: "oklch(0.96 0.008 258)"
  card-dark: "oklch(0.205 0.035 264)"
  muted-dark: "oklch(0.26 0.035 264)"
  muted-foreground-dark: "oklch(0.74 0.025 258)"
  border-dark: "oklch(1 0 0 / 12%)"
  primary-dark: "oklch(0.72 0.15 258)"
  primary-foreground-dark: "oklch(0.17 0.04 264)"
  standby-dark: "oklch(0.8 0.15 72)"
  highlight-dark: "oklch(0.86 0.15 100)"
  destructive-dark: "oklch(0.7 0.19 22)"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 6vw, 5.5rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.1rem, 4.4vw, 3.9rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.9rem, 3.4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  script-body:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.1em"
  ui-label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
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
  type-tag-ranking:
    backgroundColor: "{colors.rev-violet}"
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

**Creative North Star: "Campus"**

O PulseStage serve a sala de aula da universidade, a reunião da empresa e a turma do ensino fundamental com a mesma
ferramenta. A cara precisa passar a confiança de um sistema institucional e, ao mesmo tempo, a leveza de algo que um
aluno de 12 anos usa sem medo. Por isso: fundo claro levemente azulado, cartões brancos com cantos arredondados, tinta
azul-marinho, um azul acadêmico como cor de ação e o amarelo de marca-texto como único acento quente. A diversão fica
no conteúdo (quiz com formas e cores, avatares, ranking, sorteio), não no chrome da interface.

No escuro, a interface vira um auditório com as luzes apagadas: azul-marinho profundo, não preto puro, com as mesmas
cores mais claras. O telão do projetor usa sempre esse escuro (classe `dark`), com contraste alto para ser lido do fundo
da sala.

Substitui a identidade anterior "Roteiro com deixas" (Courier Prime, verde VAI, papel de roteiro), trocada em
2026-10-12 a pedido do dono por algo mais universitário e corporativo, sem deixar de fora as escolas.

**Key Characteristics:**
- Duas fontes: Plus Jakarta Sans (`font-display`) para títulos, numerais e códigos; Geist (`font-sans`) para interface e
  texto corrido.
- Azul acadêmico = ação principal e estado ao vivo; âmbar = atenção; amarelo = marca-texto. Cada um com um só
  significado.
- Uma cor de papel por tipo de interação (`TYPE_PAPER`), igual em todo o produto.
- Cantos de 8 a 16px; sombra suave no claro, borda fina no escuro.
- Estado sempre escrito em texto além da cor.

## Colors

### Primary
- **Azul acadêmico** (`primary`; mais claro no escuro): botão principal, CTA "Criar minha sessão grátis", badge "Ao
  vivo", resposta correta do quiz, foco (`ring`), cursor e `accent-color` de controles nativos. Nunca decoração.

### Secondary
- **Âmbar** (`standby`): atenção, próximo item, sessão pausada, participação baixa, roleta do sorteio girando.
- **Marca-texto** (`highlight`): uma expressão da manchete (`<mark>`) e a seleção de texto.

### Tertiary
- **Papéis por tipo** (`rev-blue`, `rev-pink`, `rev-yellow`, `rev-green`, `rev-gold`, `rev-violet`, texto
  `rev-foreground`): Enquete = azul, Escala = rosa, Nuvem de palavras = amarelo, Pergunta aberta = verde, Quiz =
  dourado, Ranking = violeta. Tintas `rev-*-ink` para texto e traço da mesma família. No escuro, os papéis ficam
  escuros (`oklch(0.32–0.36 …)`) e as tintas, claras; valores em `globals.css`. Mapa em
  `components/interaction-type-tag.tsx` (`TYPE_PAPER`).
- **Formas e cores do quiz** (`shape-1..8`): só nas alternativas no estilo "Formas e cores"; texto branco com contraste
  ≥ 5:1; a forma sempre acompanha a cor.
- **Séries de gráfico** (`chart-1..4`) e **linha do tempo** (`timeline-slide/question`, par validado para daltonismo).

### Neutral
- **Fundo** (`background`): claro levemente azulado; faixas alternadas em `muted` a 40%.
- **Cartão** (`card`): branco puro.
- **Tinta** (`foreground`): azul-marinho quase preto. **Texto secundário** (`muted-foreground`).
- **Bordas** (`border`, `input`): azuladas e finas; tracejadas só para separar blocos internos.
- **Escuro**: `background-dark`/`card-dark` em azul-marinho; `border-dark` é branco a 12%.
- **Erro** (`destructive`): só ações destrutivas e erros.

### Named Rules
**The One Meaning Rule.** Azul é ação e ao vivo, âmbar é atenção, amarelo é marca-texto. Nenhuma dessas cores decora.

**The Type Color Rule.** Cada tipo de interação tem uma cor de papel, igual no construtor, na sala ao vivo, no analytics
e na landing. Um tipo novo exige uma cor nova.

## Typography

**Display:** Plus Jakarta Sans (500–800), via `next/font` (`--font-jakarta`, utilitário `font-display`).
**Body/UI:** Geist (`font-sans`).

### Hierarchy
- **Display** (800, `clamp(2.4rem, 5.6vw, 5rem)`, 1.02, tracking -0.025em): manchete do hero e chamada final.
- **Headline/Title** (700, `clamp(1.8rem, 3.2vw, 2.75rem)`, 1.08, tracking -0.02em): títulos de seção.
- **Body** (400, 1rem a 1.125rem, 1.6): texto em Geist, máximo ~60ch.
- **Label** (700, 0.75rem, caixa alta, tracking 0.08–0.1em): nome do tipo, cabeçalhos de tabela, códigos curtos.
- **Numerais** em `font-display` com `tabular-nums` sempre que mudam ou se comparam.

### Named Rules
**The Two Voices Rule.** `font-display` para títulos, números, códigos (`IA2026`) e rótulos de tipo; Geist para tudo
que o usuário opera ou lê como instrução. Pergunta exibida ao público é Geist.

**The No Kicker Rule.** Nenhum rótulo pequeno em caixa alta sobre um título.

## Layout

Container de 1152px (`max-w-6xl`), calha de 16px (24px a partir de 768px). Seções separadas por fio superior, com
faixas alternadas em `muted/40`; respiro de 80px (112px no desktop). A landing abre com a manchete na largura toda e o
palco de demonstração (telão + celular) abaixo; nada de hero dividido com captura de tela.

## Elevation & Depth

No claro, cartões elevam-se por sombra suave e longa, sem borda; no escuro, borda fina de 12% e quase nenhuma sombra.
- **Cartão do hero:** `0 24px 48px -28px color-mix(in oklch, var(--foreground) 35%, transparent)`.
- **Cartão solto:** `0 24px 48px -32px … 40%`.
- **Papel de tipo empilhado:** `0 10px 24px -18px … 45%`.

## Shapes

`--radius` = 12px: `rounded-sm` 8px (cartões de conteúdo, etiquetas), `rounded-md` 10px (botões, campos),
`rounded-lg` 12px, `rounded-xl` 16px (cartões grandes, celular). Círculos só para avatares, indicadores e trilhos de
barra.

## Components

- **Botões:** primário azul, Geist 500, 36px (44px no `lg`); outline com borda `input`; ghost com hover `accent`.
- **Etiqueta de tipo (`TypeTag`):** papel do tipo, `font-display` 0.75rem bold em caixa alta, sempre com o nome.
- **Badges:** `live` = azul com "Ao vivo"; `warning` = âmbar; sempre com texto.
- **Campos:** borda `input`, 40px, foco com anel `ring`.
- **Barras de resultado:** trilho `muted`, barra líder em tinta, demais em tinta a 35%, correta em `primary` com "✓".
- **Telão:** sempre escuro (`dark`), texto grande, alto contraste.
- **Movimento (Motion, `components/motion/`):** o movimento explica uma mudança de estado. Molas de `presets.ts`:
  `snappy` (toque, selo ✓, ↑/↓ do ranking), `soft` (troca de tela, entrada de lista, item que muda de lugar),
  `bar` (barra de resultado). Troca de tela sobe 14px e aparece; alternativas entram uma depois da outra
  (`STAGGER_S`) e afundam no toque (`TAP`); números contam (`AnimatedNumber`); barras crescem do zero
  (`AnimatedBarFill`). Loop só na espera (avatar respirando). Análise e relatório ficam estáticos.

## Do's and Don'ts

### Do:
- **Do** usar `primary` só para ação principal, ao vivo, correto e foco.
- **Do** falar com universidades, escolas e empresas nos textos de venda; linguagem clara, sem jargão.
- **Do** escrever o estado ao lado de toda cor de estado.
- **Do** respeitar `prefers-reduced-motion` (o `MotionProvider` usa `reducedMotion="user"`; CSS com `@media`).

### Don't:
- **Don't** inventar depoimentos, logos ou números de uso.
- **Don't** usar cores de tipo ou de forma fora do seu papel.
- **Don't** usar o amarelo, o âmbar ou o azul como decoração.
- **Don't** infantilizar a interface: a diversão vem do quiz, do ranking e do sorteio, não de enfeites.
