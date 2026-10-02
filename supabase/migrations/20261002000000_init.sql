-- =============================================================================
-- PulseStage — schema inicial
-- Fonte da verdade do banco. Não edite depois de aplicada: crie novas migrations.
--
-- Modelo de acesso:
--   * Speakers usam Supabase Auth (role "authenticated") e só enxergam o que é seu.
--   * Participantes NÃO usam Supabase Auth. Toda escrita deles passa pelo servidor
--     (Server Actions / Route Handlers com a secret key), após validar um cookie
--     assinado. O role "anon" não tem nenhuma permissão de escrita.
--   * O realtime público (participante e tela de projetor) lê apenas duas tabelas
--     sanitizadas e mantidas por trigger: session_live_state e interaction_results.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Código curto sem caracteres ambíguos (sem 0/O, 1/I).
create or replace function public.generate_join_code(len int default 6)
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
    substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 32)::int, 1),
    ''
  )
  from generate_series(1, len);
$$;

-- -----------------------------------------------------------------------------
-- profiles (speaker) — id é o próprio auth.users.id
-- -----------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text check (char_length(name) <= 120),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- sessions
-- -----------------------------------------------------------------------------

create table public.sessions (
  id                          uuid primary key default gen_random_uuid(),
  speaker_id                  uuid not null references public.profiles (id) on delete cascade,
  title                       text not null check (char_length(title) between 1 and 200),
  description                 text check (char_length(description) <= 2000),
  status                      text not null default 'draft'
                                check (status in ('draft', 'live', 'paused', 'completed')),
  join_code                   text not null default public.generate_join_code()
                                check (join_code ~ '^[A-Z0-9]{4,10}$'),
  scheduled_at                timestamptz,
  estimated_duration_minutes  int check (estimated_duration_minutes between 1 and 1440),
  started_at                  timestamptz,
  ended_at                    timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- Código único apenas entre sessões não encerradas (permite reutilizar "IA2026").
create unique index sessions_join_code_open_uidx
  on public.sessions (join_code)
  where status <> 'completed';

create index sessions_speaker_created_idx on public.sessions (speaker_id, created_at desc);

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- interactions
-- -----------------------------------------------------------------------------

create table public.interactions (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions (id) on delete cascade,
  -- Novos tipos (ranking, scale, q_and_a, ...) entram por migration nesta lista.
  type          text not null
                  check (type in ('multiple_choice', 'rating', 'word_cloud', 'open_text', 'quiz')),
  title         text not null check (char_length(title) between 1 and 300),
  description   text check (char_length(description) <= 1000),
  position      int not null check (position >= 0),
  is_active     boolean not null default false,
  settings      jsonb not null default '{}'::jsonb,
  activated_at  timestamptz,
  closed_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Deferrable para permitir reordenar (trocar posições) numa única transação.
  constraint interactions_position_unique unique (session_id, position)
    deferrable initially deferred
);

-- No máximo uma interaction ativa por sessão.
create unique index interactions_one_active_per_session_uidx
  on public.interactions (session_id)
  where is_active;

create trigger interactions_set_updated_at
  before update on public.interactions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- interaction_options (multiple_choice, quiz)
-- -----------------------------------------------------------------------------

create table public.interaction_options (
  id              uuid primary key default gen_random_uuid(),
  interaction_id  uuid not null references public.interactions (id) on delete cascade,
  label           text not null check (char_length(label) between 1 and 200),
  position        int not null check (position >= 0),
  is_correct      boolean not null default false,
  points          int not null default 0 check (points between 0 and 10000),
  created_at      timestamptz not null default now(),
  constraint interaction_options_position_unique unique (interaction_id, position)
    deferrable initially deferred
);

-- -----------------------------------------------------------------------------
-- participants (pseudônimos) e participant_contacts (LGPD: separado, com consentimento)
-- -----------------------------------------------------------------------------

create table public.participants (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions (id) on delete cascade,
  display_name  text check (char_length(display_name) between 1 and 60),
  anonymous     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index participants_session_idx on public.participants (session_id, created_at);

create table public.participant_contacts (
  participant_id    uuid primary key references public.participants (id) on delete cascade,
  email             text check (char_length(email) <= 254),
  phone             text check (char_length(phone) <= 32),
  consent_given_at  timestamptz not null,
  consent_purpose   text not null check (char_length(consent_purpose) between 1 and 300),
  created_at        timestamptz not null default now(),
  constraint participant_contacts_has_contact check (email is not null or phone is not null)
);

-- -----------------------------------------------------------------------------
-- responses — gravadas apenas pelo servidor
-- -----------------------------------------------------------------------------

create table public.responses (
  id              uuid primary key default gen_random_uuid(),
  interaction_id  uuid not null references public.interactions (id) on delete cascade,
  session_id      uuid not null references public.sessions (id) on delete cascade,
  participant_id  uuid not null references public.participants (id) on delete cascade,
  value           jsonb not null,
  -- Chave de agregação calculada no servidor:
  --   multiple_choice/quiz -> option id; rating -> "4"; word_cloud -> termo normalizado;
  --   open_text -> null.
  aggregate_key   text check (char_length(aggregate_key) <= 100),
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  -- Uma resposta por participante por interaction (MVP). Para múltiplas respostas no
  -- futuro, trocar por regra baseada em interactions.settings.
  constraint responses_one_per_participant unique (interaction_id, participant_id)
);

create index responses_session_created_idx on public.responses (session_id, created_at);
create index responses_participant_idx on public.responses (participant_id);

-- -----------------------------------------------------------------------------
-- feedback — overall 0–10, dimensões 1–5
-- -----------------------------------------------------------------------------

create table public.feedback (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references public.sessions (id) on delete cascade,
  participant_id        uuid references public.participants (id) on delete set null,
  overall_rating        int not null check (overall_rating between 0 and 10),
  clarity_rating        int check (clarity_rating between 1 and 5),
  engagement_rating     int check (engagement_rating between 1 and 5),
  content_rating        int check (content_rating between 1 and 5),
  applicability_rating  int check (applicability_rating between 1 and 5),
  most_valuable_part    text check (char_length(most_valuable_part) <= 1000),
  improvement           text check (char_length(improvement) <= 1000),
  comment               text check (char_length(comment) <= 2000),
  created_at            timestamptz not null default now()
);

create index feedback_session_idx on public.feedback (session_id, created_at);
create unique index feedback_one_per_participant_uidx
  on public.feedback (session_id, participant_id)
  where participant_id is not null;

-- -----------------------------------------------------------------------------
-- insights — saída da IA já validada com Zod no servidor
-- -----------------------------------------------------------------------------

create table public.insights (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions (id) on delete cascade,
  generation_id   uuid not null,          -- agrupa os insights de uma mesma execução
  type            text not null
                    check (type in ('summary', 'strength', 'attention_point', 'recommendation', 'data_quality')),
  title           text not null check (char_length(title) <= 200),
  description     text not null check (char_length(description) <= 4000),
  evidence        jsonb not null default '[]'::jsonb,
  recommendation  text check (char_length(recommendation) <= 2000),
  priority        text check (priority in ('low', 'medium', 'high')),
  confidence      text not null default 'medium' check (confidence in ('low', 'medium', 'high')),
  provider        text,
  model           text,
  created_at      timestamptz not null default now()
);

create index insights_session_created_idx on public.insights (session_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Tabelas públicas de realtime (mantidas exclusivamente por trigger)
-- -----------------------------------------------------------------------------

create table public.session_live_state (
  session_id                       uuid primary key references public.sessions (id) on delete cascade,
  status                           text not null,
  active_interaction_id            uuid references public.interactions (id) on delete set null,
  active_interaction_activated_at  timestamptz,
  participant_count                int not null default 0,
  updated_at                       timestamptz not null default now()
);

create table public.interaction_results (
  interaction_id  uuid primary key references public.interactions (id) on delete cascade,
  session_id      uuid not null references public.sessions (id) on delete cascade,
  type            text not null,
  total           int not null default 0,
  counts          jsonb not null default '{}'::jsonb,   -- { aggregate_key: count }
  recent          jsonb not null default '[]'::jsonb,   -- open_text: últimas 50 respostas
  updated_at      timestamptz not null default now()
);

create index interaction_results_session_idx on public.interaction_results (session_id);

-- -----------------------------------------------------------------------------
-- Regras de negócio no banco (defesa em profundidade)
-- -----------------------------------------------------------------------------

-- Transições válidas: draft→live, live→paused, paused→live, live|paused→completed.
create or replace function public.validate_session_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
       (old.status = 'draft'  and new.status = 'live')
    or (old.status = 'live'   and new.status in ('paused', 'completed'))
    or (old.status = 'paused' and new.status in ('live', 'completed'))
  ) then
    raise exception 'invalid_status_transition: % -> %', old.status, new.status
      using errcode = '22023';
  end if;

  if new.status = 'live' and new.started_at is null then
    new.started_at := now();
  end if;

  if new.status = 'completed' then
    new.ended_at := now();
    update public.interactions
       set is_active = false, closed_at = now()
     where session_id = new.id and is_active;
  end if;

  return new;
end;
$$;

create trigger sessions_validate_status
  before update of status on public.sessions
  for each row execute function public.validate_session_status();

-- Espelha o status em session_live_state.
create or replace function public.sync_session_live_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.session_live_state (session_id, status)
  values (new.id, new.status)
  on conflict (session_id) do update
    set status = excluded.status, updated_at = now();
  return new;
end;
$$;

create trigger sessions_sync_live_state
  after insert or update of status on public.sessions
  for each row execute function public.sync_session_live_state();

-- Espelha a interaction ativa em session_live_state.
create or replace function public.sync_active_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active and (tg_op = 'INSERT' or not old.is_active) then
    update public.session_live_state
       set active_interaction_id = new.id,
           active_interaction_activated_at = new.activated_at,
           updated_at = now()
     where session_id = new.session_id;
  elsif tg_op = 'UPDATE' and old.is_active and not new.is_active then
    update public.session_live_state
       set active_interaction_id = null,
           active_interaction_activated_at = null,
           updated_at = now()
     where session_id = new.session_id
       and active_interaction_id = new.id;
  end if;
  return new;
end;
$$;

create trigger interactions_sync_active
  after insert or update of is_active on public.interactions
  for each row execute function public.sync_active_interaction();

-- Ativa uma interaction (ou encerra a atual quando p_interaction_id é null).
-- SECURITY INVOKER: o RLS garante que só o dono da sessão consegue executar.
create or replace function public.set_active_interaction(
  p_session_id uuid,
  p_interaction_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.sessions where id = p_session_id and status = 'live'
  ) then
    raise exception 'session_not_live' using errcode = 'P0001';
  end if;

  update public.interactions
     set is_active = false, closed_at = now()
   where session_id = p_session_id
     and is_active
     and (p_interaction_id is null or id <> p_interaction_id);

  if p_interaction_id is not null then
    update public.interactions
       set is_active = true, activated_at = now(), closed_at = null
     where id = p_interaction_id
       and session_id = p_session_id
       and not is_active;

    if not found and not exists (
      select 1 from public.interactions
       where id = p_interaction_id and session_id = p_session_id
    ) then
      raise exception 'interaction_not_found' using errcode = 'P0002';
    end if;
  end if;
end;
$$;

-- Conta participantes que entraram (conectados agora = Realtime Presence).
create or replace function public.increment_participant_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.session_live_state
     set participant_count = participant_count + 1, updated_at = now()
   where session_id = new.session_id;
  return new;
end;
$$;

create trigger participants_increment_count
  after insert on public.participants
  for each row execute function public.increment_participant_count();

-- Só aceita resposta para interaction ativa em sessão live, de participante da sessão.
-- Também define session_id a partir da interaction (não confiar no cliente).
create or replace function public.validate_response()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_is_active boolean;
  v_status text;
  v_participant_session uuid;
begin
  select i.session_id, i.is_active, s.status
    into v_session_id, v_is_active, v_status
    from public.interactions i
    join public.sessions s on s.id = i.session_id
   where i.id = new.interaction_id;

  if v_session_id is null then
    raise exception 'interaction_not_found' using errcode = 'P0002';
  end if;

  if not v_is_active or v_status <> 'live' then
    raise exception 'interaction_not_open' using errcode = 'P0001';
  end if;

  select session_id into v_participant_session
    from public.participants
   where id = new.participant_id;

  if v_participant_session is distinct from v_session_id then
    raise exception 'participant_not_in_session' using errcode = 'P0001';
  end if;

  new.session_id := v_session_id;
  return new;
end;
$$;

create trigger responses_validate
  before insert on public.responses
  for each row execute function public.validate_response();

-- Atualiza agregados de forma atômica (lock de linha via ON CONFLICT).
create or replace function public.apply_response_to_results()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_new_recent jsonb;
begin
  select type into v_type from public.interactions where id = new.interaction_id;

  v_new_recent := case
    when v_type = 'open_text' then
      jsonb_build_array(jsonb_build_object(
        'id', new.id,
        'text', new.value ->> 'text',
        'at', new.created_at
      ))
    else '[]'::jsonb
  end;

  insert into public.interaction_results as r
    (interaction_id, session_id, type, total, counts, recent)
  values (
    new.interaction_id,
    new.session_id,
    v_type,
    1,
    case when new.aggregate_key is null then '{}'::jsonb
         else jsonb_build_object(new.aggregate_key, 1) end,
    v_new_recent
  )
  on conflict (interaction_id) do update set
    total = r.total + 1,
    counts = case
      when new.aggregate_key is null then r.counts
      else jsonb_set(
        r.counts,
        array[new.aggregate_key],
        to_jsonb(coalesce((r.counts ->> new.aggregate_key)::int, 0) + 1)
      )
    end,
    recent = case
      when v_type = 'open_text' then (
        select coalesce(jsonb_agg(t.e order by t.i), '[]'::jsonb)
          from jsonb_array_elements(v_new_recent || r.recent) with ordinality as t(e, i)
         where t.i <= 50
      )
      else r.recent
    end,
    updated_at = now();

  return new;
end;
$$;

create trigger responses_apply_results
  after insert on public.responses
  for each row execute function public.apply_response_to_results();

-- Feedback só depois do encerramento, e de participante da própria sessão.
create or replace function public.validate_feedback()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
  v_participant_session uuid;
begin
  select status into v_status from public.sessions where id = new.session_id;

  if v_status is distinct from 'completed' then
    raise exception 'feedback_not_open' using errcode = 'P0001';
  end if;

  if new.participant_id is not null then
    select session_id into v_participant_session
      from public.participants where id = new.participant_id;
    if v_participant_session is distinct from new.session_id then
      raise exception 'participant_not_in_session' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger feedback_validate
  before insert on public.feedback
  for each row execute function public.validate_feedback();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles             enable row level security;
alter table public.sessions             enable row level security;
alter table public.interactions         enable row level security;
alter table public.interaction_options  enable row level security;
alter table public.participants         enable row level security;
alter table public.participant_contacts enable row level security;
alter table public.responses            enable row level security;
alter table public.feedback             enable row level security;
alter table public.insights             enable row level security;
alter table public.session_live_state   enable row level security;
alter table public.interaction_results  enable row level security;

-- Helper: o usuário atual é dono da sessão? (security definer evita recursão de RLS)
create or replace function public.is_session_owner(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions
     where id = p_session_id and speaker_id = (select auth.uid())
  );
$$;

-- profiles
create policy "profiles: owner select" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: owner update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- sessions
create policy "sessions: owner select" on public.sessions
  for select to authenticated using (speaker_id = (select auth.uid()));
create policy "sessions: owner insert" on public.sessions
  for insert to authenticated with check (speaker_id = (select auth.uid()));
create policy "sessions: owner update" on public.sessions
  for update to authenticated
  using (speaker_id = (select auth.uid())) with check (speaker_id = (select auth.uid()));
create policy "sessions: owner delete" on public.sessions
  for delete to authenticated using (speaker_id = (select auth.uid()));

-- interactions
create policy "interactions: owner all" on public.interactions
  for all to authenticated
  using (public.is_session_owner(session_id))
  with check (public.is_session_owner(session_id));

-- interaction_options
create policy "interaction_options: owner all" on public.interaction_options
  for all to authenticated
  using (exists (
    select 1 from public.interactions i
     where i.id = interaction_id and public.is_session_owner(i.session_id)
  ))
  with check (exists (
    select 1 from public.interactions i
     where i.id = interaction_id and public.is_session_owner(i.session_id)
  ));

-- participants / contacts / responses / feedback: speaker só lê (escrita via servidor)
create policy "participants: owner select" on public.participants
  for select to authenticated using (public.is_session_owner(session_id));

create policy "participant_contacts: owner select" on public.participant_contacts
  for select to authenticated
  using (exists (
    select 1 from public.participants p
     where p.id = participant_id and public.is_session_owner(p.session_id)
  ));

create policy "responses: owner select" on public.responses
  for select to authenticated using (public.is_session_owner(session_id));

create policy "feedback: owner select" on public.feedback
  for select to authenticated using (public.is_session_owner(session_id));

-- insights: o speaker gera e apaga os seus
create policy "insights: owner select" on public.insights
  for select to authenticated using (public.is_session_owner(session_id));
create policy "insights: owner insert" on public.insights
  for insert to authenticated with check (public.is_session_owner(session_id));
create policy "insights: owner delete" on public.insights
  for delete to authenticated using (public.is_session_owner(session_id));

-- Realtime público: qualquer um lê estado/agregados de sessões que já saíram do draft
create policy "session_live_state: public read when not draft" on public.session_live_state
  for select to anon, authenticated
  using (status <> 'draft' or public.is_session_owner(session_id));

create policy "interaction_results: public read when not draft" on public.interaction_results
  for select to anon, authenticated
  using (exists (
    select 1 from public.session_live_state s
     where s.session_id = interaction_results.session_id
       and (s.status <> 'draft' or public.is_session_owner(s.session_id))
  ));

-- -----------------------------------------------------------------------------
-- Grants (defesa em profundidade além do RLS)
-- -----------------------------------------------------------------------------

revoke insert, update, delete, truncate on all tables in schema public from anon;
revoke insert, update, delete, truncate on public.session_live_state, public.interaction_results from authenticated;

revoke execute on function public.set_active_interaction(uuid, uuid) from public, anon;
grant  execute on function public.set_active_interaction(uuid, uuid) to authenticated;

-- anon precisa executar is_session_owner porque ele aparece nas policies públicas
-- (para anon sempre retorna false, já que auth.uid() é null).
grant execute on function public.is_session_owner(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Realtime (Postgres Changes). O RLS acima filtra o que cada assinante recebe.
-- -----------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.session_live_state,
  public.interaction_results,
  public.responses;
