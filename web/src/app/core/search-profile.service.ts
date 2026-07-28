import { inject, Service, signal } from '@angular/core';

import { SupabaseService } from './supabase.service';

export type WorkMode = 'remote' | 'hybrid' | 'onsite' | 'any';

export const WORK_MODES: ReadonlyArray<{ value: WorkMode; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
];

export interface SearchProfile {
  id: string;
  title: string;
  location: string | null;
  work_mode: WorkMode;
  min_salary: number | null;
  keywords: string[];
  cv_id: string | null;
  active: boolean;
  created_at: string;
}

export interface SearchProfileInput {
  title: string;
  location: string | null;
  work_mode: WorkMode;
  min_salary: number | null;
  keywords: string[];
  cv_id: string | null;
}

const COLUMNS = 'id, title, location, work_mode, min_salary, keywords, cv_id, active, created_at';

@Service()
export class SearchProfileService {
  private readonly supabase = inject(SupabaseService);

  private readonly items = signal<SearchProfile[]>([]);
  private readonly loading = signal(false);

  readonly profiles = this.items.asReadonly();
  readonly isLoading = this.loading.asReadonly();

  async reload(): Promise<void> {
    this.loading.set(true);
    const { data, error } = await this.supabase.client
      .from('search_profiles')
      .select(COLUMNS)
      .order('created_at', { ascending: false });
    this.loading.set(false);
    if (error) throw new Error(error.message);
    this.items.set((data ?? []) as SearchProfile[]);
  }

  async create(input: SearchProfileInput): Promise<void> {
    const userId = this.supabase.userId();
    if (!userId) throw new Error('Not signed in.');

    const { error } = await this.supabase.client
      .from('search_profiles')
      .insert({ ...input, user_id: userId });
    if (error) throw new Error(error.message);
    await this.reload();
  }

  async update(id: string, patch: Partial<SearchProfileInput & { active: boolean }>): Promise<void> {
    const { error } = await this.supabase.client.from('search_profiles').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
    await this.reload();
  }

  /** Deleting cascades to that profile's jobs, by the migration's foreign key. */
  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('search_profiles').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await this.reload();
  }

  /** "react, typescript , node" → ['react','typescript','node'] */
  static parseKeywords(raw: string): string[] {
    return [...new Set(raw.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean))];
  }
}
