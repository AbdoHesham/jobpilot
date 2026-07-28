// deno test --allow-net supabase/functions/fetch-jobs/jsearch_test.ts
import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { buildQuery, fetchJobs, formatLocation, formatSalary, matchScore } from './jsearch.ts';

const job = (over: Partial<Parameters<typeof matchScore>[0]> = {}) => ({
  external_id: '1',
  title: 'Senior Frontend Developer',
  company_name: 'Acme',
  location: 'Berlin',
  salary_text: null,
  description: 'We use React and TypeScript with a GraphQL API.',
  apply_url: 'https://example.com',
  publisher: 'LinkedIn',
  ...over,
});

Deno.test('buildQuery folds location and remote into the query string', () => {
  assertEquals(buildQuery({ title: 'Angular Dev', location: null, work_mode: 'any' }), 'Angular Dev');
  assertEquals(
    buildQuery({ title: 'Angular Dev', location: 'Berlin', work_mode: 'remote' }),
    'Angular Dev in Berlin remote',
  );
});

Deno.test('matchScore is the fraction of terms present in title + description', () => {
  assertEquals(matchScore(job(), ['react', 'typescript', 'graphql']), 1);
  assertEquals(matchScore(job(), ['react', 'rust']), 0.5);
  assertEquals(matchScore(job(), ['rust']), 0);
});

Deno.test('matchScore is case-insensitive and ignores duplicates and blanks', () => {
  assertEquals(matchScore(job(), ['React', 'react', '  ', 'TYPESCRIPT']), 1);
});

Deno.test('matchScore with no usable terms is 0, not NaN', () => {
  assertEquals(matchScore(job(), []), 0);
  assertEquals(matchScore(job(), ['', '   ']), 0);
});

Deno.test('matchScore matches against the title too', () => {
  assertEquals(matchScore(job({ description: null }), ['frontend']), 1);
});

Deno.test('formatLocation prefers Remote, else joins the parts it has', () => {
  assertEquals(formatLocation({ job_is_remote: true, job_city: 'Berlin' }), 'Remote');
  assertEquals(formatLocation({ job_city: 'Berlin', job_country: 'DE' }), 'Berlin, DE');
  assertEquals(formatLocation({}), null);
});

Deno.test('formatSalary handles one-sided and absent ranges', () => {
  assertEquals(formatSalary({}), null);
  assertEquals(
    formatSalary({ job_min_salary: 60000, job_max_salary: 80000, job_salary_currency: 'EUR', job_salary_period: 'YEAR' }),
    'EUR 60000–80000 per year',
  );
  assertEquals(formatSalary({ job_min_salary: 60000 }), '60000');
});

function stubFetch(payload: unknown, status = 200) {
  const original = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(new Response(JSON.stringify(payload), { status }));
  return () => {
    globalThis.fetch = original;
  };
}

Deno.test('fetchJobs keeps only LinkedIn postings by default', async () => {
  const restore = stubFetch({
    data: [
      { job_id: 'a', job_title: 'Dev', job_publisher: 'LinkedIn' },
      { job_id: 'b', job_title: 'Dev', job_publisher: 'Indeed' },
      { job_id: 'c', job_title: 'Dev', job_publisher: 'linkedin' },
      { job_id: 'd' }, // no title — dropped
    ],
  });
  try {
    const jobs = await fetchJobs({ title: 'Dev', location: null, work_mode: 'any' }, 'key');
    assertEquals(jobs.map((j) => j.external_id), ['a', 'c']);
  } finally {
    restore();
  }
});

Deno.test('fetchJobs can return every publisher', async () => {
  const restore = stubFetch({
    data: [
      { job_id: 'a', job_title: 'Dev', job_publisher: 'LinkedIn' },
      { job_id: 'b', job_title: 'Dev', job_publisher: 'Indeed' },
    ],
  });
  try {
    const jobs = await fetchJobs({ title: 'Dev', location: null, work_mode: 'any' }, 'key', {
      linkedInOnly: false,
    });
    assertEquals(jobs.length, 2);
  } finally {
    restore();
  }
});

Deno.test('fetchJobs surfaces an API error rather than returning nothing', async () => {
  const restore = stubFetch({ message: 'quota exceeded' }, 429);
  try {
    await assertRejects(
      () => fetchJobs({ title: 'Dev', location: null, work_mode: 'any' }, 'key'),
      Error,
      '429',
    );
  } finally {
    restore();
  }
});
