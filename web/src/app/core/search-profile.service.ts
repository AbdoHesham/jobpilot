import { computed, inject, Service, signal } from '@angular/core';

import { SupabaseService } from './supabase.service';

const ACTIVE_KEY = 'jobpilot.active-search-profile';

export type WorkMode = 'remote' | 'hybrid' | 'onsite' | 'any';

export const WORK_MODES: ReadonlyArray<{ value: WorkMode; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
];

/** Countries JSearch covers well; the code goes straight to its `country` param. */
export const COUNTRIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'us', label: 'United States' },
  { value: 'gb', label: 'United Kingdom' },
  { value: 'de', label: 'Germany' },
  { value: 'nl', label: 'Netherlands' },
  { value: 'ae', label: 'United Arab Emirates' },
  { value: 'sa', label: 'Saudi Arabia' },
  { value: 'eg', label: 'Egypt' },
  { value: 'ca', label: 'Canada' },
  { value: 'au', label: 'Australia' },
  { value: 'in', label: 'India' },
];

export interface SearchProfile {
  id: string;
  title: string;
  location: string | null;
  work_mode: WorkMode;
  country: string;
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
  country: string;
  min_salary: number | null;
  keywords: string[];
  cv_id: string | null;
}

const COLUMNS =
  'id, title, location, work_mode, country, min_salary, keywords, cv_id, active, created_at';

@Service()
export class SearchProfileService {
  private readonly supabase = inject(SupabaseService);

  private readonly items = signal<SearchProfile[]>([]);
  private readonly loading = signal(false);

  readonly profiles = this.items.asReadonly();
  readonly isLoading = this.loading.asReadonly();

  /**
   * The search the whole app is currently scoped to. Kept here rather than in a
   * route param so switching it doesn't reset where you are, and persisted so
   * you aren't re-picking your search on every visit.
   */
  private readonly selectedId = signal<string | null>(localStorage.getItem(ACTIVE_KEY));

  /** Falls back to the first profile when the stored one was deleted elsewhere. */
  readonly active = computed(() => {
    const all = this.items();
    if (!all.length) return null;
    return all.find((p) => p.id === this.selectedId()) ?? all[0];
  });

  readonly activeId = computed(() => this.active()?.id ?? null);

  setActive(id: string | null): void {
    this.selectedId.set(id);
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  }

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
    if (this.selectedId() === id) this.setActive(null);
    await this.reload();
  }

  /** "react, typescript , node" → ['react','typescript','node'] */
  static parseKeywords(raw: string): string[] {
    return [...new Set(raw.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean))];
  }
}
