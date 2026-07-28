import { computed, inject, Service, signal } from '@angular/core';

import { SupabaseService } from './supabase.service';

const ACTIVE_KEY = 'jobpilot.active-search-profile';
const HISTORY_KEY = 'jobpilot.search-history';
const HISTORY_LIMIT = 12;

function readHistory(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

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

export type DatePosted = 'all' | 'today' | '3days' | 'week' | 'month';

/** How far back a search looks. Values map straight to the provider's vocabulary. */
export const DATE_WINDOWS: ReadonlyArray<{ value: DatePosted; label: string }> = [
  { value: 'today', label: 'Last 24 hours' },
  { value: '3days', label: 'Last 3 days' },
  { value: 'week', label: 'Last week' },
  { value: 'month', label: 'Last month' },
  { value: 'all', label: 'Any time' },
];

export interface SearchProfile {
  id: string;
  title: string;
  location: string | null;
  work_mode: WorkMode;
  country: string;
  date_posted: DatePosted;
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
  date_posted: DatePosted;
  min_salary: number | null;
  keywords: string[];
  cv_id: string | null;
}

const COLUMNS =
  'id, title, location, work_mode, country, date_posted, min_salary, keywords, cv_id, active, created_at';

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

  /** Recently typed searches, most recent first. */
  private readonly typedHistory = signal<string[]>(readHistory());

  /** What the quick-search dropdown offers: past terms, then saved searches. */
  readonly suggestions = computed(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const term of [...this.typedHistory(), ...this.items().map((p) => p.title)]) {
      const key = term.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(term.trim());
    }
    return out;
  });

  rememberTerm(term: string): void {
    const trimmed = term.trim();
    if (!trimmed) return;
    const next = [trimmed, ...this.typedHistory().filter((t) => t.toLowerCase() !== trimmed.toLowerCase())]
      .slice(0, HISTORY_LIMIT);
    this.typedHistory.set(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  clearHistory(): void {
    this.typedHistory.set([]);
    localStorage.removeItem(HISTORY_KEY);
  }

  /**
   * Backs the quick search: reuses a saved search with the same title rather
   * than piling up duplicates, and otherwise creates one that inherits the
   * current search's country and work mode so a one-word search still returns
   * relevant postings.
   */
  async findOrCreateByTitle(title: string): Promise<{ profile: SearchProfile; created: boolean }> {
    const trimmed = title.trim();
    if (!trimmed) throw new Error('Enter a job title to search for.');

    const match = (p: SearchProfile) => p.title.trim().toLowerCase() === trimmed.toLowerCase();
    const existing = this.items().find(match);
    if (existing) return { profile: existing, created: false };

    const base = this.active();
    await this.create({
      title: trimmed,
      location: base?.location ?? null,
      work_mode: base?.work_mode ?? 'any',
      country: base?.country ?? 'us',
      date_posted: base?.date_posted ?? 'week',
      min_salary: null,
      keywords: [],
      cv_id: base?.cv_id ?? null,
    });

    const created = this.items().find(match);
    if (!created) throw new Error('Could not create that search.');
    return { profile: created, created: true };
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
