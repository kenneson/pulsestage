-- =============================================================================
-- Perfil público do palestrante (portfólio verificado) e diretório.
-- O perfil só aparece quando o speaker liga (public_enabled). Os números "verificados" são calculados
-- a partir das sessões encerradas que passam no critério (lib/domain/speaker-profile.ts); a função
-- speaker_session_facts() entrega os fatos brutos de cada sessão. Sessões aparecem na lista pública
-- só quando o speaker marca (public_listed). Pedidos de contato chegam pelo servidor.
-- =============================================================================

alter table public.profiles
  add column public_enabled    boolean not null default false,
  add column public_slug       text unique check (public_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  add column headline          text check (char_length(headline) <= 120),
  add column topics            text[] not null default '{}' check (cardinality(topics) <= 10),
  add column city              text check (char_length(city) <= 80),
  add column state             text check (state ~ '^[A-Z]{2}$'),
  add column formats           text[] not null default '{}' check (formats <@ array['presencial', 'online']),
  add column audiences         text[] not null default '{}'
    check (audiences <@ array['universidades', 'escolas', 'empresas', 'eventos']),
  add column experience        text check (char_length(experience) <= 600),
  add column website_url       text check (char_length(website_url) <= 200),
  add column linkedin_url      text check (char_length(linkedin_url) <= 200),
  add column contact_enabled   boolean not null default true,
  add column show_ratings      boolean not null default true,
  add column promote_on_survey boolean not null default false,
  -- Perfil público precisa de endereço.
  add constraint profiles_public_needs_slug check (not public_enabled or public_slug is not null);

create index profiles_public_idx on public.profiles (public_enabled) where public_enabled;

-- Sessão listada no perfil público (escolha do speaker; nasce privada).
alter table public.sessions
  add column public_listed boolean not null default false;

-- -----------------------------------------------------------------------------
-- Pedidos de contato ("Convidar para palestrar"). Gravados só pelo servidor, depois de validar,
-- do filtro anti-robô e do limite por origem (ip_hash = hash do IP com segredo do servidor).
-- -----------------------------------------------------------------------------
create table public.contact_requests (
  id            uuid primary key default gen_random_uuid(),
  speaker_id    uuid not null references public.profiles (id) on delete cascade,
  name          text not null check (char_length(name) between 2 and 120),
  email         text not null check (char_length(email) between 5 and 254),
  organization  text check (char_length(organization) <= 160),
  org_kind      text check (org_kind in ('universidade', 'escola', 'empresa', 'evento', 'outro')),
  message       text not null check (char_length(message) between 10 and 2000),
  event_date    date,
  event_city    text check (char_length(event_city) <= 80),
  ip_hash       text check (char_length(ip_hash) <= 128),
  created_at    timestamptz not null default now(),
  read_at       timestamptz,
  archived_at   timestamptz
);

create index contact_requests_speaker_idx on public.contact_requests (speaker_id, created_at desc);
create index contact_requests_ip_idx on public.contact_requests (ip_hash, created_at desc);

alter table public.contact_requests enable row level security;

create policy "contact_requests: owner select" on public.contact_requests
  for select to authenticated using (speaker_id = (select auth.uid()));
create policy "contact_requests: owner update" on public.contact_requests
  for update to authenticated
  using (speaker_id = (select auth.uid()))
  with check (speaker_id = (select auth.uid()));
create policy "contact_requests: owner delete" on public.contact_requests
  for delete to authenticated using (speaker_id = (select auth.uid()));

revoke insert, update on public.contact_requests from authenticated, anon;
grant update (read_at, archived_at) on public.contact_requests to authenticated;

-- -----------------------------------------------------------------------------
-- Fatos de cada sessão encerrada, para o critério de verificação e a nota da plateia.
-- Função comum (security invoker): o speaker lê as próprias sessões pelo RLS; o servidor,
-- com a secret key, lê as de perfis públicos. A nota usa as perguntas de 0 a 10 das dimensões
-- principais (utilidade, satisfação, recomendação), igual ao headlineScore do analytics.
-- -----------------------------------------------------------------------------
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
    (select count(*) from public.survey_responses sr where sr.session_id = s.id)::int,
    coalesce((
      select sum(a.value_int)
        from public.survey_answers a
        join public.session_survey_questions q on q.id = a.question_id
       where q.session_id = s.id and q.kind = 'nps' and q.dimension in ('utilidade', 'satisfacao', 'recomendacao')
    ), 0)::bigint,
    (
      select count(*)
        from public.survey_answers a
        join public.session_survey_questions q on q.id = a.question_id
       where q.session_id = s.id and q.kind = 'nps' and q.dimension in ('utilidade', 'satisfacao', 'recomendacao')
    )::int,
    s.public_listed
  from public.sessions s
  where s.speaker_id = any (p_speaker_ids)
    and s.status = 'completed'
    and s.started_at is not null
    and s.ended_at is not null
  order by s.ended_at desc;
$$;

revoke execute on function public.speaker_session_facts(uuid[]) from public, anon;
grant execute on function public.speaker_session_facts(uuid[]) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Os números verificados dependem do horário de início, fim e pausas. Pelo cliente do speaker
-- (papel authenticated) esses campos só mudam pelas transições de status (validate_session_status,
-- que roda depois deste trigger por ordem alfabética); uma sessão nova sempre nasce como rascunho.
-- -----------------------------------------------------------------------------
create or replace function public.lock_session_timing()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.started_at := null;
    new.ended_at := null;
    new.paused_at := null;
    new.paused_seconds := 0;
  else
    new.started_at := old.started_at;
    new.ended_at := old.ended_at;
    new.paused_at := old.paused_at;
    new.paused_seconds := old.paused_seconds;
  end if;
  return new;
end;
$$;

create trigger sessions_lock_timing
  before insert or update on public.sessions
  for each row execute function public.lock_session_timing();

revoke execute on function public.lock_session_timing() from public, anon, authenticated;
