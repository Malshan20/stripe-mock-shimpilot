-- Run in a NEW test Supabase project SQL editor. The app uses the anon key + user JWT.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text not null check (char_length(description) between 1 and 5000),
  summary text,
  created_at timestamptz not null default now()
);
alter table public.projects enable row level security;
drop policy if exists "owned projects" on public.projects;
create policy "owned projects" on public.projects for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select,insert,update,delete on public.projects to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('demo-files','demo-files',false,2097152,array['text/plain','application/json','application/pdf','image/png','image/jpeg'])
on conflict(id) do nothing;
drop policy if exists "owned demo files" on storage.objects;
create policy "owned demo files" on storage.objects for all to authenticated
using (bucket_id='demo-files' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='demo-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Realtime fixture is scan-only; enable publication yourself only if you exercise it separately.
