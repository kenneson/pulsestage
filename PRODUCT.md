# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Speaker (quem apresenta):** professores universitários e de escolas (ensino fundamental e médio), equipes de treinamento e RH de empresas, palestrantes de eventos, instrutores e facilitadores. Foco de venda: universidades, escolas e empresas. Cria a sessão antes, opera a sala ao vivo durante (muitas vezes num notebook ao lado do palco, com passador de slides) e analisa depois.
- **Participant (audiência):** qualquer pessoa na plateia, no celular, sem conta e sem baixar app. Nome opcional; pode responder anonimamente.
- **Projetor:** tela pública (projetor, TV, segunda tela) vista de longe por toda a sala.

## Product Purpose

Plataforma web de interação em tempo real para quem apresenta para um público: seis tipos de pergunta (enquete, escala, nuvem de palavras, pergunta aberta, quiz e ranking) respondidos pelo celular, perguntas da plateia e reações, slides em PDF na mesma sequência, resultados ao vivo no projetor, sorteio, pesquisa pós-evento e analytics. Sucesso é o speaker entender o que aconteceu na apresentação e fazer a próxima melhor.

Conceito central: **Audience → Interaction → Data → Insight → Improvement**.
Proposta de valor: **“Seu público fala. Você entende. Sua próxima palestra fica melhor.”**

## Positioning

Não é mais um clone de Mentimeter, Slido ou AhaSlides. A interação ao vivo é o meio; o diferencial é transformar os dados de durante e depois da sessão em inteligência para melhorar as próximas apresentações: sinal de participação ao longo da sessão, scorecard do feedback, evolução entre sessões e insights com IA baseados só nos dados da sessão.

## Operating Context

- Ciclo do speaker: criar → preparar → apresentar → interagir → analisar → aprender → melhorar.
- Antes: a sessão nasce rascunho; "Testar sessão" abre um ensaio (cópia oculta, já ao vivo, fora de listas, estatísticas e perfil público) para conferir celular e telão. A plateia pode entrar antes do início e espera no celular.
- Ao vivo: sala ao vivo em tela própria (sem a barra lateral do painel) no notebook, com "Próxima" em destaque e um controle único do que está no telão; tela do projetor em outra aba/tela; audiência entra por QR Code ou código curto (ex.: `IA2026`); passador, seta → ou PageDown avançam slides e perguntas.
- Depois: o público responde a pesquisa pós-evento do modelo escolhido para a sessão (5 modelos prontos da plataforma ou modelos próprios do speaker; perguntas por dimensão, NPS e comentários). O speaker vê pontos fortes e fracos, analytics, linha do tempo, relatório em PDF/CSV, gera insights com IA e compara sessões em Evolução. Respostas de quem não entrou na sessão aparecem para o speaker, mas não contam na nota pública nem no selo "verificado".
- Idiomas: português do Brasil, espanhol latino-americano neutro (Colômbia, Chile e demais países) e inglês americano.
  O painel segue a escolha do speaker; o telão e o celular da plateia seguem o idioma da sessão (escolhido ao criá-la).

## Capabilities and Constraints

- Doze tipos de interação em quatro grupos: Opinião (Enquete, com várias escolhas e "comparar grupos"; Escala; Ranking;
  100 pontos; Matriz 2×2), Respostas livres (Nuvem de palavras, Pergunta aberta, Marcar na imagem), Competição (Quiz,
  Quiz de digitar, Adivinhe o número; com pontos, tempo e ranking por pessoa ou por equipe) e Conteúdo (slide com texto,
  imagem ou vídeo do YouTube/Vimeo). Em qualquer pergunta: cronômetro, esconder resultados até revelar, resultado no
  celular e notas do palestrante. Durante a sessão: perguntas da plateia (com curtidas e telão) e reações ao vivo.
- Sessão montada em etapas (Configurações, Slides, Enquetes, Pesquisa pós-evento, Sorteio), modelos de sessão prontos,
  modo "no ritmo de cada um" (cada pessoa percorre o roteiro sozinha), equipes, marca do speaker (logo e cor no celular e
  no telão) e suplemento do PowerPoint (telão dentro do slide; sem Google Slides).
- Filtro de palavrões ligado por padrão e moderação antes do telão (respostas abertas, nuvem e perguntas): pensado para escolas.
- Slides em PDF convertidos no navegador; perguntas posicionadas entre os slides; nova pergunta durante a sessão.
- Gamificação: avatares, alternativas com formas/cores e imagens, bônus de velocidade, ranking do quiz no telão (só durante a sessão) e sorteio de prêmios (telão mostra o resultado até 24 h depois do fim). Sala de espera no telão (quem entra aparece com avatar e nome enquanto o QR Code está na tela; nome com palavrão não aparece) e resultado do quiz no celular quando a pergunta fecha (acertou, pontos, resposta certa e a própria posição).
- Perfil público verificado do speaker, diretório `/palestrantes` e convites para palestrar.
- Biblioteca de perguntas, duplicar sessão, exportação (PDF e CSV), sugestões de perguntas com IA ("Gerar com IA").
- Login do speaker por e-mail/senha ou Google. Participantes sem conta (cookie assinado), uma resposta por interação.
- Servidor MCP: o speaker conecta o Claude, o ChatGPT ou outro assistente (OAuth) e cria sessões e perguntas
  a partir dos próprios slides; o assistente não inicia sessões ao vivo nem recebe dados pessoais da plateia.
- Métricas medem participação, não atenção nem aprendizado; nunca apresentá-las como tal.
- A IA recebe só dados agregados e trechos de respostas abertas e comentários, nunca nomes ou contatos. A análise traz confiança geral e prioridade por recomendação.
- LGPD: contato do participante opcional, com consentimento, separado das respostas. Limites de abuso usam hash do IP com segredo do servidor, nunca o IP.
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
