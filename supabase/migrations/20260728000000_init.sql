-- JobPilot schema. Everything is owner-only via RLS; the client never sees another user's rows.

create type work_mode as enum ('remote', 'hybrid', 'onsite', 'any');
create type job_status as enum ('new', 'saved', 'dismissed', 'applied');
create type application_channel as enum ('email', 'link');
create type application_status as enum ('draft', 'queued', 'sent', 'replied', 'interview', 'rejected', 'offer');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  headline text,
  photo_url text,
  linkedin_connected boolean not null default false,
  daily_send_cap int not null default 15 check (daily_send_cap between 1 and 200),
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
  auto_apply boolean not null default false,
  review_before_send boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on search_profiles (user_id);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  search_profile_id uuid not null references search_profiles on delete cascade,
  source text not null,
  external_id text not null,
  title text not null,
  company_name text,
  location text,
  salary_text text,
  description text,
  apply_url text,
  contact_email text,
  match_score numeric not null default 0,
  status job_status not null default 'new',
  fetched_at timestamptz not null default now(),
  unique (source, external_id, search_profile_id)
);
create index on jobs (search_profile_id, status, match_score desc);

create table companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  email text not null,
  website text,
  notes text,
  created_at timestamptz not null default now()
);
create index on companies (user_id, created_at desc);

create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  job_id uuid references jobs on delete set null,
  company_id uuid references companies on delete set null,
  cv_id uuid references cvs on delete set null,
  channel application_channel not null,
  email_subject text,
  email_body text,
  status application_status not null default 'draft',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint one_target check ((job_id is null) <> (company_id is null))
);
create index on applications (user_id, status, created_at desc);

create table send_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  application_id uuid not null references applications on delete cascade,
  sent_at timestamptz not null default now()
);
-- the daily-cap query: count rows for (user, today)
create index on send_log (user_id, sent_at desc);

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
alter table companies       enable row level security;
alter table applications    enable row level security;
alter table send_log        enable row level security;

create policy owner on profiles        for all using (id = auth.uid())      with check (id = auth.uid());
create policy owner on cvs             for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy owner on search_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy owner on companies       for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy owner on applications    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- jobs have no user_id; ownership is inherited from the search profile.
create policy owner on jobs for all
  using (exists (select 1 from search_profiles sp where sp.id = search_profile_id and sp.user_id = auth.uid()))
  with check (exists (select 1 from search_profiles sp where sp.id = search_profile_id and sp.user_id = auth.uid()));

-- send_log is written by the server only; users may read their own for the cap display.
create policy owner_read on send_log for select using (user_id = auth.uid());

-- ── Storage ──────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('cvs', 'cvs', false)
  on conflict (id) do nothing;

-- Files live at cvs/<user_id>/<uuid>.<ext>; the first path segment is the owner.
create policy "cvs owner" on storage.objects for all
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
