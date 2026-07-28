/**
 * JSearch (RapidAPI) indexes Google for Jobs, which includes LinkedIn postings.
 * We read the aggregator, never LinkedIn itself — no scraping, no unofficial API.
 *
 * Endpoint is /search-v2: it wraps the results in `data.jobs` (v1 returned a bare
 * `data` array) and requires a `country` code.
 */

export interface FetchedJob {
  external_id: string;
  title: string;
  company_name: string | null;
  location: string | null;
  salary_text: string | null;
  description: string | null;
  apply_url: string | null;
  publisher: string | null;
}

export interface SearchCriteria {
  title: string;
  location: string | null;
  work_mode: 'remote' | 'hybrid' | 'onsite' | 'any';
  country: string;
}

interface JSearchJob {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  job_publisher?: string;
  job_apply_link?: string;
  job_description?: string;
  job_location?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_is_remote?: boolean;
  job_salary_string?: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
  job_salary_period?: string;
}

export function buildQuery(criteria: SearchCriteria): string {
  const parts = [criteria.title];
  if (criteria.location) parts.push(`in ${criteria.location}`);
  if (criteria.work_mode === 'remote') parts.push('remote');
  return parts.join(' ');
}

export function formatLocation(job: JSearchJob): string | null {
  if (job.job_is_remote) return 'Remote';
  // v2 supplies a pre-joined location; fall back to the parts for older payloads.
  if (job.job_location) return job.job_location;
  const parts = [job.job_city, job.job_state, job.job_country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function formatSalary(job: JSearchJob): string | null {
  if (job.job_salary_string) return job.job_salary_string;

  const { job_min_salary: min, job_max_salary: max, job_salary_currency: currency, job_salary_period: period } = job;
  if (!min && !max) return null;
  const money = min && max ? `${min}–${max}` : String(min ?? max);
  return [currency, money, period && `per ${period.toLowerCase()}`].filter(Boolean).join(' ');
}

/**
 * Scores a job by how much of what the user cares about actually appears in the
 * posting. Deliberately crude — word presence, not semantics — but it needs no
 * model call, so refreshing a feed is free.
 */
export function matchScore(job: FetchedJob, terms: readonly string[]): number {
  const unique = [...new Set(terms.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (!unique.length) return 0;

  const haystack = `${job.title} ${job.description ?? ''}`.toLowerCase();
  const hits = unique.filter((term) => haystack.includes(term)).length;
  return Math.round((hits / unique.length) * 100) / 100;
}

export async function fetchJobs(
  criteria: SearchCriteria,
  apiKey: string,
  { linkedInOnly = false, pages = 1 } = {},
): Promise<FetchedJob[]> {
  const url = new URL('https://jsearch.p.rapidapi.com/search-v2');
  url.searchParams.set('query', buildQuery(criteria));
  url.searchParams.set('country', criteria.country || 'us');
  url.searchParams.set('num_pages', String(pages));
  url.searchParams.set('date_posted', 'all');

  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`JSearch responded ${response.status}: ${body.slice(0, 200)}`);
  }

  const payload = (await response.json()) as { data?: { jobs?: JSearchJob[] } | JSearchJob[] };
  // Tolerate both envelopes so a provider rollback doesn't blank the feed.
  const jobs = Array.isArray(payload.data) ? payload.data : (payload.data?.jobs ?? []);

  return jobs
    .filter((job) => job.job_id && job.job_title)
    .filter((job) => !linkedInOnly || (job.job_publisher ?? '').toLowerCase() === 'linkedin')
    .map((job) => ({
      external_id: job.job_id!,
      title: job.job_title!,
      company_name: job.employer_name ?? null,
      location: formatLocation(job),
      salary_text: formatSalary(job),
      description: job.job_description?.slice(0, 8000) ?? null,
      apply_url: job.job_apply_link ?? null,
      publisher: job.job_publisher ?? null,
    }));
}
