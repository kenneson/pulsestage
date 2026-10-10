-- =============================================================================
-- Tempo de palestra: started_at e ended_at já existiam; agora as pausas também são contadas,
-- para a duração real (ended_at − started_at − pausas) e o cronômetro da sala ao vivo.
-- =============================================================================

alter table public.sessions
  add column paused_at      timestamptz,
  add column paused_seconds int not null default 0 check (paused_seconds >= 0);

-- Mesma validação de transições da migration inicial, agora somando o tempo em pausa.
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

  -- Saindo da pausa (retomar ou encerrar): soma o tempo parado.
  if old.status = 'paused' then
    if old.paused_at is not null then
      new.paused_seconds := old.paused_seconds + greatest(0, floor(extract(epoch from now() - old.paused_at)))::int;
    end if;
    new.paused_at := null;
  end if;

  if new.status = 'paused' then
    new.paused_at := now();
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
