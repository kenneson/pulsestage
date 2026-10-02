-- Reordenação atômica das interactions de uma sessão.
-- Uma única instrução: a constraint de posição (deferrable) é checada no commit.
-- security invoker: o RLS do speaker continua valendo.

create or replace function public.reorder_interactions(p_session_id uuid, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(array_length(p_ids, 1), 0) <> (
       select count(*) from public.interactions where session_id = p_session_id
     )
     or (select count(distinct x) from unnest(p_ids) as x) <> coalesce(array_length(p_ids, 1), 0)
     or exists (
       select 1
         from unnest(p_ids) as x(id)
        where not exists (
          select 1 from public.interactions i where i.id = x.id and i.session_id = p_session_id
        )
     )
  then
    raise exception 'invalid_order' using errcode = '22023';
  end if;

  update public.interactions i
     set position = (o.ord - 1)::int
    from unnest(p_ids) with ordinality as o(id, ord)
   where i.id = o.id
     and i.session_id = p_session_id;
end;
$$;

revoke execute on function public.reorder_interactions(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_interactions(uuid, uuid[]) to authenticated;
