# JobPilot

AI-powered job search assistant. Flutter web (mobile later) + Supabase (Postgres, Auth, Storage,
Edge Functions) + Claude for CV parsing and match scoring.

Jobs are pulled from the JSearch aggregator and filtered to LinkedIn-published postings. **The app
never applies on your behalf** — you click through to the employer's own posting and apply there,
then move the application along the tracker yourself. No scraping, no automation, no bulk email.

**Phase 1 is implemented:** schema + RLS, auth (email/password and LinkedIn OIDC), CV upload
to Storage, the `parse-cv` Edge Function, and a profile screen showing parsed skills.

```
supabase/migrations/   schema, RLS policies, cvs storage bucket
supabase/functions/    Deno Edge Functions (all AI + email keys live here, never in the app)
app/                   Flutter client (feature-first: lib/features/<feature>/)
```

## 1. Prerequisites

- Flutter (latest stable) + Dart — <https://docs.flutter.dev/get-started/install>
- Supabase CLI — `npm i -g supabase` or `scoop install supabase`
- Docker Desktop (only for running Supabase locally)
- Deno (only to run Edge Function tests locally)

## 2. Supabase

### Local

```bash
supabase start                 # boots Postgres, Auth, Storage, Studio
supabase db reset              # applies supabase/migrations/*
supabase status                # prints the local API URL and anon key
```

### Hosted

```bash
supabase link --project-ref <project-ref>
supabase db push               # applies migrations
```

Then in the dashboard:

1. **Authentication → Providers → LinkedIn (OIDC)** — enable it, paste the client ID/secret from
   your LinkedIn app, and add `io.jobpilot://login-callback/` to **URL Configuration →
   Redirect URLs**. Request only the `openid profile email` scopes: LinkedIn is used for profile
   import, nothing else. No scraping, no automated actions.
2. **Storage** — the `cvs` bucket and its per-user folder policy are created by the migration.

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

## 5. Scheduling cron jobs (phase 2+)

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

Only `lib/` and the pubspec are in version control, so generate the platform folders once:

```bash
cd app
flutter create . --platforms=web,android,ios --project-name jobpilot --org io.jobpilot
flutter pub get
dart run build_runner build --delete-conflicting-outputs   # generates *.freezed.dart / *.g.dart
```

The codegen step is required before the first build — the freezed models won't compile without it.

### Chrome (fastest preview)

Needs nothing beyond the Flutter SDK and Chrome — no Android SDK, JDK, or Visual Studio.

```bash
flutter run -d chrome --web-port=3000 \
  --dart-define=SUPABASE_URL=https://<project-ref>.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=<anon key>
```

Pin `--web-port` so the redirect URL stays stable, then set **Authentication → URL Configuration
→ Site URL** to `http://localhost:3000` and add it to Redirect URLs. On web `oauthRedirect` is
null and Supabase uses that Site URL; the `io.jobpilot://` scheme applies to mobile only.

### Mobile

```bash
flutter run \
  --dart-define=SUPABASE_URL=https://<project-ref>.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=<anon key>
```

Release builds:

```bash
flutter build apk --release --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
flutter build ipa --release --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
```

### Deep link registration (needed for LinkedIn sign-in)

**Android** — in `android/app/src/main/AndroidManifest.xml`, inside the main `<activity>`:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="io.jobpilot" android:host="login-callback" />
</intent-filter>
```

**iOS** — in `ios/Runner/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array><dict>
  <key>CFBundleURLSchemes</key>
  <array><string>io.jobpilot</string></array>
</dict></array>
```

## Testing phase 1

1. Sign up with email/password → a `profiles` row is created by the `on_auth_user_created` trigger.
2. Tap **Add CV**, pick a PDF or DOCX, give it a label. Upload → parse runs → skills, roles and
   education appear when you expand the card. If parsing fails, the card offers **Retry**.
3. Drag the **Daily send cap** slider; reopen the app and confirm it persisted.
4. Sign in as a second user and confirm the first user's CVs are invisible (RLS).
