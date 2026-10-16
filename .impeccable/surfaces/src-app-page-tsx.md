---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/components/landing/stage-demo.tsx", "src/components/landing/report-preview.tsx", "src/components/landing/ai-chat-preview.tsx", "messages/pt-BR/landing.json"]
---

# Landing page — PulseStage

Scope: `src/app/page.tsx` (home pública). Mode: **Persuade**.
Audience: universidades, escolas (fundamental e médio) e empresas, além de palestrantes; avaliando no notebook, de dia.
Action: criar conta (CTA "Criar minha sessão grátis" no hero e na chamada final; "Criar conta grátis" no topo, "Criar conta" no celular), grátis durante o beta; ação secundária funcional: participante digita o código.
Proof: o próprio mecanismo demonstrado na página (palco com telão e celular passando por enquete, nuvem, quiz e ranking, sorteio, com dados simulados e rotulados). Sem depoimentos, logos ou números: não existem.
Memorable moment: o palco de demonstração: os votos chegam no celular e o telão escuro reage, até a roleta do sorteio revelar o número.

## Direction contract

THESIS (2026-10-12): identidade "Campus" — confiável como sistema de universidade ou empresa, acolhedora para escolas.
Substitui o mundo do roteiro (Courier, papel, verde VAI). Recusa o hero dividido com captura de tela + fileira de cards.

LOOK: fundo claro azulado, cartões brancos arredondados (8–16px), tinta azul-marinho, azul acadêmico na ação,
amarelo de marca-texto numa expressão da manchete. Plus Jakarta Sans nos títulos e numerais, Geist no texto.
O telão da demonstração é sempre escuro (azul-marinho), como o projetor de verdade.

FIRST VIEWPORT (repaginada em 2026-10-12, foco em vender): cartão branco com a manchete em Plus Jakarta Sans na largura toda
"Aulas, palestras e treinamentos com todo mundo participando." (marca-texto em "todo mundo participando"); abaixo, subtítulo + CTA verde
azul "Criar minha sessão grátis" ("Grátis durante o beta, sem cartão · já tenho conta") e, ao lado, 3 fatos com check; depois o palco de
demonstração (`components/landing/stage-demo.tsx`): telão escuro e celular da plateia passando sozinhos por Enquete,
Nuvem de palavras, Quiz e ranking e Sorteio (abas clicáveis, barra de tempo, dados simulados e rotulados; movimento
reduzido mostra o estado final sem autoplay). Fecha com a ficha do código do participante. Nada de hero dividido.

SECTIONS: fatos do produto (limites e recursos reais: 0 apps, 2.000 pessoas por sessão, 6 tipos, 1 tela), Como
funciona, Seis tipos (papéis de revisão, com Ranking em violeta) + perguntas da plateia, reações e filtro para escolas, Slides e perguntas numa sequência só, Quiz/ranking/sorteio (gamificação),
Com IA (Claude e ChatGPT via MCP: conversa de exemplo rotulada, `#ia`; o assistente "é orientado a" mostrar a proposta antes de gravar, nunca uma garantia), Relatório (confiança geral da análise e prioridade por recomendação, como no analytics; Evolução entre sessões), Para quem, Perguntas frequentes (inclui idiomas: português, espanhol e inglês, com a plateia no idioma da sessão; dados da IA alinhados a `/privacidade`), chamada final na faixa escura ("Sua próxima aula ou palestra começa aqui."). "Para quem": universidades, escolas, empresas e palestrantes.

HONESTY: o ranking do quiz anima quem subiu e caiu quando o palestrante o mostra no telão (não depois de toda pergunta); a IA não mostra em quantas respostas cada sugestão se baseia.

FORM: Campus (universitário e corporativo, acolhedor para escolas), escolha do dono em 2026-10-12; substitui "Roteiro com deixas".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
