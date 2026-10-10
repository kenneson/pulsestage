-- =============================================================================
-- Ranking do quiz no telão. O speaker clica em "Mostrar ranking": a pergunta ativa fecha e o
-- projetor busca no servidor o top 10 (nomes que os participantes escolheram mostrar) com a posição
-- de antes do último quiz, para animar quem subiu. Avançar (slide ou pergunta) tira o ranking do telão.
-- =============================================================================

alter table public.session_live_state
  add column show_leaderboard boolean not null default false,
  add column leaderboard_at   timestamptz;

-- A linha do tempo também registra o ranking no telão.
alter table public.session_events drop constraint session_events_kind_check;
alter table public.session_events
  add constraint session_events_kind_check
  check (kind in ('status', 'slide', 'interaction_open', 'interaction_close', 'leaderboard'));

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
     set show_leaderboard = p_show, leaderboard_at = now(), updated_at = now()
   where session_id = p_session_id;

  insert into public.session_events (session_id, kind, status)
  values (p_session_id, 'leaderboard', case when p_show then 'shown' else 'hidden' end);
end;
$$;

revoke execute on function public.show_leaderboard(uuid, boolean) from public, anon;
grant execute on function public.show_leaderboard(uuid, boolean) to authenticated;

-- Abrir uma pergunta tira o ranking do telão (mesma função da migration inicial + show_leaderboard).
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

-- Mostrar um slide (ou o QR Code) também tira o ranking do telão.
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
     set current_slide = p_slide, current_slide_changed_at = now(), show_leaderboard = false, updated_at = now()
   where session_id = p_session_id;

  insert into public.session_events (session_id, kind, slide) values (p_session_id, 'slide', p_slide);
end;
$$;
