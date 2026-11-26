-- WOW MUSIC. Apply to a NEW dedicated WOW MUSIC Supabase database only.
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Listener',
 created_at timestamptz not null default now()
);
create table public.admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.artists (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null unique references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 2 and 100),
 bio text not null default '',
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now()
);
create table public.tracks (
 id uuid primary key default gen_random_uuid(),
 artist_id uuid not null references public.artists(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 180),
 genre text not null default 'Independent',
 audio_path text unique,
 cover_url text,
 duration_seconds integer check(duration_seconds >= 0),
 rights_confirmed boolean not null default false,
 status text not null default 'pending' check(status in ('pending','published','rejected')),
 created_at timestamptz not null default now()
);
create table public.playlists (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 100),
 is_public boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.playlist_tracks (
 playlist_id uuid not null references public.playlists(id) on delete cascade,
 track_id uuid not null references public.tracks(id) on delete cascade,
 added_at timestamptz not null default now(),
 primary key(playlist_id,track_id)
);
create table public.favorites (
 user_id uuid not null references auth.users(id) on delete cascade,
 track_id uuid not null references public.tracks(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,track_id)
);
create table public.stream_events (
 id bigint generated always as identity primary key,
 user_id uuid references auth.users(id) on delete set null,
 track_id uuid not null references public.tracks(id) on delete cascade,
 seconds_played integer not null check(seconds_played between 1 and 86400),
 created_at timestamptz not null default now()
);
create table public.memberships (
 user_id uuid primary key references auth.users(id) on delete cascade,
 tier text not null default 'free' check(tier in ('free','premium')),
 state text not null default 'inactive' check(state in ('inactive','trial','active','cancelled')),
 updated_at timestamptz not null default now()
);
create index wow_tracks_status_time on public.tracks(status,created_at desc);
create index wow_stream_track_time on public.stream_events(track_id,created_at desc);
create index wow_stream_user_time on public.stream_events(user_id,created_at desc);

-- Role is based on a server-controlled admin table, never user_metadata.
create function public.is_wow_music_admin() returns boolean
language sql stable security definer set search_path = ''
as $$select exists(select 1 from public.admins where user_id=(select auth.uid()));$$;
revoke all on function public.is_wow_music_admin() from public;
grant execute on function public.is_wow_music_admin() to anon,authenticated;

create function public.new_wow_music_user() returns trigger
language plpgsql security definer set search_path = ''
as $$begin
 insert into public.profiles(id) values(new.id);
 insert into public.memberships(user_id) values(new.id);
 return new;
end$$;
revoke all on function public.new_wow_music_user() from public;
create trigger wow_music_signup after insert on auth.users
for each row execute function public.new_wow_music_user();

alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.artists enable row level security;
alter table public.tracks enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.favorites enable row level security;
alter table public.stream_events enable row level security;
alter table public.memberships enable row level security;

create policy wow_profiles_read on public.profiles for select to authenticated
 using(id=(select auth.uid()) or public.is_wow_music_admin());
create policy wow_profiles_insert on public.profiles for insert to authenticated
 with check(id=(select auth.uid()));
create policy wow_profiles_update on public.profiles for update to authenticated
 using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy wow_admin_self_read on public.admins for select to authenticated
 using(user_id=(select auth.uid()));
create policy wow_artist_read on public.artists for select to anon,authenticated
 using(status='approved' or owner_id=(select auth.uid()) or public.is_wow_music_admin());
create policy wow_artist_create on public.artists for insert to authenticated
 with check(owner_id=(select auth.uid()) and status='pending');
create policy wow_artist_update on public.artists for update to authenticated
 using(owner_id=(select auth.uid()) or public.is_wow_music_admin())
 with check(public.is_wow_music_admin() or (owner_id=(select auth.uid()) and status='pending'));
create policy wow_tracks_read on public.tracks for select to anon,authenticated
 using(
  (status='published' and exists(select 1 from public.artists a where a.id=artist_id and a.status='approved'))
  or exists(select 1 from public.artists a where a.id=artist_id and a.owner_id=(select auth.uid()))
  or public.is_wow_music_admin()
 );
create policy wow_tracks_create on public.tracks for insert to authenticated
 with check(status='pending' and rights_confirmed
 and exists(select 1 from public.artists a where a.id=artist_id and a.owner_id=(select auth.uid())));
create policy wow_tracks_update on public.tracks for update to authenticated
 using(public.is_wow_music_admin() or (status='pending' and exists(select 1 from public.artists a where a.id=artist_id and a.owner_id=(select auth.uid()))))
 with check(public.is_wow_music_admin() or (status='pending' and rights_confirmed
 and exists(select 1 from public.artists a where a.id=artist_id and a.owner_id=(select auth.uid()))));
create policy wow_playlists_read on public.playlists for select to anon,authenticated
 using(is_public or user_id=(select auth.uid()) or public.is_wow_music_admin());
create policy wow_playlists_create on public.playlists for insert to authenticated
 with check(user_id=(select auth.uid()));
create policy wow_playlists_update on public.playlists for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy wow_playlists_delete on public.playlists for delete to authenticated
 using(user_id=(select auth.uid()));
create policy wow_playlist_tracks_read on public.playlist_tracks for select to anon,authenticated
 using(exists(select 1 from public.playlists p where p.id=playlist_id
 and (p.is_public or p.user_id=(select auth.uid()))));
create policy wow_playlist_tracks_create on public.playlist_tracks for insert to authenticated
 with check(exists(select 1 from public.playlists p where p.id=playlist_id and p.user_id=(select auth.uid()))
 and exists(select 1 from public.tracks t where t.id=track_id and t.status='published'));
create policy wow_playlist_tracks_delete on public.playlist_tracks for delete to authenticated
 using(exists(select 1 from public.playlists p where p.id=playlist_id and p.user_id=(select auth.uid())));
create policy wow_favorites_read on public.favorites for select to authenticated
 using(user_id=(select auth.uid()));
create policy wow_favorites_create on public.favorites for insert to authenticated
 with check(user_id=(select auth.uid()) and exists(select 1 from public.tracks t where t.id=track_id and t.status='published'));
create policy wow_favorites_delete on public.favorites for delete to authenticated
 using(user_id=(select auth.uid()));
create policy wow_streams_read on public.stream_events for select to authenticated
 using(user_id=(select auth.uid()) or public.is_wow_music_admin()
 or exists(select 1 from public.tracks t join public.artists a on a.id=t.artist_id
 where t.id=track_id and a.owner_id=(select auth.uid())));
create policy wow_memberships_read on public.memberships for select to authenticated
 using(user_id=(select auth.uid()) or public.is_wow_music_admin());
-- No client INSERT/UPDATE/DELETE on memberships or admin privileges.

-- Qualified event logging via a narrow RPC, not direct INSERT permissions.
create function public.record_wow_stream(p_track_id uuid,p_seconds integer)
returns void language plpgsql security definer set search_path = ''
as $$begin
 if (select auth.uid()) is null then raise exception 'Sign in to record playback';end if;
 if p_seconds < 10 or p_seconds > 3600 then raise exception 'Invalid playback duration';end if;
 if not exists(select 1 from public.tracks t join public.artists a on a.id=t.artist_id
 where t.id=p_track_id and t.status='published' and a.status='approved')
 then raise exception 'Track not published';end if;
 if exists(select 1 from public.stream_events
 where user_id=(select auth.uid()) and track_id=p_track_id and created_at>now()-interval '1 minute') then return;end if;
 insert into public.stream_events(user_id,track_id,seconds_played)
 values((select auth.uid()),p_track_id,p_seconds);
end$$;
revoke all on function public.record_wow_stream(uuid,integer) from public,anon;
grant execute on function public.record_wow_stream(uuid,integer) to authenticated;

-- Private audio bucket. Paths must start with authenticated artist user's UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('wow-audio','wow-audio',false,52428800,
array['audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/ogg','audio/flac'])
on conflict(id) do nothing;
create policy wow_audio_artist_insert on storage.objects for insert to authenticated
 with check(bucket_id='wow-audio'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.artists a where a.owner_id=(select auth.uid())));
create policy wow_audio_artist_read on storage.objects for select to authenticated
 using(bucket_id='wow-audio' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy wow_audio_public_published_read on storage.objects for select to anon,authenticated
 using(bucket_id='wow-audio' and exists(
 select 1 from public.tracks t join public.artists a on a.id=t.artist_id
 where t.audio_path=name and t.status='published' and a.status='approved'));
create policy wow_audio_admin_read on storage.objects for select to authenticated
 using(bucket_id='wow-audio' and public.is_wow_music_admin());
