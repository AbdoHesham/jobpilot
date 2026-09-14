insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('issue-images', 'issue-images', false, 3145728, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "issue image owner" on storage.objects for all
  using (bucket_id = 'issue-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'issue-images' and (storage.foldername(name))[1] = auth.uid()::text);
