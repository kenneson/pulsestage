-- =============================================================================
-- Slides da sessão: o speaker envia o PDF da apresentação, o navegador converte cada página
-- em imagem e grava no bucket privado "slides" ({speaker}/{sessão}/{lote}/{n}.{formato}).
-- O PDF em si nunca sai do computador do speaker.
-- Na apresentação, slides e interações formam uma única sequência (o "deck").
-- =============================================================================

alter table public.sessions
  add column slides_batch  uuid,
  add column slide_count   int not null default 0 check (slide_count between 0 and 300),
  add column slides_format text check (slides_format in ('webp', 'jpeg')),
  add constraint sessions_slides_consistent check (
    (slide_count = 0 and slides_batch is null and slides_format is null)
    or (slide_count > 0 and slides_batch is not null and slides_format is not null)
  );

-- Onde a interação entra no deck: depois de quantos slides (0 = antes do primeiro).
-- null ou valores acima do total de slides contam como "no fim".
alter table public.interactions
  add column after_slide int check (after_slide >= 0);

-- Slide no telão (índice a partir de 0; null = tela com o QR Code).
-- Uma interação ativa aparece por cima do slide; ao encerrá-la, o telão volta para ele.
alter table public.session_live_state
  add column current_slide            int,
  add column current_slide_changed_at timestamptz;

-- -----------------------------------------------------------------------------
-- Mostrar um slide (ou o QR Code, com p_slide null). Encerra a interação ativa.
-- security definer porque session_live_state não aceita escrita direta; o dono é conferido aqui.
-- -----------------------------------------------------------------------------
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
end;
$$;

revoke execute on function public.show_slide(uuid, int) from public, anon;
grant execute on function public.show_slide(uuid, int) to authenticated;

-- -----------------------------------------------------------------------------
-- Reordena as interações e define em que ponto do deck cada uma entra, numa transação.
-- security invoker: o RLS do speaker continua valendo.
-- -----------------------------------------------------------------------------
create or replace function public.arrange_interactions(p_session_id uuid, p_ids uuid[], p_after_slides int[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(array_length(p_after_slides, 1), 0) <> coalesce(array_length(p_ids, 1), 0)
     or exists (select 1 from unnest(p_after_slides) as a(v) where a.v < 0)
  then
    raise exception 'invalid_order' using errcode = '22023';
  end if;

  perform public.reorder_interactions(p_session_id, p_ids);

  update public.interactions i
     set after_slide = a.after_slide
    from unnest(p_ids, p_after_slides) as a(id, after_slide)
   where i.id = a.id
     and i.session_id = p_session_id;
end;
$$;

revoke execute on function public.arrange_interactions(uuid, uuid[], int[]) from public, anon;
grant execute on function public.arrange_interactions(uuid, uuid[], int[]) to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: bucket privado. O telão público recebe URLs assinadas geradas no servidor.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slides', 'slides', false, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "slides: owner select" on storage.objects
  for select to authenticated
  using (bucket_id = 'slides' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "slides: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'slides' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "slides: owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'slides' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'slides' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "slides: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'slides' and (storage.foldername(name))[1] = (select auth.uid())::text);
