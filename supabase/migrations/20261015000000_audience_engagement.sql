-- =============================================================================
-- Participação da plateia (leva 1): ranking, moderação de respostas e filtro de palavrões,
-- perguntas da plateia (com curtidas, moderação e telão) e reações ao vivo.
-- Regras puras em lib/domain/{ranking,profanity,questions,reactions}.ts. Participantes continuam
-- sem escrever no banco: tudo passa pelo servidor (secret key) depois de validar o cookie.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Opções da sessão
-- -----------------------------------------------------------------------------
alter table public.sessions
  add column qa_enabled          boolean not null default true,   -- perguntas da plateia
  add column qa_moderated        boolean not null default false,  -- perguntas só aparecem depois de aprovadas
  add column reactions_enabled   boolean not null default true,   -- 👏 ❤️ 😂 😮 🤔 no celular
  add column profanity_filter    boolean not null default true,   -- palavrões ficam fora do telão
  add column moderate_open_text  boolean not null default false;  -- respostas abertas só vão ao telão aprovadas

-- -----------------------------------------------------------------------------
-- Ranking: novo tipo. O servidor grava { order: [ids], points: { id: pontos } } (contagem de Borda).
-- -----------------------------------------------------------------------------
alter table public.interactions drop constraint interactions_type_check;
alter table public.interactions
  add constraint interactions_type_check
  check (type in ('multiple_choice', 'rating', 'word_cloud', 'open_text', 'quiz', 'ranking'));

-- -----------------------------------------------------------------------------
-- Moderação das respostas: 'visible' entra nos resultados públicos; 'pending' espera aprovação;
-- 'hidden' foi ocultada (pelo palestrante ou pelo filtro de palavrões, em metadata.filtered).
-- O total continua contando todas as respostas recebidas.
-- -----------------------------------------------------------------------------
alter table public.responses
  add column moderation text not null default 'visible'
    check (moderation in ('visible', 'pending', 'hidden'));

create index responses_interaction_moderation_idx on public.responses (interaction_id, moderation);

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

  -- O que esta resposta soma às contagens (nada, se ainda não estiver visível).
  v_counts := case
    when not v_visible then '{}'::jsonb
    when v_type = 'ranking' then coalesce(new.value -> 'points', '{}'::jsonb)
    when new.aggregate_key is null then '{}'::jsonb
    else jsonb_build_object(new.aggregate_key, 1)
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
      select coalesce(jsonb_object_agg(k, coalesce((r.counts ->> k)::int, 0) + coalesce((v_counts ->> k)::int, 0)), '{}'::jsonb)
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

-- Recalcula os resultados públicos de uma interação a partir das respostas visíveis
-- (depois de aprovar, ocultar ou reexibir respostas). Uso interno.
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
    case
      when v_type = 'ranking' then coalesce((
        select jsonb_object_agg(t.k, t.s)
          from (
            select e.key as k, sum(e.value::int) as s
              from public.responses x, jsonb_each_text(x.value -> 'points') e
             where x.interaction_id = p_interaction_id and x.moderation = 'visible'
             group by e.key
          ) t
      ), '{}'::jsonb)
      else coalesce((
        select jsonb_object_agg(t.aggregate_key, t.c)
          from (
            select aggregate_key, count(*) as c
              from public.responses
             where interaction_id = p_interaction_id and moderation = 'visible' and aggregate_key is not null
             group by aggregate_key
          ) t
      ), '{}'::jsonb)
    end,
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

-- Aprovar (visível) ou ocultar uma resposta. Só o dono da sessão.
create or replace function public.moderate_response(p_response_id uuid, p_visible boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_interaction uuid;
begin
  update public.responses
     set moderation = case when p_visible then 'visible' else 'hidden' end
   where id = p_response_id
     and public.is_session_owner(session_id)
  returning interaction_id into v_interaction;
  if v_interaction is null then
    raise exception 'response_not_found' using errcode = 'P0002';
  end if;
  perform public.recompute_interaction_results(v_interaction);
end;
$$;

-- Ocultar (ou mostrar de novo) uma palavra inteira da nuvem. Envios futuros da mesma palavra
-- também entram ocultos (o servidor confere antes de gravar).
create or replace function public.set_term_visibility(p_interaction_id uuid, p_term text, p_visible boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.interactions i
     where i.id = p_interaction_id and public.is_session_owner(i.session_id)
  ) then
    raise exception 'interaction_not_found' using errcode = 'P0002';
  end if;

  update public.responses
     set moderation = case when p_visible then 'visible' else 'hidden' end
   where interaction_id = p_interaction_id
     and aggregate_key = p_term;
  perform public.recompute_interaction_results(p_interaction_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Perguntas da plateia
-- -----------------------------------------------------------------------------
create table public.audience_questions (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions (id) on delete cascade,
  participant_id  uuid references public.participants (id) on delete set null,
  body            text not null check (char_length(body) between 2 and 280),
  -- Nome mostrado com a pergunta; null = anônima.
  author_name     text check (char_length(author_name) <= 60),
  status          text not null default 'visible' check (status in ('pending', 'visible', 'answered', 'hidden')),
  upvotes         int not null default 0 check (upvotes >= 0),
  -- Barrada pelo filtro de palavrões (fica oculta até o palestrante liberar).
  filtered        boolean not null default false,
  created_at      timestamptz not null default now(),
  answered_at     timestamptz
);

create index audience_questions_session_idx on public.audience_questions (session_id, created_at desc);

create table public.audience_question_votes (
  question_id     uuid not null references public.audience_questions (id) on delete cascade,
  participant_id  uuid not null references public.participants (id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (question_id, participant_id)
);

create or replace function public.count_question_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.audience_questions set upvotes = upvotes + 1 where id = new.question_id;
  else
    update public.audience_questions set upvotes = greatest(upvotes - 1, 0) where id = old.question_id;
  end if;
  return null;
end;
$$;

create trigger audience_question_votes_count
  after insert or delete on public.audience_question_votes
  for each row execute function public.count_question_vote();

alter table public.audience_questions enable row level security;
alter table public.audience_question_votes enable row level security;

create policy "audience_questions: owner select" on public.audience_questions
  for select to authenticated using (public.is_session_owner(session_id));
create policy "audience_question_votes: owner select" on public.audience_question_votes
  for select to authenticated using (
    exists (select 1 from public.audience_questions q where q.id = question_id and public.is_session_owner(q.session_id))
  );

-- Aprovar, marcar como respondida, ocultar ou reabrir. Só o dono da sessão.
create or replace function public.moderate_question(p_question_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid;
begin
  if p_status not in ('visible', 'answered', 'hidden') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  update public.audience_questions
     set status = p_status,
         answered_at = case when p_status = 'answered' then now() else null end
   where id = p_question_id
     and public.is_session_owner(session_id)
  returning session_id into v_session;
  if v_session is null then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;

  -- Pergunta oculta sai do destaque do telão.
  if p_status = 'hidden' then
    update public.session_live_state
       set question_id = null, questions_at = now(), updated_at = now()
     where session_id = v_session and question_id = p_question_id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reações ao vivo. Só o projetor consulta (por uma rota do servidor), em intervalos:
-- nada de realtime por toque, que inundaria o canal de todos os celulares.
-- -----------------------------------------------------------------------------
create table public.reactions (
  id              bigint generated always as identity primary key,
  session_id      uuid not null references public.sessions (id) on delete cascade,
  participant_id  uuid references public.participants (id) on delete set null,
  kind            text not null check (kind in ('clap', 'heart', 'laugh', 'wow', 'think')),
  created_at      timestamptz not null default now()
);

create index reactions_session_idx on public.reactions (session_id, id);

alter table public.reactions enable row level security;
create policy "reactions: owner select" on public.reactions
  for select to authenticated using (public.is_session_owner(session_id));

-- -----------------------------------------------------------------------------
-- Telão: perguntas da plateia (lista das mais curtidas ou uma em destaque).
-- Mostrar outra coisa no telão (slide, pergunta do roteiro, ranking, sorteio) tira as perguntas.
-- -----------------------------------------------------------------------------
alter table public.session_live_state
  add column show_questions boolean not null default false,
  add column questions_at   timestamptz,
  add column question_id    uuid references public.audience_questions (id) on delete set null;

create or replace function public.show_questions(p_session_id uuid, p_show boolean, p_question_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.sessions
     where id = p_session_id and speaker_id = (select auth.uid()) and status = 'live'
  ) then
    raise exception 'session_not_live' using errcode = 'P0001';
  end if;

  if p_question_id is not null and not exists (
    select 1 from public.audience_questions
     where id = p_question_id and session_id = p_session_id and status in ('visible', 'answered')
  ) then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;

  if p_show then
    update public.interactions
       set is_active = false, closed_at = now()
     where session_id = p_session_id and is_active;
  end if;

  update public.session_live_state
     set show_questions = p_show,
         question_id = case when p_show then p_question_id else null end,
         questions_at = now(),
         show_leaderboard = case when p_show then false else show_leaderboard end,
         show_raffle = case when p_show then false else show_raffle end,
         updated_at = now()
   where session_id = p_session_id;
end;
$$;

-- Mesmas funções das migrations anteriores + show_questions = false.
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

create or replace function public.show_slide(p_session_id uuid, p_slide int default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  select slide_count into v_count
    from public.sessions
   where id = p_session_id
     and speaker_id = (select auth.uid())
     and status = 'live';
  if not found then
    raise exception 'session_not_live' using errcode = 'P0001';
  end if;

  if p_slide is not null and (p_slide < 0 or p_slide >= v_count) then
    raise exception 'slide_not_found' using errcode = 'P0002';
  end if;

  update public.interactions
     set is_active = false, closed_at = now()
   where session_id = p_session_id and is_active;

  update public.session_live_state
     set current_slide = p_slide, current_slide_changed_at = now(),
         show_leaderboard = false, show_raffle = false, show_questions = false, updated_at = now()
   where session_id = p_session_id;

  insert into public.session_events (session_id, kind, slide) values (p_session_id, 'slide', p_slide);
end;
$$;

create or replace function public.show_leaderboard(p_session_id uuid, p_show boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.sessions
     where id = p_session_id and speaker_id = (select auth.uid()) and status = 'live'
  ) then
    raise exception 'session_not_live' using errcode = 'P0001';
  end if;

  if p_show then
    update public.interactions
       set is_active = false, closed_at = now()
     where session_id = p_session_id and is_active;
  end if;

  update public.session_live_state
     set show_leaderboard = p_show,
         leaderboard_at = now(),
         show_raffle = case when p_show then false else show_raffle end,
         show_questions = case when p_show then false else show_questions end,
         updated_at = now()
   where session_id = p_session_id;

  insert into public.session_events (session_id, kind, status)
  values (p_session_id, 'leaderboard', case when p_show then 'shown' else 'hidden' end);
end;
$$;

create or replace function public.show_raffle(p_session_id uuid, p_show boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.sessions
     where id = p_session_id and speaker_id = (select auth.uid()) and status <> 'draft'
       and raffle_eligibility is not null
  ) then
    raise exception 'raffle_unavailable' using errcode = 'P0001';
  end if;

  if p_show then
    update public.interactions
       set is_active = false, closed_at = now()
     where session_id = p_session_id and is_active;
  end if;

  update public.session_live_state
     set show_raffle = p_show,
         raffle_at = now(),
         show_leaderboard = case when p_show then false else show_leaderboard end,
         show_questions = case when p_show then false else show_questions end,
         updated_at = now()
   where session_id = p_session_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------
revoke execute on function public.recompute_interaction_results(uuid) from public, anon, authenticated;
revoke execute on function public.count_question_vote() from public, anon, authenticated;
revoke execute on function public.moderate_response(uuid, boolean) from public, anon;
grant execute on function public.moderate_response(uuid, boolean) to authenticated;
revoke execute on function public.set_term_visibility(uuid, text, boolean) from public, anon;
grant execute on function public.set_term_visibility(uuid, text, boolean) to authenticated;
revoke execute on function public.moderate_question(uuid, text) from public, anon;
grant execute on function public.moderate_question(uuid, text) to authenticated;
revoke execute on function public.show_questions(uuid, boolean, uuid) from public, anon;
grant execute on function public.show_questions(uuid, boolean, uuid) to authenticated;
