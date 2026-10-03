-- =============================================================================
-- Pesquisas pós-evento por modelo (substitui o formulário fixo de `feedback`).
--
-- - survey_templates / survey_template_questions: modelos da plataforma
--   (owner_id null, identificados por slug) e modelos do speaker.
-- - sessions.survey_template_id: modelo escolhido para a sessão.
-- - session_surveys / session_survey_questions: cópia das perguntas feita quando a
--   sessão é encerrada. Editar o modelo depois não altera relatórios antigos.
-- - survey_responses / survey_answers: respostas dos participantes (gravadas pelo
--   servidor com a secret key, como todo o fluxo do participante).
-- - A tabela `feedback` fica como legado: seus dados são convertidos para o modelo
--   "Avaliação geral" por public.convert_legacy_feedback().
-- =============================================================================

create table public.survey_templates (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references public.profiles (id) on delete cascade,
  slug         text unique,
  name         text not null check (char_length(name) between 1 and 120),
  description  text check (char_length(description) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- modelos da plataforma têm slug e não têm dono; modelos do speaker, o contrário
  check ((owner_id is null) = (slug is not null))
);

create index survey_templates_owner_idx on public.survey_templates (owner_id, created_at);

create trigger survey_templates_set_updated_at
  before update on public.survey_templates
  for each row execute function public.set_updated_at();

-- Tipos: scale (1–5), nps (0–10), choice (alternativas em settings.options), text.
-- dimension só faz sentido em scale/nps: alimenta scorecard, pontos fortes/fracos e evolução.
create table public.survey_template_questions (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.survey_templates (id) on delete cascade,
  position     int not null check (position >= 1),
  kind         text not null check (kind in ('scale', 'nps', 'choice', 'text')),
  label        text not null check (char_length(label) between 1 and 300),
  dimension    text check (dimension in (
                 'utilidade', 'satisfacao', 'recomendacao', 'clareza', 'atencao', 'engajamento',
                 'conteudo', 'aplicabilidade', 'didatica', 'relevancia', 'dominio', 'organizacao')),
  required     boolean not null default false,
  settings     jsonb not null default '{}'::jsonb,
  check (dimension is null or kind in ('scale', 'nps')),
  unique (template_id, position) deferrable initially deferred
);

alter table public.sessions
  add column survey_template_id uuid references public.survey_templates (id) on delete set null;

create table public.session_surveys (
  session_id   uuid primary key references public.sessions (id) on delete cascade,
  template_id  uuid references public.survey_templates (id) on delete set null,
  name         text not null,
  created_at   timestamptz not null default now()
);

create table public.session_survey_questions (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.session_surveys (session_id) on delete cascade,
  position    int not null,
  kind        text not null check (kind in ('scale', 'nps', 'choice', 'text')),
  label       text not null,
  dimension   text,
  required    boolean not null default false,
  settings    jsonb not null default '{}'::jsonb,
  unique (session_id, position)
);

create table public.survey_responses (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions (id) on delete cascade,
  participant_id  uuid references public.participants (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index survey_responses_session_idx on public.survey_responses (session_id, created_at);
create unique index survey_responses_one_per_participant_uidx
  on public.survey_responses (session_id, participant_id)
  where participant_id is not null;

-- scale/nps/choice gravam value_int (choice = índice da alternativa); text grava value_text.
create table public.survey_answers (
  response_id  uuid not null references public.survey_responses (id) on delete cascade,
  question_id  uuid not null references public.session_survey_questions (id) on delete cascade,
  value_int    int,
  value_text   text check (char_length(value_text) <= 2000),
  primary key (response_id, question_id),
  check ((value_int is not null) <> (value_text is not null))
);

create index survey_answers_question_idx on public.survey_answers (question_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.survey_templates          enable row level security;
alter table public.survey_template_questions enable row level security;
alter table public.session_surveys           enable row level security;
alter table public.session_survey_questions  enable row level security;
alter table public.survey_responses          enable row level security;
alter table public.survey_answers            enable row level security;

-- Modelos: todo speaker vê os da plataforma e os próprios; só altera os próprios.
create policy "survey_templates: read platform and own" on public.survey_templates
  for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
create policy "survey_templates: owner insert" on public.survey_templates
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "survey_templates: owner update" on public.survey_templates
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "survey_templates: owner delete" on public.survey_templates
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "survey_template_questions: read visible" on public.survey_template_questions
  for select to authenticated
  using (exists (
    select 1 from public.survey_templates t
     where t.id = template_id and (t.owner_id is null or t.owner_id = (select auth.uid()))
  ));
create policy "survey_template_questions: owner write" on public.survey_template_questions
  for all to authenticated
  using (exists (
    select 1 from public.survey_templates t where t.id = template_id and t.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.survey_templates t where t.id = template_id and t.owner_id = (select auth.uid())
  ));

-- Pesquisas e respostas de sessão: só o dono lê. Escrita: trigger (cópia) e servidor (respostas).
create policy "session_surveys: owner select" on public.session_surveys
  for select to authenticated using (public.is_session_owner(session_id));
create policy "session_survey_questions: owner select" on public.session_survey_questions
  for select to authenticated using (public.is_session_owner(session_id));
create policy "survey_responses: owner select" on public.survey_responses
  for select to authenticated using (public.is_session_owner(session_id));
create policy "survey_answers: owner select" on public.survey_answers
  for select to authenticated
  using (exists (
    select 1 from public.survey_responses r
     where r.id = response_id and public.is_session_owner(r.session_id)
  ));

-- -----------------------------------------------------------------------------
-- Cópia das perguntas ao encerrar a sessão
-- -----------------------------------------------------------------------------

create or replace function public.take_survey_snapshot(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template uuid;
begin
  if exists (select 1 from public.session_surveys where session_id = p_session_id) then
    return;
  end if;

  -- Só vale um modelo da plataforma ou do próprio dono da sessão; senão, o padrão.
  select t.id into v_template
    from public.sessions s
    join public.survey_templates t on t.id = s.survey_template_id
   where s.id = p_session_id
     and (t.owner_id is null or t.owner_id = s.speaker_id);

  if v_template is null then
    select id into v_template from public.survey_templates where slug = 'geral';
  end if;
  if v_template is null then
    return;
  end if;

  insert into public.session_surveys (session_id, template_id, name)
  select p_session_id, t.id, t.name from public.survey_templates t where t.id = v_template;

  insert into public.session_survey_questions (session_id, position, kind, label, dimension, required, settings)
  select p_session_id, q.position, q.kind, q.label, q.dimension, q.required, q.settings
    from public.survey_template_questions q
   where q.template_id = v_template;
end;
$$;

create or replace function public.snapshot_survey_on_complete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.take_survey_snapshot(new.id);
  end if;
  return null;
end;
$$;

create trigger sessions_snapshot_survey_on_complete
  after update of status on public.sessions
  for each row execute function public.snapshot_survey_on_complete();

-- -----------------------------------------------------------------------------
-- Modelos da plataforma
-- -----------------------------------------------------------------------------

do $$
declare
  t uuid;
begin
  insert into public.survey_templates (slug, name, description)
  values ('geral', 'Avaliação geral', 'O formulário clássico: utilidade, quatro dimensões e comentários.')
  returning id into t;
  insert into public.survey_template_questions (template_id, position, kind, label, dimension, required, settings) values
    (t, 1, 'nps',   'De 0 a 10, quanto esta sessão foi útil para você?', 'utilidade', true, '{"minLabel":"Nada útil","maxLabel":"Extremamente útil"}'),
    (t, 2, 'scale', 'Clareza da apresentação', 'clareza', false, '{"minLabel":"Muito ruim","maxLabel":"Excelente"}'),
    (t, 3, 'scale', 'Capacidade de manter sua atenção', 'atencao', false, '{"minLabel":"Muito ruim","maxLabel":"Excelente"}'),
    (t, 4, 'scale', 'Qualidade do conteúdo', 'conteudo', false, '{"minLabel":"Muito ruim","maxLabel":"Excelente"}'),
    (t, 5, 'scale', 'O quanto você consegue aplicar o que viu', 'aplicabilidade', false, '{"minLabel":"Nada","maxLabel":"Totalmente"}'),
    (t, 6, 'text',  'O que foi mais valioso?', null, false, '{}'),
    (t, 7, 'text',  'O que poderia melhorar?', null, false, '{}'),
    (t, 8, 'text',  'Comentário livre', null, false, '{}');

  insert into public.survey_templates (slug, name, description)
  values ('satisfacao', 'Satisfação e NPS', 'Curta e direta: recomendação, satisfação, expectativa e o que mudar.')
  returning id into t;
  insert into public.survey_template_questions (template_id, position, kind, label, dimension, required, settings) values
    (t, 1, 'nps',    'De 0 a 10, o quanto você recomendaria esta sessão a um colega?', 'recomendacao', true, '{"minLabel":"Não recomendaria","maxLabel":"Com certeza"}'),
    (t, 2, 'scale',  'No geral, qual a sua satisfação com a sessão?', 'satisfacao', false, '{"minLabel":"Muito insatisfeito","maxLabel":"Muito satisfeito"}'),
    (t, 3, 'choice', 'A sessão atendeu às suas expectativas?', null, false, '{"options":["Ficou abaixo","Atendeu","Superou"]}'),
    (t, 4, 'text',   'O que você mais gostou?', null, false, '{}'),
    (t, 5, 'text',   'O que deveria mudar?', null, false, '{}');

  insert into public.survey_templates (slug, name, description)
  values ('atencao', 'Atenção e engajamento', 'Descubra onde a plateia se manteve envolvida e onde se dispersou.')
  returning id into t;
  insert into public.survey_template_questions (template_id, position, kind, label, dimension, required, settings) values
    (t, 1, 'scale',  'Quanto você conseguiu se manter atento durante a sessão?', 'atencao', true, '{"minLabel":"Quase nada","maxLabel":"O tempo todo"}'),
    (t, 2, 'choice', 'Em que momento você mais se dispersou?', null, false, '{"options":["No início","No meio","No final","Não me dispersei"]}'),
    (t, 3, 'choice', 'O ritmo da apresentação foi:', null, false, '{"options":["Lento demais","Adequado","Rápido demais"]}'),
    (t, 4, 'scale',  'As atividades interativas ajudaram você a se envolver?', 'engajamento', false, '{"minLabel":"Nada","maxLabel":"Muito"}'),
    (t, 5, 'scale',  'O conteúdo prendeu o seu interesse?', 'conteudo', false, '{"minLabel":"Nada","maxLabel":"Muito"}'),
    (t, 6, 'text',   'Se você perdeu a atenção, o que causou isso?', null, false, '{}');

  insert into public.survey_templates (slug, name, description)
  values ('didatica', 'Didática (aulas)', 'Para professores: clareza da explicação, exemplos, compreensão e dúvidas.')
  returning id into t;
  insert into public.survey_template_questions (template_id, position, kind, label, dimension, required, settings) values
    (t, 1, 'scale',  'A explicação foi clara?', 'clareza', true, '{"minLabel":"Nada clara","maxLabel":"Muito clara"}'),
    (t, 2, 'scale',  'Os exemplos ajudaram a entender o conteúdo?', 'didatica', false, '{"minLabel":"Nada","maxLabel":"Muito"}'),
    (t, 3, 'choice', 'Quanto do conteúdo você entendeu?', null, false, '{"options":["Quase nada","Uma parte","A maior parte","Tudo"]}'),
    (t, 4, 'choice', 'O ritmo da aula foi:', null, false, '{"options":["Lento demais","Adequado","Rápido demais"]}'),
    (t, 5, 'scale',  'Você se sentiu à vontade para tirar dúvidas?', 'didatica', false, '{"minLabel":"Nada","maxLabel":"Totalmente"}'),
    (t, 6, 'text',   'Que dúvida ficou depois da aula?', null, false, '{}');

  insert into public.survey_templates (slug, name, description)
  values ('treinamento', 'Treinamento corporativo', 'Avaliação de reação: relevância, aplicação no trabalho e condução.')
  returning id into t;
  insert into public.survey_template_questions (template_id, position, kind, label, dimension, required, settings) values
    (t, 1, 'scale',  'O conteúdo é relevante para o seu trabalho?', 'relevancia', true, '{"minLabel":"Nada","maxLabel":"Totalmente"}'),
    (t, 2, 'scale',  'Você vai conseguir aplicar o que aprendeu no dia a dia?', 'aplicabilidade', false, '{"minLabel":"Nada","maxLabel":"Totalmente"}'),
    (t, 3, 'scale',  'O instrutor demonstrou domínio do tema?', 'dominio', false, '{"minLabel":"Nada","maxLabel":"Totalmente"}'),
    (t, 4, 'scale',  'O treinamento foi bem organizado?', 'organizacao', false, '{"minLabel":"Nada","maxLabel":"Totalmente"}'),
    (t, 5, 'choice', 'A carga horária foi:', null, false, '{"options":["Curta demais","Adequada","Longa demais"]}'),
    (t, 6, 'nps',    'De 0 a 10, o quanto você recomendaria este treinamento a um colega?', 'recomendacao', false, '{"minLabel":"Não recomendaria","maxLabel":"Com certeza"}'),
    (t, 7, 'text',   'O que você vai aplicar primeiro?', null, false, '{}'),
    (t, 8, 'text',   'O que poderia ser melhor?', null, false, '{}');
end;
$$;

-- -----------------------------------------------------------------------------
-- Conversão do formulário antigo (idempotente; também usada pelo seed)
-- -----------------------------------------------------------------------------

create or replace function public.convert_legacy_feedback()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_geral uuid;
begin
  select id into v_geral from public.survey_templates where slug = 'geral';

  update public.sessions s
     set survey_template_id = v_geral
   where s.survey_template_id is null
     and exists (select 1 from public.feedback f where f.session_id = s.id);

  perform public.take_survey_snapshot(x.session_id)
     from (select distinct session_id from public.feedback) x;

  -- A resposta reaproveita o id do feedback: rodar de novo não duplica nada.
  insert into public.survey_responses (id, session_id, participant_id, created_at)
  select f.id, f.session_id, f.participant_id, f.created_at
    from public.feedback f
    join public.session_surveys ss on ss.session_id = f.session_id and ss.template_id = v_geral
  on conflict (id) do nothing;

  insert into public.survey_answers (response_id, question_id, value_int, value_text)
  select f.id, q.id, v.vi, nullif(btrim(v.vt), '')
    from public.feedback f
    join public.session_surveys ss on ss.session_id = f.session_id and ss.template_id = v_geral
    join public.session_survey_questions q on q.session_id = f.session_id
    cross join lateral (values
      (1, f.overall_rating, null::text),
      (2, f.clarity_rating, null),
      (3, f.engagement_rating, null),
      (4, f.content_rating, null),
      (5, f.applicability_rating, null),
      (6, null, f.most_valuable_part),
      (7, null, f.improvement),
      (8, null, f.comment)
    ) as v(pos, vi, vt)
   where q.position = v.pos
     and (v.vi is not null or nullif(btrim(v.vt), '') is not null)
  on conflict do nothing;
end;
$$;

-- Sessões já encerradas ganham a cópia do modelo padrão; o feedback antigo é convertido.
select public.take_survey_snapshot(id) from public.sessions where status = 'completed';
select public.convert_legacy_feedback();

comment on table public.feedback is
  'Legado (formulário fixo). Convertido para survey_responses/survey_answers em 20261003000000; não recebe mais escritas.';

-- Funções internas não devem ser chamáveis via /rest/v1/rpc.
revoke execute on function public.take_survey_snapshot(uuid) from public, anon, authenticated;
revoke execute on function public.snapshot_survey_on_complete() from public, anon, authenticated;
revoke execute on function public.convert_legacy_feedback() from public, anon, authenticated;
