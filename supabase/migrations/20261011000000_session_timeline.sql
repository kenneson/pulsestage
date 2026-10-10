-- =============================================================================
-- Linha do tempo da palestra: o que esteve no telão e quando.
-- Eventos gravados só pelo banco (triggers e show_slide): início/pausa/fim da sessão,
-- troca de slide (ou QR Code) e abertura/fechamento de cada pergunta.
-- O analytics reconstrói os trechos (slide, pergunta, pausa) e o tempo de cada slide.
-- =============================================================================

create table public.session_events (
  id              bigint generated always as identity primary key,
  session_id      uuid not null references public.sessions (id) on delete cascade,
  at              timestamptz not null default now(),
  kind            text not null check (kind in ('status', 'slide', 'interaction_open', 'interaction_close')),
  status          text,
  slide           int,        -- índice a partir de 0; null num evento 'slide' = QR Code no telão
  interaction_id  uuid references public.interactions (id) on delete cascade
);

create index session_events_session_at_idx on public.session_events (session_id, at, id);

alter table public.session_events enable row level security;

create policy "session_events: owner select" on public.session_events
  for select to authenticated using (public.is_session_owner(session_id));

revoke insert, update, delete, truncate on public.session_events from anon, authenticated;

-- Status: início, pausas, retomadas e encerramento.
create or replace function public.log_session_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> old.status then
    insert into public.session_events (session_id, kind, status) values (new.id, 'status', new.status);
  end if;
  return new;
end;
$$;

create trigger sessions_log_status_event
  after update of status on public.sessions
  for each row execute function public.log_session_status_event();

-- Perguntas: abertura e fechamento (inclusive reaberturas).
create or replace function public.log_interaction_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active and (tg_op = 'INSERT' or not old.is_active) then
    insert into public.session_events (session_id, kind, interaction_id) values (new.session_id, 'interaction_open', new.id);
  elsif tg_op = 'UPDATE' and old.is_active and not new.is_active then
    insert into public.session_events (session_id, kind, interaction_id) values (new.session_id, 'interaction_close', new.id);
  end if;
  return new;
end;
$$;

create trigger interactions_log_event
  after insert or update of is_active on public.interactions
  for each row execute function public.log_interaction_event();

revoke execute on function public.log_session_status_event() from public, anon, authenticated;
revoke execute on function public.log_interaction_event() from public, anon, authenticated;

-- show_slide passa a registrar a troca de slide. Mesma regra da migration de slides.
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
     set current_slide = p_slide, current_slide_changed_at = now(), updated_at = now()
   where session_id = p_session_id;

  insert into public.session_events (session_id, kind, slide) values (p_session_id, 'slide', p_slide);
end;
$$;
