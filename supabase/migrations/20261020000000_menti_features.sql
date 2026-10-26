-- =============================================================================
-- Leva inspirada no Mentimeter (2026-10-25).
-- 1. Tipos novos: 100 pontos, matriz 2×2, marcar na imagem, adivinhe o número, quiz de digitar, slide de conteúdo.
-- 2. Gabarito privado (answer_key) e notas do palestrante (perguntas e slides).
-- 3. Ritmo próprio (pace), equipes, marca do palestrante.
-- 4. Telão: revelar resultados/resposta, filtro "comparar grupos" e ranking por equipes.
-- 5. Respostas com várias chaves (value.tally) somadas nos resultados públicos; aceite no modo ritmo próprio.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tipos
-- -----------------------------------------------------------------------------
alter table public.interactions drop constraint interactions_type_check;
alter table public.interactions
  add constraint interactions_type_check
  check (type in (
    'multiple_choice', 'rating', 'word_cloud', 'open_text', 'quiz', 'ranking',
    'points_100', 'matrix_2x2', 'pin_image', 'guess_number', 'quiz_text', 'content'
  ));

-- -----------------------------------------------------------------------------
-- 2. Gabarito e notas
-- -----------------------------------------------------------------------------
-- Gabarito que não pode ir para o público (o projetor e o celular leem interações sanitizadas):
-- guess_number { "value": n }, quiz_text { "accepted": ["..."] }.
alter table public.interactions
  add column answer_key    jsonb,
  add column speaker_notes text check (char_length(speaker_notes) <= 2000);

-- Notas por slide: { "1": "texto", ... } (número do slide, a partir de 1).
alter table public.sessions
  add column slide_notes jsonb not null default '{}'::jsonb;

-- -----------------------------------------------------------------------------
-- 3. Ritmo próprio, equipes e marca
-- -----------------------------------------------------------------------------
alter table public.sessions
  add column pace          text not null default 'live' check (pace in ('live', 'self')),
  add column teams_enabled boolean not null default false,
  add column use_brand     boolean not null default true;

create table public.session_teams (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  color       int not null default 1 check (color between 1 and 8),
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create index session_teams_session_idx on public.session_teams (session_id, position);

alter table public.session_teams enable row level security;
create policy "session_teams: owner select" on public.session_teams
  for select to authenticated using (public.is_session_owner(session_id));
create policy "session_teams: owner insert" on public.session_teams
  for insert to authenticated with check (public.is_session_owner(session_id));
create policy "session_teams: owner update" on public.session_teams
  for update to authenticated using (public.is_session_owner(session_id)) with check (public.is_session_owner(session_id));
create policy "session_teams: owner delete" on public.session_teams
  for delete to authenticated using (public.is_session_owner(session_id));
grant select, insert, update, delete on public.session_teams to authenticated;
grant all on public.session_teams to service_role;

alter table public.participants
  add column team_id uuid references public.session_teams (id) on delete set null;

create index participants_team_idx on public.participants (team_id) where team_id is not null;

alter table public.profiles
  add column brand_logo_path text check (char_length(brand_logo_path) <= 200),
  add column brand_color     text check (brand_color ~ '^#[0-9a-fA-F]{6}$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand', 'brand', true, 524288, array['image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "brand: owner select" on storage.objects
  for select to authenticated
  using (bucket_id = 'brand' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "brand: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'brand' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "brand: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'brand' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- -----------------------------------------------------------------------------
-- 4. Telão: revelar, comparar grupos, ranking por equipes
-- -----------------------------------------------------------------------------
alter table public.session_live_state
  add column results_revealed  boolean not null default false,
  add column answer_revealed   boolean not null default false,
  add column leaderboard_mode  text not null default 'people' check (leaderboard_mode in ('people', 'teams')),
  add column segment_option_id uuid references public.interaction_options (id) on delete set null;

-- Mesma função da migration anterior + zera "revelar" ao abrir outra pergunta.
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
           show_leaderboard = false,
           show_raffle = false,
           show_questions = false,
           results_revealed = false,
           answer_revealed = false,
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

create or replace function public.reveal_results(p_session_id uuid, p_reveal boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.sessions
     where id = p_session_id and speaker_id = (select auth.uid()) and status in ('live', 'paused')
  ) then
    raise exception 'session_not_live' using errcode = 'P0001';
  end if;

  update public.session_live_state
     set results_revealed = p_reveal,
         answer_revealed = case when p_reveal then answer_revealed else false end,
         updated_at = now()
   where session_id = p_session_id;
end;
$$;

-- Revelar a resposta certa também revela os resultados.
create or replace function public.reveal_answer(p_session_id uuid, p_reveal boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.sessions
     where id = p_session_id and speaker_id = (select auth.uid()) and status in ('live', 'paused')
  ) then
    raise exception 'session_not_live' using errcode = 'P0001';
  end if;

  update public.session_live_state
     set answer_revealed = p_reveal,
         results_revealed = case when p_reveal then true else results_revealed end,
         updated_at = now()
   where session_id = p_session_id;
end;
$$;

-- Filtro "comparar grupos": só uma alternativa de enquete marcada como segmento (settings.isSegment).
create or replace function public.set_segment_filter(p_session_id uuid, p_option_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.sessions
     where id = p_session_id and speaker_id = (select auth.uid()) and status in ('live', 'paused')
  ) then
    raise exception 'session_not_live' using errcode = 'P0001';
  end if;

  if p_option_id is not null and not exists (
    select 1
      from public.interaction_options o
      join public.interactions i on i.id = o.interaction_id
     where o.id = p_option_id
       and i.session_id = p_session_id
       and i.type = 'multiple_choice'
       and coalesce((i.settings ->> 'isSegment')::boolean, false)
  ) then
    raise exception 'segment_not_found' using errcode = 'P0002';
  end if;

  update public.session_live_state
     set segment_option_id = p_option_id,
         updated_at = now()
   where session_id = p_session_id;
end;
$$;

create or replace function public.set_leaderboard_mode(p_session_id uuid, p_mode text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_mode not in ('people', 'teams') then
    raise exception 'invalid_mode' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.sessions
     where id = p_session_id and speaker_id = (select auth.uid()) and status in ('live', 'paused')
  ) then
    raise exception 'session_not_live' using errcode = 'P0001';
  end if;

  update public.session_live_state
     set leaderboard_mode = p_mode,
         leaderboard_at = now(),
         updated_at = now()
   where session_id = p_session_id;
end;
$$;

revoke execute on function public.reveal_results(uuid, boolean) from public, anon;
revoke execute on function public.reveal_answer(uuid, boolean) from public, anon;
revoke execute on function public.set_segment_filter(uuid, uuid) from public, anon;
revoke execute on function public.set_leaderboard_mode(uuid, text) from public, anon;
grant execute on function public.reveal_results(uuid, boolean) to authenticated, service_role;
grant execute on function public.reveal_answer(uuid, boolean) to authenticated, service_role;
grant execute on function public.set_segment_filter(uuid, uuid) to authenticated, service_role;
grant execute on function public.set_leaderboard_mode(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. Respostas: aceite no ritmo próprio e soma de value.tally
-- -----------------------------------------------------------------------------
create or replace function public.validate_response()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_is_active boolean;
  v_type text;
  v_status text;
  v_pace text;
  v_participant_session uuid;
begin
  select i.session_id, i.is_active, i.type, s.status, s.pace
    into v_session_id, v_is_active, v_type, v_status, v_pace
    from public.interactions i
    join public.sessions s on s.id = i.session_id
   where i.id = new.interaction_id;

  if v_session_id is null then
    raise exception 'interaction_not_found' using errcode = 'P0002';
  end if;

  -- Slide de conteúdo não recebe resposta. Ao vivo: só a pergunta aberta; ritmo próprio: qualquer uma.
  if v_type = 'content' or v_status <> 'live' or not (v_is_active or v_pace = 'self') then
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

-- O que uma resposta soma às contagens: value.tally (várias chaves, com decimais), os pontos do ranking
-- antigo (value.points) ou +1 na aggregate_key.
create or replace function public.response_tally(p_type text, p_value jsonb, p_key text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value -> 'tally') = 'object' then p_value -> 'tally'
    when p_type = 'ranking' and jsonb_typeof(p_value -> 'points') = 'object' then p_value -> 'points'
    when p_key is null then '{}'::jsonb
    else jsonb_build_object(p_key, 1)
  end;
$$;

revoke execute on function public.response_tally(text, jsonb, text) from public, anon, authenticated;

create or replace function public.apply_response_to_results()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_visible boolean := new.moderation = 'visible';
  v_counts jsonb;
  v_new_recent jsonb;
begin
  select type into v_type from public.interactions where id = new.interaction_id;

  v_counts := case
    when not v_visible then '{}'::jsonb
    else public.response_tally(v_type, new.value, new.aggregate_key)
  end;

  v_new_recent := case
    when v_type = 'open_text' and v_visible then
      jsonb_build_array(jsonb_build_object('id', new.id, 'text', new.value ->> 'text', 'at', new.created_at))
    else '[]'::jsonb
  end;

  insert into public.interaction_results as r (interaction_id, session_id, type, total, counts, recent)
  values (new.interaction_id, new.session_id, v_type, 1, v_counts, v_new_recent)
  on conflict (interaction_id) do update set
    total = r.total + 1,
    counts = (
      select coalesce(
        jsonb_object_agg(k, coalesce((r.counts ->> k)::numeric, 0) + coalesce((v_counts ->> k)::numeric, 0)),
        '{}'::jsonb
      )
        from (select jsonb_object_keys(r.counts || v_counts) as k) keys
    ),
    recent = case
      when v_type = 'open_text' and v_visible then (
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

create or replace function public.recompute_interaction_results(p_interaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_session uuid;
begin
  select type, session_id into v_type, v_session from public.interactions where id = p_interaction_id;
  if v_type is null then
    return;
  end if;

  insert into public.interaction_results as r (interaction_id, session_id, type, total, counts, recent)
  values (
    p_interaction_id,
    v_session,
    v_type,
    (select count(*) from public.responses where interaction_id = p_interaction_id)::int,
    coalesce((
      select jsonb_object_agg(t.k, t.s)
        from (
          select e.key as k, sum(e.value::numeric) as s
            from public.responses x,
                 jsonb_each_text(public.response_tally(v_type, x.value, x.aggregate_key)) e
           where x.interaction_id = p_interaction_id and x.moderation = 'visible'
           group by e.key
        ) t
    ), '{}'::jsonb),
    case
      when v_type = 'open_text' then coalesce((
        select jsonb_agg(jsonb_build_object('id', t.id, 'text', t.value ->> 'text', 'at', t.created_at) order by t.created_at desc)
          from (
            select id, value, created_at
              from public.responses
             where interaction_id = p_interaction_id and moderation = 'visible'
             order by created_at desc
             limit 50
          ) t
      ), '[]'::jsonb)
      else '[]'::jsonb
    end
  )
  on conflict (interaction_id) do update set
    total = excluded.total,
    counts = excluded.counts,
    recent = excluded.recent,
    updated_at = now();
end;
$$;
