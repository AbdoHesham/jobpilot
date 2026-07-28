# JobPilot

AI-powered job search assistant. Angular 22 SPA + Supabase (Postgres, Auth, Storage, Edge
Functions) + Claude for CV parsing and match scoring.

Jobs are pulled from the JSearch aggregator and filtered to LinkedIn-published postings. **The app
never applies on your behalf** — you click through to the employer's own posting and apply there,
then move the application along the tracker yourself. No scraping, no automation, no bulk email.

```
supabase/migrations/   schema, RLS policies, cvs storage bucket
supabase/functions/    Deno Edge Functions (the Anthropic key lives here, never in the browser)
web/                   Angular 22 SPA (standalone, zoneless, Signal Forms)
```

**Status:** auth (email/password + LinkedIn OIDC) is built and building; the schema and `parse-cv`
function are written but not yet deployed. CV upload, search profiles, the jobs feed and the
tracker are still to come.

## 1. Prerequisites

- **Node 20.19+ / 22.12+ / 24+** — Angular 22 will not run on Node 18
- Supabase CLI — `npm i -g supabase`
- Deno (only to run the Edge Function tests)

## 2. Supabase

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push               # applies supabase/migrations/*
```

Note the direct database host (`db.<ref>.supabase.co`) is **IPv6-only**. On an IPv4-only network,
`--db-url` with the direct string fails; use `--linked` as above, or the Session pooler string
from the dashboard's **Connect** dialog.

Then in the dashboard:

1. **Authentication → URL Configuration** — set Site URL to `http://localhost:4200` and add it to
   Redirect URLs, so OAuth returns to the dev server.
2. **Authentication → Providers → LinkedIn (OIDC)** — enable it and paste the client ID/secret
   from your LinkedIn app. Request only the `openid profile email` scopes: LinkedIn is used for
   profile import, nothing else. No scraping, no automated actions.
3. **Storage** — the `cvs` bucket and its per-user folder policy are created by the migration.

## 3. Edge Function secrets

Copy `.env.example` to `.env` (git-ignored), fill it in, then:

```bash
supabase secrets set --env-file .env
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically —
don't set them yourself.

## 4. Deploy functions

```bash
supabase functions deploy parse-cv
supabase functions serve parse-cv        # local, with hot reload
deno test supabase/functions/parse-cv/   # unit tests for the defensive JSON parsing
```

`parse-cv` authenticates the caller's JWT and talks to Postgres/Storage **as that user**, so RLS
enforces ownership — there is no separate permission check to keep in sync.

## 5. Scheduling cron jobs

`fetch-jobs` refreshes the feed on a schedule. Enable the extensions once, then schedule with
`pg_cron` + `pg_net` — mind the RapidAPI free tier (~200 requests/month), which a 4-hourly job
burns through quickly if you have several active search profiles:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('fetch-jobs', '0 */4 * * *', $$
  select net.http_post(
    url     := 'https://<project-ref>.supabase.co/functions/v1/fetch-jobs',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  );
$$);
```

## 6. Run the app

```bash
cd web
npm install
npm start            # ng serve on http://localhost:4200
npm run build        # production bundle into web/dist/web
```

The Supabase URL and publishable key live in `web/src/app/core/environment.ts`. Both are public
values — the publishable key only ever reaches the browser, and RLS is what protects the data.
Keep the Site URL in the dashboard matching whatever port you serve on.

## Conventions

`web/.claude/CLAUDE.md` holds the Angular rules this project follows — standalone components,
signals for state, `@Service` over `@Injectable`, Signal Forms, native `@if`/`@for`, `inject()`,
and WCAG AA as a hard requirement.

## Testing what exists today

1. `npm start`, open <http://localhost:4200> → you're redirected to `/login`.
2. Create an account → with email confirmation off you land on `/jobs`; with it on you're told to
   check your inbox. Either way a `profiles` row appears, created by the `on_auth_user_created`
   trigger.
3. Reload `/jobs` → the auth guard awaits the restored session rather than bouncing you to login.
4. Sign out → you're returned to `/login` and `/jobs` is no longer reachable.
