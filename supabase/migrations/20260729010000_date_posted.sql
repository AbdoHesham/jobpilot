-- How far back a search looks. Values are JSearch's date_posted vocabulary so
-- the column can be passed straight through to the provider.
alter table search_profiles
  add column date_posted text not null default 'week'
  check (date_posted in ('all', 'today', '3days', 'week', 'month'));

-- When the employer posted, as opposed to when we fetched it. Nullable because
-- not every posting carries a date.
alter table jobs add column posted_at timestamptz;

create index on jobs (search_profile_id, posted_at desc nulls last);
