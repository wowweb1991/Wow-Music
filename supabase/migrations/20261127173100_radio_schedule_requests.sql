create table public.radio_schedule (
 id uuid primary key default gen_random_uuid(),
 track_id uuid not null references public.tracks(id) on delete cascade,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 check (ends_at > starts_at and ends_at - starts_at <= interval '24 hours'),
 exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
);
alter table public.radio_schedule enable row level security;
create policy radio_schedule_read on public.radio_schedule for select to anon, authenticated using (exists (select 1 from public.tracks t where t.id=track_id and t.published and t.rights_confirmed));
create policy radio_schedule_admin on public.radio_schedule for all to authenticated using ((auth.jwt()->'app_metadata'->>'wow_admin')='true') with check ((auth.jwt()->'app_metadata'->>'wow_admin')='true' and exists (select 1 from public.tracks t where t.id=track_id and t.published and t.rights_confirmed));
create table public.radio_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 track_id uuid not null references public.tracks(id) on delete cascade,
 created_at timestamptz not null default now(),
 unique(user_id,track_id)
);
alter table public.radio_requests enable row level security;
create policy radio_request_read on public.radio_requests for select to authenticated using (user_id=auth.uid() or (auth.jwt()->'app_metadata'->>'wow_admin')='true');
create policy radio_request_insert on public.radio_requests for insert to authenticated with check (user_id=auth.uid() and exists (select 1 from public.tracks t where t.id=track_id and t.published and t.rights_confirmed));
create policy radio_request_delete on public.radio_requests for delete to authenticated using (user_id=auth.uid() or (auth.jwt()->'app_metadata'->>'wow_admin')='true');
