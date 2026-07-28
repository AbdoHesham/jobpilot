-- JSearch's /search-v2 requires a country code, and defaulting every user to the
-- US would silently return the wrong postings for anyone searching elsewhere.
alter table search_profiles
  add column country text not null default 'us'
  check (country ~ '^[a-z]{2}$');
