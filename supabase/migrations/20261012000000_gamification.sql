-- =============================================================================
-- Gamificação (inspirada no Kahoot):
-- - avatar escolhido pelo participante ao entrar (chave de uma lista fixa do app; nada de upload);
-- - imagem opcional em cada alternativa de enquete e quiz (bucket público "option-images",
--   {speaker}/{uuid}.webp, redimensionada no navegador).
-- Formas e cores das alternativas e o bônus de velocidade do quiz ficam em interactions.settings.
-- =============================================================================

-- Chave do avatar (ex.: 'raposa'). A lista válida vive no app; o banco só garante o formato.
alter table public.participants
  add column avatar text check (avatar is null or avatar ~ '^[a-z]{2,20}$');

-- Caminho da imagem no bucket option-images. Duplicar uma sessão reaproveita o mesmo arquivo:
-- o app só apaga uma imagem quando nenhuma alternativa aponta mais para ela.
alter table public.interaction_options
  add column image_path text check (
    image_path is null
    or image_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$'
  );

create index interaction_options_image_path_idx on public.interaction_options (image_path) where image_path is not null;

-- -----------------------------------------------------------------------------
-- Storage: imagens das alternativas. Público para leitura (celulares e projetor sem login,
-- nomes com uuid); cada speaker só grava e apaga na própria pasta.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('option-images', 'option-images', true, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "option-images: owner select" on storage.objects
  for select to authenticated
  using (bucket_id = 'option-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "option-images: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'option-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "option-images: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'option-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
