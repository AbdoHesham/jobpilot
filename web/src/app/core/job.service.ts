import { inject, Service, signal } from '@angular/core';

import { SupabaseService } from './supabase.service';

export type JobStatus = 'new' | 'saved' | 'dismissed' | 'applied';

export interface Job {
  id: string;
  search_profile_id: string;
  source: string;
  publisher: string | null;
  title: string;
  company_name: string | null;
  location: string | null;
  salary_text: string | null;
  description: string | null;
  apply_url: string | null;
  match_score: number;
  status: JobStatus;
  fetched_at: string;
}

const COLUMNS =
  'id, search_profile_id, source, publisher, title, company_name, location, salary_text, description, apply_url, match_score, status, fetched_at';

@Service()
export class JobService {
  private readonly supabase = inject(SupabaseService);

  private readonly items = signal<Job[]>([]);
  private readonly loading = signal(false);

  readonly jobs = this.items.asReadonly();
  readonly isLoading = this.loading.asReadonly();

  async reload(status: JobStatus | 'all' = 'new', searchProfileId?: string | null): Promise<void> {
    this.loading.set(true);
    let query = this.supabase.client
      .from('jobs')
      .select(COLUMNS)
      .order('match_score', { ascending: false })
      .order('fetched_at', { ascending: false })
      .limit(100);
    if (status !== 'all') query = query.eq('status', status);
    if (searchProfileId) query = query.eq('search_profile_id', searchProfileId);

    const { data, error } = await query;
    this.loading.set(false);
    if (error) throw new Error(error.message);
    this.items.set((data ?? []) as Job[]);
  }

  async setStatus(job: Job, status: JobStatus): Promise<void> {
    const { error } = await this.supabase.client.from('jobs').update({ status }).eq('id', job.id);
    if (error) throw new Error(error.message);
    this.items.update((jobs) => jobs.map((j) => (j.id === job.id ? { ...j, status } : j)));
  }

  /**
   * Records that you applied. The app never submits anything — you apply on the
   * employer's page and this is the bookkeeping.
   */
  async markApplied(job: Job, cvId: string | null): Promise<void> {
    const userId = this.supabase.userId();
    if (!userId) throw new Error('Not signed in.');

    const { error } = await this.supabase.client
      .from('applications')
      .upsert(
        { user_id: userId, job_id: job.id, cv_id: cvId, status: 'applied' },
        { onConflict: 'user_id,job_id', ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    await this.setStatus(job, 'applied');
  }

  /** Asks fetch-jobs to refresh the feed; needs RAPIDAPI_KEY on the server. */
  async refresh(searchProfileId?: string): Promise<{ found: number; inserted: number }> {
    const data = await this.supabase.invokeFunction<{
      results?: Array<{ found: number; inserted: number }>;
    }>('fetch-jobs', searchProfileId ? { search_profile_id: searchProfileId } : {});

    const results = data?.results ?? [];
    return results.reduce(
      (total, r) => ({ found: total.found + r.found, inserted: total.inserted + r.inserted }),
      { found: 0, inserted: 0 },
    );
  }
}
