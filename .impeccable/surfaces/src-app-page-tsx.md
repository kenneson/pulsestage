---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: []
---

# Landing page — PulseStage

Scope: `src/app/page.tsx` (home pública). Mode: **Persuade**.
Audience: quem apresenta para um público (palestrantes, professores, treinadores), avaliando no notebook, de dia.
Action: criar conta ("Criar minha sessão", grátis durante o beta); ação secundária funcional: participante digita o código.
Proof: o próprio mecanismo demonstrado na página (enquete de demonstração com respostas simuladas, rotuladas). Sem depoimentos, logos ou números: não existem.
Memorable moment: apertar "VAI" na margem e ver a luz de deixa passar de âmbar a verde enquanto os votos chegam.

## Direction contract

THESIS: A palestra é um espetáculo com roteiro; o PulseStage é o caderno do diretor de cena. Recusa o hero dividido com captura de tela + fileira de cards de recursos.

OWN-WORLD: Página de roteiro branca (não creme) furada para fichário, margem de deixas à esquerda, Courier Prime no formato de roteiro (personagem em caixa alta, fala, rubrica entre parênteses). Papéis de revisão coloridos (azul, rosa, amarelo, verde, dourado) = os cinco tipos de interação. Luz de deixa âmbar (atenção) e verde (VAI) = estados ao vivo. Escuro = coxia preta com fita de marcação.

STORY: Clareza primeiro (feedback do dono, 2026-10-03: a versão metafórica não dizia o que o produto faz). O visitante entende em segundos: o que é (enquetes, quiz e perguntas ao vivo para palestras e aulas), como funciona (3 passos), os 5 tipos, o painel durante a apresentação, o relatório depois, para quem é e perguntas frequentes. O mundo do roteiro fica no visual (papel, Courier, cores por tipo, luz verde), nunca no texto: sem jargão de teatro ("deixa", "ato", "INT.", "notas do diretor").

FIRST VIEWPORT (repaginada em 2026-10-12, foco em vender): folha de roteiro com a manchete em Courier na largura toda
"Faça a plateia participar da sua palestra, ao vivo." (marca-texto em "ao vivo"); abaixo, subtítulo + CTA verde
"Criar minha sessão grátis" ("Grátis durante o beta, sem cartão") e, ao lado, 3 fatos com check; depois o palco de
demonstração (`components/landing/stage-demo.tsx`): telão escuro e celular da plateia passando sozinhos por Enquete,
Nuvem de palavras, Quiz e ranking e Sorteio (abas clicáveis, barra de tempo, dados simulados e rotulados; movimento
reduzido mostra o estado final sem autoplay). Fecha com a ficha do código do participante. Nada de hero dividido.

SECTIONS: fatos do produto (limites e recursos reais: 0 apps, 2.000 pessoas por sessão, 5 tipos, 1 tela), Como
funciona, Cinco tipos (papéis de revisão), Slides e perguntas numa sequência só, Quiz/ranking/sorteio (gamificação),
Relatório, Para quem, Perguntas frequentes, chamada final na coxia escura ("Sua próxima palestra começa aqui.").

FORM: Roteiro com deixas (caderno do diretor de cena), candidato 1 da lista ordenada (escolha do usuário, IMPECCABLE'S PICK); seed key 9e370257.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
