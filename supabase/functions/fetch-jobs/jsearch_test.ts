// deno test --allow-net supabase/functions/fetch-jobs/jsearch_test.ts
import { assertEquals, assertRejects, assertStringIncludes } from 'jsr:@std/assert@1';
import { buildQuery, fetchJobs, formatLocation, formatSalary, matchScore } from './jsearch.ts';

const criteria = (over = {}) => ({
  title: 'Dev',
  location: null,
  work_mode: 'any' as const,
  country: 'us',
  ...over,
});

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
  assertEquals(buildQuery(criteria({ title: 'Angular Dev' })), 'Angular Dev');
  assertEquals(
    buildQuery(criteria({ title: 'Angular Dev', location: 'Berlin', work_mode: 'remote' })),
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

Deno.test('formatLocation prefers Remote, then the joined v2 field, then the parts', () => {
  assertEquals(formatLocation({ job_is_remote: true, job_location: 'Chicago, IL' }), 'Remote');
  assertEquals(formatLocation({ job_location: 'Chicago, IL', job_city: 'Chicago' }), 'Chicago, IL');
  assertEquals(formatLocation({ job_city: 'Berlin', job_country: 'DE' }), 'Berlin, DE');
  assertEquals(formatLocation({}), null);
});

Deno.test('formatSalary prefers the provider string, else composes a range', () => {
  assertEquals(formatSalary({ job_salary_string: '$120k – $150k a year' }), '$120k – $150k a year');
  assertEquals(formatSalary({}), null);
  assertEquals(
    formatSalary({ job_min_salary: 60000, job_max_salary: 80000, job_salary_currency: 'EUR', job_salary_period: 'YEAR' }),
    'EUR 60000–80000 per year',
  );
  assertEquals(formatSalary({ job_min_salary: 60000 }), '60000');
});

function stubFetch(payload: unknown, status = 200) {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (input: string | URL | Request) => {
    calls.push(input.toString());
    return Promise.resolve(new Response(JSON.stringify(payload), { status }));
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

Deno.test('fetchJobs reads the v2 data.jobs envelope and keeps every platform', async () => {
  const stub = stubFetch({
    data: {
      jobs: [
        { job_id: 'a', job_title: 'Dev', job_publisher: 'LinkedIn' },
        { job_id: 'b', job_title: 'Dev', job_publisher: 'Indeed' },
        { job_id: 'c', job_title: 'Dev', job_publisher: 'Glassdoor' },
      ],
      cursor: 'next',
    },
  });
  try {
    const jobs = await fetchJobs(criteria(), 'key');
    assertEquals(jobs.map((j) => j.publisher), ['LinkedIn', 'Indeed', 'Glassdoor']);
  } finally {
    stub.restore();
  }
});

Deno.test('fetchJobs still reads a bare data array if the provider rolls back', async () => {
  const stub = stubFetch({
    data: [{ job_id: 'a', job_title: 'Dev', job_publisher: 'LinkedIn' }],
  });
  try {
    assertEquals((await fetchJobs(criteria(), 'key')).length, 1);
  } finally {
    stub.restore();
  }
});

Deno.test('fetchJobs requests search-v2 with the country code', async () => {
  const stub = stubFetch({ data: { jobs: [] } });
  try {
    await fetchJobs(criteria({ country: 'de' }), 'key');
    assertStringIncludes(stub.calls[0], '/search-v2');
    assertStringIncludes(stub.calls[0], 'country=de');
  } finally {
    stub.restore();
  }
});

Deno.test('fetchJobs falls back to us when no country is set', async () => {
  const stub = stubFetch({ data: { jobs: [] } });
  try {
    await fetchJobs(criteria({ country: '' }), 'key');
    assertStringIncludes(stub.calls[0], 'country=us');
  } finally {
    stub.restore();
  }
});

Deno.test('fetchJobs drops entries missing an id or title', async () => {
  const stub = stubFetch({
    data: {
      jobs: [
        { job_id: 'a', job_title: 'Dev', job_publisher: 'Indeed' },
        { job_id: 'd' }, // no title
        { job_title: 'No id' },
      ],
    },
  });
  try {
    assertEquals((await fetchJobs(criteria(), 'key')).map((j) => j.external_id), ['a']);
  } finally {
    stub.restore();
  }
});

Deno.test('fetchJobs can still narrow to LinkedIn on request', async () => {
  const stub = stubFetch({
    data: {
      jobs: [
        { job_id: 'a', job_title: 'Dev', job_publisher: 'LinkedIn' },
        { job_id: 'b', job_title: 'Dev', job_publisher: 'Indeed' },
        { job_id: 'c', job_title: 'Dev', job_publisher: 'linkedin' },
      ],
    },
  });
  try {
    const jobs = await fetchJobs(criteria(), 'key', { linkedInOnly: true });
    assertEquals(jobs.map((j) => j.external_id), ['a', 'c']);
  } finally {
    stub.restore();
  }
});

Deno.test('fetchJobs surfaces an API error rather than returning nothing', async () => {
  const stub = stubFetch({ message: 'quota exceeded' }, 429);
  try {
    await assertRejects(() => fetchJobs(criteria(), 'key'), Error, '429');
  } finally {
    stub.restore();
  }
});
