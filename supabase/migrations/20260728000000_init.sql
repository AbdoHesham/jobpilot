-- JobPilot schema. Everything is owner-only via RLS; the client never sees another user's rows.
-- Applications are submitted by the user on the employer's own site — the app tracks them,
-- it does not send anything, so there is no outbound email, quota, or queue here.

create type work_mode as enum ('remote', 'hybrid', 'onsite', 'any');
create type job_status as enum ('new', 'saved', 'dismissed', 'applied');
create type application_status as enum ('applied', 'replied', 'interview', 'rejected', 'offer');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  headline text,
  photo_url text,
  linkedin_connected boolean not null default false,
  created_at timestamptz not null default now()
);

create table cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  label text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  parsed_json jsonb,
  created_at timestamptz not null default now()
);
create index on cvs (user_id, created_at desc);

create table search_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  location text,
  work_mode work_mode not null default 'any',
  min_salary int,
  keywords text[] not null default '{}',
  cv_id uuid references cvs on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on search_profiles (user_id);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  search_profile_id uuid not null references search_profiles on delete cascade,
  source text not null,            -- fetcher that found it, e.g. 'jsearch'
  publisher text,                  -- board it was posted on, e.g. 'LinkedIn'
  external_id text not null,
  title text not null,
  company_name text,
  location text,
  salary_text text,
  description text,
  apply_url text,                  -- where the user goes to apply, in a new tab
  match_score numeric not null default 0,
  status job_status not null default 'new',
  fetched_at timestamptz not null default now(),
  unique (source, external_id, search_profile_id)
);
create index on jobs (search_profile_id, status, match_score desc);

-- One row per job the user actually applied to; status is advanced by hand.
create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  job_id uuid not null references jobs on delete cascade,
  cv_id uuid references cvs on delete set null,
  status application_status not null default 'applied',
  notes text,
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);
create index on applications (user_id, status, applied_at desc);

-- Auto-create a profile row on signup so the client never has to upsert one.
create function handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table profiles        enable row level security;
alter table cvs             enable row level security;
alter table search_profiles enable row level security;
alter table jobs            enable row level security;
alter table applications    enable row level security;

create policy owner on profiles        for all using (id = auth.uid())      with check (id = auth.uid());
create policy owner on cvs             for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy owner on search_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy owner on applications    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- jobs have no user_id; ownership is inherited from the search profile.
create policy owner on jobs for all
  using (exists (select 1 from search_profiles sp where sp.id = search_profile_id and sp.user_id = auth.uid()))
  with check (exists (select 1 from search_profiles sp where sp.id = search_profile_id and sp.user_id = auth.uid()));

-- ── Storage ──────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('cvs', 'cvs', false)
  on conflict (id) do nothing;

-- Files live at cvs/<user_id>/<uuid>.<ext>; the first path segment is the owner.
create policy "cvs owner" on storage.objects for all
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
