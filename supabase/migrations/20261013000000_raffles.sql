-- =============================================================================
-- Sorteio da sessão (opcional). O speaker cadastra os prêmios (físicos ou digitais) e escolhe quem
-- concorre: só quem respondeu a pesquisa pós-evento ('survey') ou todos que entraram ('everyone').
-- Cada participante que pode concorrer recebe um número aleatório. O sorteio acontece no servidor
-- (draw_raffle) e fica registrado antes de o telão animar: a animação só revela o resultado.
-- =============================================================================

-- null = sessão sem sorteio.
alter table public.sessions
  add column raffle_eligibility text check (raffle_eligibility in ('survey', 'everyone'));

create table public.raffle_prizes (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions (id) on delete cascade,
  position        int not null default 0,
  name            text not null check (char_length(name) between 1 and 120),
  description     text check (char_length(description) <= 300),
  kind            text not null default 'physical' check (kind in ('physical', 'digital')),
  quantity        int not null default 1 check (quantity between 1 and 50),
  -- Mostrada só no celular de quem ganhou (código de cupom, link, onde retirar…).
  winner_message  text check (char_length(winner_message) <= 500),
  created_at      timestamptz not null default now()
);

create index raffle_prizes_session_idx on public.raffle_prizes (session_id, position);

-- Número de cada participante (um por pessoa, único na sessão). Só funções gravam aqui.
create table public.raffle_entries (
  participant_id  uuid primary key references public.participants (id) on delete cascade,
  session_id      uuid not null references public.sessions (id) on delete cascade,
  number          int not null check (number between 1 and 9999),
  created_at      timestamptz not null default now(),
  constraint raffle_entries_number_unique unique (session_id, number)
);

-- Cada pessoa ganha no máximo uma vez por sessão; quem foi dado como ausente não volta ao sorteio.
create table public.raffle_winners (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions (id) on delete cascade,
  prize_id        uuid not null references public.raffle_prizes (id) on delete cascade,
  participant_id  uuid not null references public.participants (id) on delete cascade,
  number          int not null,
  drawn_at        timestamptz not null default now(),
  forfeited_at    timestamptz,
  delivered_at    timestamptz,
  constraint raffle_winners_participant_unique unique (session_id, participant_id)
);

create index raffle_winners_prize_idx on public.raffle_winners (prize_id, drawn_at);

-- Telão: sorteio na tela, prêmio da vez e o último ganhador (o projetor busca os dados no servidor).
alter table public.session_live_state
  add column show_raffle       boolean not null default false,
  add column raffle_at         timestamptz,
  add column raffle_prize_id   uuid,
  add column raffle_winner_id  uuid,
  add column raffle_drawn_at   timestamptz;

-- -----------------------------------------------------------------------------
-- RLS: o speaker gerencia os prêmios e lê números e ganhadores; só marca a entrega.
-- -----------------------------------------------------------------------------
alter table public.raffle_prizes  enable row level security;
alter table public.raffle_entries enable row level security;
alter table public.raffle_winners enable row level security;

create policy "raffle_prizes: owner all" on public.raffle_prizes
  for all to authenticated
  using (public.is_session_owner(session_id))
  with check (public.is_session_owner(session_id));

create policy "raffle_entries: owner select" on public.raffle_entries
  for select to authenticated using (public.is_session_owner(session_id));

create policy "raffle_winners: owner select" on public.raffle_winners
  for select to authenticated using (public.is_session_owner(session_id));
create policy "raffle_winners: owner update" on public.raffle_winners
  for update to authenticated
  using (public.is_session_owner(session_id))
  with check (public.is_session_owner(session_id));

revoke insert, update, delete on public.raffle_entries from authenticated, anon;
revoke insert, update, delete on public.raffle_winners from authenticated, anon;
grant update (delivered_at) on public.raffle_winners to authenticated;

-- -----------------------------------------------------------------------------
-- Quem pode concorrer agora.
-- -----------------------------------------------------------------------------
create or replace function public.raffle_is_eligible(p_session_id uuid, p_participant_id uuid, p_mode text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_mode
    when 'everyone' then true
    when 'survey' then exists (
      select 1 from public.survey_responses r
       where r.session_id = p_session_id and r.participant_id = p_participant_id
    )
    else false
  end;
$$;

-- -----------------------------------------------------------------------------
-- Número do participante (cria na primeira vez). Até 500 pessoas, números de 1 a 999.
-- Chamada pelo servidor (secret key) e por draw_raffle.
-- -----------------------------------------------------------------------------
create or replace function public.raffle_ticket(p_participant_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid;
  v_number  int;
  v_max     int;
begin
  select number into v_number from public.raffle_entries where participant_id = p_participant_id;
  if found then
    return v_number;
  end if;

  select session_id into v_session from public.participants where id = p_participant_id;
  if not found then
    raise exception 'participant_not_found' using errcode = 'P0002';
  end if;

  v_max := case
    when (select count(*) from public.participants where session_id = v_session) <= 500 then 999
    else 9999
  end;

  loop
    v_number := 1 + floor(random() * v_max)::int;
    begin
      insert into public.raffle_entries (participant_id, session_id, number)
      values (p_participant_id, v_session, v_number);
      return v_number;
    exception when unique_violation then
      -- Outra requisição pode ter criado o número desta pessoa ao mesmo tempo.
      select number into v_number from public.raffle_entries where participant_id = p_participant_id;
      if found then
        return v_number;
      end if;
    end;
  end loop;
end;
$$;

revoke execute on function public.raffle_ticket(uuid) from public, anon, authenticated;
revoke execute on function public.raffle_is_eligible(uuid, uuid, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Sortear um ganhador do prêmio. Escolha com gen_random_uuid() (gerador criptográfico).
-- Também leva o sorteio ao telão (fecha a pergunta aberta e o ranking).
-- -----------------------------------------------------------------------------
create or replace function public.draw_raffle(p_session_id uuid, p_prize_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode        text;
  v_quantity    int;
  v_participant uuid;
  v_number      int;
  v_winner      uuid;
begin
  -- Trava a sessão: dois cliques ao mesmo tempo não passam da quantidade do prêmio.
  select raffle_eligibility into v_mode
    from public.sessions
   where id = p_session_id and speaker_id = (select auth.uid()) and status <> 'draft'
     for update;
  if not found then
    raise exception 'session_not_started' using errcode = 'P0001';
  end if;
  if v_mode is null then
    raise exception 'raffle_disabled' using errcode = 'P0001';
  end if;

  select quantity into v_quantity from public.raffle_prizes where id = p_prize_id and session_id = p_session_id;
  if not found then
    raise exception 'prize_not_found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.raffle_winners where prize_id = p_prize_id and forfeited_at is null) >= v_quantity then
    raise exception 'prize_full' using errcode = 'P0001';
  end if;

  -- Quem pode concorrer e ainda não tem número (ex.: respondeu antes de o sorteio existir).
  perform public.raffle_ticket(p.id)
     from public.participants p
    where p.session_id = p_session_id
      and not exists (select 1 from public.raffle_entries e where e.participant_id = p.id)
      and public.raffle_is_eligible(p_session_id, p.id, v_mode);

  select e.participant_id, e.number into v_participant, v_number
    from public.raffle_entries e
   where e.session_id = p_session_id
     and not exists (
       select 1 from public.raffle_winners w where w.session_id = p_session_id and w.participant_id = e.participant_id
     )
     and public.raffle_is_eligible(p_session_id, e.participant_id, v_mode)
   order by gen_random_uuid()
   limit 1;
  if not found then
    raise exception 'no_entrants' using errcode = 'P0001';
  end if;

  insert into public.raffle_winners (session_id, prize_id, participant_id, number)
  values (p_session_id, p_prize_id, v_participant, v_number)
  returning id into v_winner;

  update public.interactions
     set is_active = false, closed_at = now()
   where session_id = p_session_id and is_active;

  update public.session_live_state
     set show_raffle = true,
         raffle_at = now(),
         raffle_prize_id = p_prize_id,
         raffle_winner_id = v_winner,
         raffle_drawn_at = now(),
         show_leaderboard = false,
         updated_at = now()
   where session_id = p_session_id;

  return v_winner;
end;
$$;

revoke execute on function public.draw_raffle(uuid, uuid) from public, anon;
grant execute on function public.draw_raffle(uuid, uuid) to authenticated;

-- Ganhador ausente: sai da lista (e do sorteio); o speaker sorteia outro em seguida.
create or replace function public.forfeit_raffle_winner(p_winner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.raffle_winners w
     set forfeited_at = now()
   where w.id = p_winner_id
     and w.forfeited_at is null
     and exists (select 1 from public.sessions s where s.id = w.session_id and s.speaker_id = (select auth.uid()));
  if not found then
    raise exception 'winner_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.forfeit_raffle_winner(uuid) from public, anon;
grant execute on function public.forfeit_raffle_winner(uuid) to authenticated;

-- Mostrar ou tirar o sorteio do telão (também depois de encerrar a sessão).
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
         updated_at = now()
   where session_id = p_session_id;
end;
$$;

revoke execute on function public.show_raffle(uuid, boolean) from public, anon;
grant execute on function public.show_raffle(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Avançar no deck (slide, pergunta ou ranking) tira o sorteio do telão.
-- Mesmas funções da migration do ranking + show_raffle = false.
-- -----------------------------------------------------------------------------
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
         show_leaderboard = false, show_raffle = false, updated_at = now()
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
         updated_at = now()
   where session_id = p_session_id;

  insert into public.session_events (session_id, kind, status)
  values (p_session_id, 'leaderboard', case when p_show then 'shown' else 'hidden' end);
end;
$$;
