import { HttpError, json, requireEnv, serve } from '../_shared/util.ts';
import { fetchJobs, matchScore, type SearchCriteria } from './jsearch.ts';

interface SearchProfileRow {
  id: string;
  title: string;
  location: string | null;
  work_mode: SearchCriteria['work_mode'];
  keywords: string[];
  cvs: { parsed_json: { skills?: string[] } | null } | null;
}

/**
 * Refreshes the job feed for the caller's active search profiles.
 *
 * Invoked two ways, same code path: from the app with a user JWT (RLS scopes it
 * to that user's profiles), or from pg_cron with the service role key (RLS is
 * bypassed, so every active profile is refreshed).
 */
Deno.serve(serve(async (req, db) => {
  const apiKey = requireEnv('RAPIDAPI_KEY');

  const body = await req.json().catch(() => ({}));
  const onlyProfileId = typeof body?.search_profile_id === 'string' ? body.search_profile_id : null;

  let query = db
    .from('search_profiles')
    .select('id, title, location, work_mode, keywords, cvs(parsed_json)')
    .eq('active', true);
  if (onlyProfileId) query = query.eq('id', onlyProfileId);

  const { data: profiles, error } = await query;
  if (error) throw new Error(error.message);
  if (!profiles?.length) throw new HttpError(404, 'No active search profiles to refresh.');

  const results: Array<{ search_profile_id: string; found: number; inserted: number }> = [];

  for (const profile of profiles as unknown as SearchProfileRow[]) {
    const jobs = await fetchJobs(
      { title: profile.title, location: profile.location, work_mode: profile.work_mode },
      apiKey,
    );

    // Rank against the CV's parsed skills when they exist, the typed keywords
    // otherwise — so the feed still ranks without an Anthropic key.
    const terms = [...(profile.cvs?.parsed_json?.skills ?? []), ...(profile.keywords ?? [])];

    const rows = jobs.map((job) => ({
      search_profile_id: profile.id,
      source: 'jsearch',
      publisher: job.publisher,
      external_id: job.external_id,
      title: job.title,
      company_name: job.company_name,
      location: job.location,
      salary_text: job.salary_text,
      description: job.description,
      apply_url: job.apply_url,
      match_score: matchScore(job, terms),
    }));

    let inserted = 0;
    if (rows.length) {
      // The unique index on (source, external_id, search_profile_id) makes this
      // idempotent; re-running never duplicates or resets a job's status.
      const { data, error: insertError } = await db
        .from('jobs')
        .upsert(rows, { onConflict: 'source,external_id,search_profile_id', ignoreDuplicates: true })
        .select('id');
      if (insertError) throw new Error(insertError.message);
      inserted = data?.length ?? 0;
    }

    results.push({ search_profile_id: profile.id, found: jobs.length, inserted });
  }

  return json({ results });
}, { allowServiceRole: true }));
