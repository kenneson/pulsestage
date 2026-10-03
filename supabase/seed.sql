-- =============================================================================
-- PulseStage — dados de demonstração
-- Login: demo@pulsestage.app / demo123456
-- Roda automaticamente em `supabase db reset` (local). Em projeto remoto, cole no
-- SQL Editor. É idempotente: não faz nada se o usuário demo já existir.
-- =============================================================================

-- Sorteio ponderado: devolve o índice (1..n) conforme os pesos.
create or replace function pg_temp.pick(weights float8[])
returns int
language plpgsql
as $$
declare
  total float8 := 0;
  acc float8 := 0;
  r float8;
  i int;
begin
  for i in 1 .. array_length(weights, 1) loop
    total := total + weights[i];
  end loop;
  r := random() * total;
  for i in 1 .. array_length(weights, 1) loop
    acc := acc + weights[i];
    if r < acc then
      return i;
    end if;
  end loop;
  return array_length(weights, 1);
end;
$$;

-- Cria uma interaction (com alternativas opcionais) e devolve o id.
create or replace function pg_temp.add_interaction(
  p_session uuid, p_position int, p_type text, p_title text, p_settings jsonb,
  p_options text[] default null, p_correct int default null
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  i int;
begin
  insert into public.interactions (session_id, type, title, position, settings)
  values (p_session, p_type, p_title, p_position, p_settings)
  returning id into v_id;

  if p_options is not null then
    for i in 1 .. array_length(p_options, 1) loop
      insert into public.interaction_options (interaction_id, label, position, is_correct, points)
      values (v_id, p_options[i], i - 1, coalesce(p_correct = i, false), case when p_correct = i then 100 else 0 end);
    end loop;
  end if;
  return v_id;
end;
$$;

-- Ativa a interaction, gera respostas de quem já tinha entrado e ajusta os horários.
create or replace function pg_temp.run_interaction(
  p_session uuid, p_interaction uuid, p_at timestamptz, p_rate float8,
  p_weights float8[] default null, p_texts text[] default null
)
returns void
language plpgsql
as $$
declare
  v_type text;
  v_min int;
  v_option record;
  p record;
  v_idx int;
  v_text text;
  v_when timestamptz;
  v_ms int;
  v_options uuid[];
  v_correct boolean[];
begin
  perform public.set_active_interaction(p_session, p_interaction);
  select type, coalesce((settings ->> 'min')::int, 1) into v_type, v_min
    from public.interactions where id = p_interaction;

  select array_agg(id order by position), array_agg(is_correct order by position)
    into v_options, v_correct
    from public.interaction_options where interaction_id = p_interaction;

  for p in
    select id from public.participants
     where session_id = p_session and created_at <= p_at + interval '1 minute'
  loop
    continue when random() > p_rate;
    v_ms := 2500 + floor(random() * 14000)::int;
    v_when := p_at + make_interval(secs => v_ms / 1000.0);

    if v_type in ('multiple_choice', 'quiz') then
      v_idx := pg_temp.pick(p_weights);
      if v_type = 'quiz' then
        insert into public.responses (interaction_id, session_id, participant_id, value, aggregate_key, created_at)
        values (p_interaction, p_session, p.id,
                jsonb_build_object('optionId', v_options[v_idx], 'isCorrect', v_correct[v_idx],
                                   'points', case when v_correct[v_idx] then 100 else 0 end,
                                   'responseTimeMs', v_ms),
                v_options[v_idx]::text, v_when);
      else
        insert into public.responses (interaction_id, session_id, participant_id, value, aggregate_key, created_at)
        values (p_interaction, p_session, p.id, jsonb_build_object('optionId', v_options[v_idx]),
                v_options[v_idx]::text, v_when);
      end if;
    elsif v_type = 'rating' then
      v_idx := pg_temp.pick(p_weights) + v_min - 1;
      insert into public.responses (interaction_id, session_id, participant_id, value, aggregate_key, created_at)
      values (p_interaction, p_session, p.id, jsonb_build_object('value', v_idx), v_idx::text, v_when);
    elsif v_type = 'word_cloud' then
      v_text := p_texts[1 + floor(random() * array_length(p_texts, 1))::int];
      insert into public.responses (interaction_id, session_id, participant_id, value, aggregate_key, created_at)
      values (p_interaction, p_session, p.id, jsonb_build_object('text', v_text, 'normalized', v_text), v_text, v_when);
    else
      v_text := p_texts[1 + floor(random() * array_length(p_texts, 1))::int];
      insert into public.responses (interaction_id, session_id, participant_id, value, created_at)
      values (p_interaction, p_session, p.id, jsonb_build_object('text', v_text), v_when);
    end if;
  end loop;
end;
$$;

-- Feedback pós-evento com distribuições configuráveis.
create or replace function pg_temp.add_feedback(
  p_session uuid, p_at timestamptz, p_rate float8,
  p_overall float8[], p_clarity float8[], p_engagement float8[], p_content float8[], p_applicability float8[],
  p_valuable text[], p_improve text[], p_comments text[]
)
returns void
language plpgsql
as $$
declare
  p record;
begin
  for p in select id from public.participants where session_id = p_session loop
    continue when random() > p_rate;
    insert into public.feedback (
      session_id, participant_id, overall_rating, clarity_rating, engagement_rating, content_rating,
      applicability_rating, most_valuable_part, improvement, comment, created_at
    ) values (
      p_session, p.id,
      pg_temp.pick(p_overall) - 1,
      pg_temp.pick(p_clarity), pg_temp.pick(p_engagement), pg_temp.pick(p_content), pg_temp.pick(p_applicability),
      case when random() < 0.45 then p_valuable[1 + floor(random() * array_length(p_valuable, 1))::int] end,
      case when random() < 0.35 then p_improve[1 + floor(random() * array_length(p_improve, 1))::int] end,
      case when random() < 0.15 then p_comments[1 + floor(random() * array_length(p_comments, 1))::int] end,
      p_at + make_interval(mins => floor(random() * 90)::int)
    );
  end loop;
end;
$$;

do $$
declare
  v_user uuid := '11111111-1111-4111-8111-111111111111';
  v_session uuid;
  v_start timestamptz;
  v_ids uuid[];
  i int;
  v_names text[] := array['Ana','Bruno','Carla','Diego','Elisa','Felipe','Gabi','Heitor','Isabela','João',
                          'Karen','Lucas','Marina','Nicolas','Olívia','Pedro','Rafaela','Sofia','Tiago','Vitória'];
begin
  if exists (select 1 from auth.users where id = v_user) then
    raise notice 'Seed já aplicado.';
    return;
  end if;

  -- Usuário demo (e-mail já confirmado)
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated',
    'demo@pulsestage.app', extensions.crypt('demo123456', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"name":"Speaker Demo"}', now(), now(),
    '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_user, v_user::text,
          jsonb_build_object('sub', v_user::text, 'email', 'demo@pulsestage.app', 'email_verified', true),
          'email', now(), now(), now());

  -- ---------------------------------------------------------------------------
  -- Sessão 1: Como a IA está mudando o mercado (~120 participantes)
  -- ---------------------------------------------------------------------------
  v_start := date_trunc('hour', now() - interval '30 days') + interval '19 hours';
  insert into public.sessions (speaker_id, title, description, join_code, scheduled_at, estimated_duration_minutes)
  values (v_user, 'Como a IA está mudando o mercado de trabalho',
          'Palestra para profissionais de tecnologia e negócios sobre adoção de IA no dia a dia.',
          'IA2026', v_start, 60)
  returning id into v_session;

  v_ids := array[
    pg_temp.add_interaction(v_session, 0, 'word_cloud', 'Qual palavra resume IA para você hoje?', '{"maxLength":30}'),
    pg_temp.add_interaction(v_session, 1, 'multiple_choice', 'Você já utiliza IA no seu trabalho?', '{}',
      array['Sim, todos os dias','Algumas vezes por semana','Raramente','Ainda não']),
    pg_temp.add_interaction(v_session, 2, 'rating', 'Quanto você se sente preparado para trabalhar com IA?',
      '{"min":1,"max":5,"minLabel":"Nada","maxLabel":"Totalmente"}'),
    pg_temp.add_interaction(v_session, 3, 'quiz', 'Qual destas tarefas a IA generativa faz pior hoje?', '{"timerSeconds":30}',
      array['Resumir textos longos','Garantir fatos sem verificação','Gerar rascunhos de e-mail','Traduzir documentos'], 2),
    pg_temp.add_interaction(v_session, 4, 'open_text', 'Qual é a sua maior dúvida sobre IA no trabalho?',
      '{"maxLength":280,"showOnDisplay":true}')
  ];

  update public.sessions set status = 'live' where id = v_session;

  for i in 1 .. 124 loop
    insert into public.participants (session_id, display_name, anonymous, created_at)
    values (v_session,
            case when random() < 0.4 then v_names[1 + floor(random() * 20)::int] end,
            true,
            v_start + make_interval(secs => case when i < 100 then random() * 600 else 600 + random() * 1500 end));
  end loop;
  update public.participants set anonymous = (display_name is null) where session_id = v_session;

  perform pg_temp.run_interaction(v_session, v_ids[1], v_start + interval '4 minutes', 0.86, null,
    array['produtividade','produtividade','produtividade','futuro','futuro','oportunidade','oportunidade','medo',
          'automação','automação','ferramenta','curiosidade','desafio','inovação','ansiedade']);
  perform pg_temp.run_interaction(v_session, v_ids[2], v_start + interval '14 minutes', 0.81, array[38, 29, 21, 12]);
  perform pg_temp.run_interaction(v_session, v_ids[3], v_start + interval '27 minutes', 0.64, array[9, 24, 38, 21, 8]);
  perform pg_temp.run_interaction(v_session, v_ids[4], v_start + interval '41 minutes', 0.52, array[14, 62, 9, 15]);
  perform pg_temp.run_interaction(v_session, v_ids[5], v_start + interval '52 minutes', 0.71, null,
    array['Como começar a usar IA sem expor dados da empresa?',
          'Quais profissões vão mudar primeiro?',
          'Como validar se a resposta da IA está correta?',
          'Vale a pena fazer um curso de prompt?',
          'Como convencer meu gestor a adotar IA?',
          'A IA vai substituir analistas juniores?',
          'Quais ferramentas são seguras para uso corporativo?',
          'Como medir o ganho real de produtividade?']);
  perform public.set_active_interaction(v_session, null);

  update public.interactions set activated_at = v_start + interval '4 minutes',  closed_at = v_start + interval '8 minutes'  where id = v_ids[1];
  update public.interactions set activated_at = v_start + interval '14 minutes', closed_at = v_start + interval '17 minutes' where id = v_ids[2];
  update public.interactions set activated_at = v_start + interval '27 minutes', closed_at = v_start + interval '30 minutes' where id = v_ids[3];
  update public.interactions set activated_at = v_start + interval '41 minutes', closed_at = v_start + interval '42 minutes' where id = v_ids[4];
  update public.interactions set activated_at = v_start + interval '52 minutes', closed_at = v_start + interval '57 minutes' where id = v_ids[5];

  update public.sessions set status = 'completed' where id = v_session;
  update public.sessions set started_at = v_start, ended_at = v_start + interval '62 minutes' where id = v_session;

  perform pg_temp.add_feedback(v_session, v_start + interval '63 minutes', 0.48,
    array[0, 0, 0, 1, 1, 3, 6, 14, 22, 15, 8],
    array[1, 2, 8, 20, 14], array[1, 4, 12, 17, 10], array[0, 2, 7, 19, 16], array[2, 6, 14, 14, 8],
    array['Os exemplos práticos de uso no dia a dia','A parte sobre riscos e verificação de fatos',
          'O quiz deixou a palestra mais dinâmica','Ver as respostas da plateia em tempo real'],
    array['Mais tempo para perguntas no final','O meio da palestra ficou um pouco teórico',
          'Gostaria de exemplos do setor público','Slides com menos texto'],
    array['Excelente palestra, parabéns!','Poderia ter um material de apoio para baixar.']);

  -- ---------------------------------------------------------------------------
  -- Sessão 2: Comunicação para líderes (~64 participantes, 9 dias atrás)
  -- ---------------------------------------------------------------------------
  v_start := date_trunc('hour', now() - interval '9 days') + interval '14 hours';
  insert into public.sessions (speaker_id, title, description, join_code, scheduled_at, estimated_duration_minutes)
  values (v_user, 'Comunicação para líderes',
          'Workshop sobre feedback, reuniões e conversas difíceis.', 'LIDER1', v_start, 50)
  returning id into v_session;

  v_ids := array[
    pg_temp.add_interaction(v_session, 0, 'rating', 'Como você avalia a comunicação no seu time hoje?',
      '{"min":1,"max":5,"minLabel":"Ruim","maxLabel":"Excelente"}'),
    pg_temp.add_interaction(v_session, 1, 'multiple_choice', 'Qual conversa é mais difícil para você?', '{}',
      array['Dar feedback negativo','Dizer não para a liderança','Mediar conflitos','Comunicar mudanças']),
    pg_temp.add_interaction(v_session, 2, 'word_cloud', 'Uma palavra que define um bom líder', '{"maxLength":30}'),
    pg_temp.add_interaction(v_session, 3, 'quiz', 'No modelo SBI, o que significa o "I"?', '{"timerSeconds":20}',
      array['Intenção','Impacto','Iniciativa'], 2),
    pg_temp.add_interaction(v_session, 4, 'open_text', 'Que compromisso você assume a partir de amanhã?',
      '{"maxLength":280,"showOnDisplay":true}')
  ];

  update public.sessions set status = 'live' where id = v_session;

  for i in 1 .. 64 loop
    insert into public.participants (session_id, display_name, anonymous, created_at)
    values (v_session,
            case when random() < 0.5 then v_names[1 + floor(random() * 20)::int] end,
            true,
            v_start + make_interval(secs => random() * 480));
  end loop;
  update public.participants set anonymous = (display_name is null) where session_id = v_session;

  perform pg_temp.run_interaction(v_session, v_ids[1], v_start + interval '5 minutes', 0.92, array[4, 18, 42, 28, 8]);
  perform pg_temp.run_interaction(v_session, v_ids[2], v_start + interval '13 minutes', 0.89, array[41, 22, 18, 19]);
  perform pg_temp.run_interaction(v_session, v_ids[3], v_start + interval '24 minutes', 0.84, null,
    array['escuta','escuta','escuta','empatia','empatia','clareza','clareza','exemplo','coragem','confiança','respeito']);
  perform pg_temp.run_interaction(v_session, v_ids[4], v_start + interval '33 minutes', 0.86, array[12, 78, 10]);
  perform pg_temp.run_interaction(v_session, v_ids[5], v_start + interval '44 minutes', 0.78, null,
    array['Fazer 1:1 quinzenal com todo o time','Dar feedback no mesmo dia, sem esperar a avaliação',
          'Perguntar mais e falar menos nas reuniões','Explicar o porquê das mudanças antes do como',
          'Combinar expectativas por escrito','Reconhecer publicamente as boas entregas']);
  perform public.set_active_interaction(v_session, null);

  update public.interactions set activated_at = v_start + interval '5 minutes',  closed_at = v_start + interval '8 minutes'  where id = v_ids[1];
  update public.interactions set activated_at = v_start + interval '13 minutes', closed_at = v_start + interval '16 minutes' where id = v_ids[2];
  update public.interactions set activated_at = v_start + interval '24 minutes', closed_at = v_start + interval '28 minutes' where id = v_ids[3];
  update public.interactions set activated_at = v_start + interval '33 minutes', closed_at = v_start + interval '34 minutes' where id = v_ids[4];
  update public.interactions set activated_at = v_start + interval '44 minutes', closed_at = v_start + interval '49 minutes' where id = v_ids[5];

  update public.sessions set status = 'completed' where id = v_session;
  update public.sessions set started_at = v_start, ended_at = v_start + interval '51 minutes' where id = v_session;

  perform pg_temp.add_feedback(v_session, v_start + interval '52 minutes', 0.61,
    array[0, 0, 0, 0, 0, 1, 2, 8, 18, 22, 14],
    array[0, 1, 4, 18, 22], array[0, 1, 3, 16, 25], array[0, 1, 5, 19, 20], array[0, 1, 3, 15, 26],
    array['O modelo SBI aplicado em casos reais','As dinâmicas em dupla','A parte de conversas difíceis'],
    array['Poderia ser mais longo','Mais exemplos de feedback por escrito'],
    array['Melhor treinamento de liderança que já fiz.','Quero uma segunda parte!']);

  -- Uma sessão em rascunho para testar o builder
  insert into public.sessions (speaker_id, title, description, join_code, scheduled_at, estimated_duration_minutes)
  values (v_user, 'Produtividade com IA — turma 2', 'Rascunho para a próxima apresentação.', 'PROD26',
          date_trunc('day', now() + interval '7 days') + interval '22 hours', 45)
  returning id into v_session;
  perform pg_temp.add_interaction(v_session, 0, 'multiple_choice', 'Qual ferramenta de IA você mais usa?', '{}',
    array['Assistentes de chat','Copilotos de código','Geração de imagens','Nenhuma']);
  perform pg_temp.add_interaction(v_session, 1, 'rating', 'Quanto tempo a IA te economiza por semana?',
    '{"min":1,"max":5,"minLabel":"Nada","maxLabel":"Muito"}');
end;
$$;

-- O seed grava no formato antigo (tabela feedback); converte para as pesquisas por modelo.
select public.convert_legacy_feedback();
