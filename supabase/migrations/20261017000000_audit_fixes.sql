-- =============================================================================
-- Correções da auditoria de produto (2026-10-16).
-- 1. Pesquisa anônima: guarda o hash do IP (limite de envios) e deixa de contar nos números públicos do
--    palestrante (nota e selo "verificado" passam a usar só respostas de quem entrou na sessão).
-- 2. Ensaio: sessão de teste (is_test) que não aparece em listas, estatísticas nem no perfil público.
-- 3. Reações: total por tipo calculado no banco (a sala ao vivo não baixa mais todas as linhas).
-- 4. Realtime: responses sai da publicação (ninguém assina; só gerava carga).
-- 5. Permissões: o papel anônimo não escreve em tabela nenhuma (tudo passa pelo servidor) e ninguém
--    faz TRUNCATE pela API.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Pesquisa anônima
-- -----------------------------------------------------------------------------
alter table public.survey_responses add column ip_hash text check (char_length(ip_hash) <= 64);

create index survey_responses_anonymous_ip_idx
  on public.survey_responses (session_id, ip_hash, created_at)
  where participant_id is null;

-- -----------------------------------------------------------------------------
-- 2. Ensaio
-- -----------------------------------------------------------------------------
alter table public.sessions
  add column is_test boolean not null default false,
  add column rehearsal_of uuid references public.sessions (id) on delete cascade;

alter table public.sessions
  add constraint sessions_rehearsal_is_test check (rehearsal_of is null or is_test);

create index sessions_rehearsal_of_idx on public.sessions (rehearsal_of) where rehearsal_of is not null;

-- Números públicos: sem sessões de teste; pesquisa e nota só de quem entrou na sessão.
create or replace function public.speaker_session_facts(p_speaker_ids uuid[])
returns table (
  speaker_id        uuid,
  session_id        uuid,
  title             text,
  started_at        timestamptz,
  ended_at          timestamptz,
  talk_seconds      int,
  participants      int,
  responders        int,
  survey_responses  int,
  rating_sum        bigint,
  rating_count      int,
  public_listed     boolean
)
language sql
stable
set search_path = ''
as $$
  select
    s.speaker_id,
    s.id,
    s.title,
    s.started_at,
    s.ended_at,
    greatest(0, floor(extract(epoch from s.ended_at - s.started_at))::int - coalesce(s.paused_seconds, 0)),
    (select count(*) from public.participants p where p.session_id = s.id)::int,
    (select count(distinct r.participant_id) from public.responses r where r.session_id = s.id)::int,
    (select count(*) from public.survey_responses sr where sr.session_id = s.id and sr.participant_id is not null)::int,
    coalesce((
      select sum(a.value_int)
        from public.survey_answers a
        join public.survey_responses sr on sr.id = a.response_id
        join public.session_survey_questions q on q.id = a.question_id
       where q.session_id = s.id and sr.participant_id is not null
         and q.kind = 'nps' and q.dimension in ('utilidade', 'satisfacao', 'recomendacao')
    ), 0)::bigint,
    (
      select count(*)
        from public.survey_answers a
        join public.survey_responses sr on sr.id = a.response_id
        join public.session_survey_questions q on q.id = a.question_id
       where q.session_id = s.id and sr.participant_id is not null
         and q.kind = 'nps' and q.dimension in ('utilidade', 'satisfacao', 'recomendacao')
    )::int,
    s.public_listed
  from public.sessions s
  where s.speaker_id = any (p_speaker_ids)
    and s.status = 'completed'
    and not s.is_test
    and s.started_at is not null
    and s.ended_at is not null
  order by s.ended_at desc;
$$;

revoke execute on function public.speaker_session_facts(uuid[]) from public, anon;
grant execute on function public.speaker_session_facts(uuid[]) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Total de reações por tipo (invoker: o RLS de reactions limita ao dono da sessão)
-- -----------------------------------------------------------------------------
create or replace function public.reaction_totals(p_session_id uuid)
returns table (kind text, total int)
language sql
stable
set search_path = ''
as $$
  select r.kind, count(*)::int
    from public.reactions r
   where r.session_id = p_session_id
   group by r.kind;
$$;

revoke execute on function public.reaction_totals(uuid) from public, anon;
grant execute on function public.reaction_totals(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. Realtime: só session_live_state e interaction_results são assinados (seção 0.2)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'responses'
  ) then
    alter publication supabase_realtime drop table public.responses;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Permissões
-- -----------------------------------------------------------------------------
revoke insert, update, delete, truncate on all tables in schema public from anon;
revoke truncate on all tables in schema public from authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon;
alter default privileges in schema public revoke truncate on tables from authenticated;
