import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CvService } from '../../core/cv.service';
import { JobService, type Job, type JobStatus } from '../../core/job.service';
import { SearchProfileService } from '../../core/search-profile.service';

const STATUS_TABS: ReadonlyArray<{ value: JobStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
  { value: 'dismissed', label: 'Dismissed' },
];

const KNOWN_PLATFORMS = ['LinkedIn', 'Indeed', 'Glassdoor'] as const;
const METER_SEGMENTS = 5;

@Component({
  selector: 'app-jobs',
  imports: [MatButtonModule, RouterLink],
  template: `
    <header class="masthead">
      <div>
        <p class="eyebrow">Feed</p>
        <h1>{{ searchProfiles.active()?.title || 'Jobs' }}</h1>
        @if (searchProfiles.active(); as active) {
          <p class="muted route mono">
            {{ active.location || 'Anywhere' }} · {{ active.country.toUpperCase() }} ·
            {{ active.work_mode }} · {{ windowLabel(active.date_posted) }}
          </p>
        }
      </div>
      <button
        matButton="filled"
        class="btn"
        type="button"
        [disabled]="busy() || !searchProfiles.active()"
        (click)="refresh()"
      >
        {{ busy() ? 'Refreshing…' : 'Refresh' }}
      </button>
    </header>

    @if (message(); as text) {
      <p class="banner" [class.ok]="messageIsOk()" role="status">{{ text }}</p>
    }

    @if (!searchProfiles.profiles().length) {
      <div class="card empty">
        <h2>No searches yet</h2>
        <p class="muted">
          Set up a <a routerLink="/searches">search</a> to start collecting postings, or type a job
          title in the search box above.
        </p>
      </div>
    } @else {
      <div class="filters">
        <div class="tabs" role="tablist" aria-label="Status">
          @for (tab of statusTabs; track tab.value) {
            <button
              matButton="text"
              class="tab"
              type="button"
              role="tab"
              [class.on]="status() === tab.value"
              [attr.aria-selected]="status() === tab.value"
              (click)="selectStatus(tab.value)"
            >
              {{ tab.label }}
            </button>
          }
        </div>

        <div class="tabs" role="tablist" aria-label="Platform">
          @for (tab of platformTabs(); track tab.value) {
            <button
              matButton="text"
              class="tab tab--sm"
              type="button"
              role="tab"
              [class.on]="platform() === tab.value"
              [attr.aria-selected]="platform() === tab.value"
              (click)="platform.set(tab.value)"
            >
              {{ tab.label }} <span class="mono count">{{ tab.count }}</span>
            </button>
          }
        </div>
      </div>

      @if (jobService.isLoading()) {
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
      } @else if (!visibleJobs().length) {
        <div class="card empty">
          <h2>Nothing on this board</h2>
          <p class="muted">
            @if (jobs().length) {
              No {{ status() }} postings from {{ platform() }}. Try another platform.
            } @else {
              Refresh to pull the latest postings for this search.
            }
          </p>
        </div>
      } @else {
        <ol class="board">
          @for (job of visibleJobs(); track job.id; let i = $index) {
            <li class="row card" [style.--i]="i">
              <div class="gutter">
                <span class="age mono">{{ age(job) }}</span>
                <span class="meter" [attr.aria-label]="percent(job.match_score) + '% match'">
                  @for (seg of segments; track seg) {
                    <i class="seg" [class.lit]="seg <= filled(job.match_score)"></i>
                  }
                </span>
                <span class="pct mono">{{ percent(job.match_score) }}%</span>
              </div>

              <div class="body">
                <div class="head">
                  <h2>{{ job.title }}</h2>
                  <span class="tag" [attr.data-platform]="job.publisher">
                    {{ job.publisher || 'Direct' }}
                  </span>
                </div>
                <p class="muted meta mono">
                  {{ job.company_name || 'Unknown company' }}
                  @if (job.location) {
                    · {{ job.location }}
                  }
                  @if (job.salary_text) {
                    · {{ job.salary_text }}
                  }
                </p>
                @if (job.description) {
                  <p class="snippet">{{ snippet(job.description) }}</p>
                }
                <div class="actions">
                  @if (job.apply_url) {
                    <a
                      matButton="filled"
                      class="btn"
                      [href]="job.apply_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      (click)="apply(job)"
                    >
                      Apply on {{ job.publisher || 'site' }}
                    </a>
                  }
                  @if (job.status !== 'saved') {
                    <button
                      matButton="outlined"
                      class="btn btn--ghost"
                      type="button"
                      (click)="setStatus(job, 'saved')"
                    >
                      Save
                    </button>
                  }
                  @if (job.status !== 'applied') {
                    <button
                      matButton="outlined"
                      class="btn btn--ghost"
                      type="button"
                      (click)="apply(job)"
                    >
                      Mark applied
                    </button>
                  }
                  @if (job.status !== 'dismissed') {
                    <button
                      matButton="outlined"
                      class="btn btn--ghost"
                      type="button"
                      (click)="setStatus(job, 'dismissed')"
                    >
                      Dismiss
                    </button>
                  }
                </div>
              </div>
            </li>
          }
        </ol>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .masthead {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid var(--ink);
      margin-bottom: 1rem;
    }
    .masthead h1 {
      margin: 0.1rem 0 0.25rem;
    }
    .route {
      margin: 0;
      font-size: 0.76rem;
      text-transform: capitalize;
    }
    .filters {
      display: grid;
      gap: 0.4rem;
      margin-bottom: 1.1rem;
    }
    .tabs {
      display: flex;
      gap: 0.3rem;
      flex-wrap: wrap;
    }
    .tab {
      --mat-button-text-label-text-color: var(--muted);
      --mat-button-text-container-height: auto;
      --mat-button-text-container-shape: 999px;

      font: inherit;
      font-size: 0.86rem;
      padding: 0.3rem 0.7rem;
      border: 1px solid transparent;
      border-radius: 999px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
    }
    .tab:hover {
      color: var(--ink);
    }
    .tab.on {
      --mat-button-text-label-text-color: var(--signal);

      background: var(--signal-wash);
      border-color: var(--signal);
      color: var(--signal);
      font-weight: 500;
    }
    .tab--sm {
      font-size: 0.78rem;
    }
    .count {
      opacity: 0.7;
      font-size: 0.72rem;
    }

    .board {
      min-width: 0;
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.6rem;
    }
    .row {
      min-width: 0;
      display: grid;
      grid-template-columns: 5.5rem 1fr;
      padding: 0;
      overflow: hidden;
      animation: flip-in 260ms cubic-bezier(0.2, 0.7, 0.3, 1) backwards;
      animation-delay: calc(var(--i) * 28ms);
    }
    @keyframes flip-in {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }

    /* The data gutter: age, match meter, percentage — the board's left column. */
    .gutter {
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 0.35rem;
      padding: 1rem 0.5rem;
      background: var(--rail);
      border-right: 1px solid var(--rule);
    }
    .age {
      font-size: 0.72rem;
      color: var(--muted);
      white-space: nowrap;
    }
    .meter {
      display: flex;
      gap: 2px;
    }
    .seg {
      width: 6px;
      height: 12px;
      border-radius: 1px;
      background: var(--rule);
    }
    .seg.lit {
      background: var(--signal);
    }
    .pct {
      font-size: 0.72rem;
      color: var(--ink);
    }

    .body {
      padding: 0.9rem 1rem 1rem;
      min-width: 0;
    }
    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .head h2 {
      min-width: 0;
      font-size: 1rem;
      margin: 0;
      overflow-wrap: anywhere;
    }
    .tag {
      flex-shrink: 0;
      font-family: var(--font-mono);
      font-size: 0.66rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 0.1rem 0.45rem;
      border: 1px solid var(--rule);
      border-radius: 3px;
      color: var(--muted);
    }
    .tag[data-platform='LinkedIn'] {
      border-color: #0a66c2;
      color: #0a66c2;
    }
    .tag[data-platform='Indeed'] {
      border-color: #2557a7;
      color: #2557a7;
    }
    .tag[data-platform='Glassdoor'] {
      border-color: #0b7d3e;
      color: #0b7d3e;
    }
    :host-context(html[data-theme='dark']) .tag[data-platform='LinkedIn'] {
      border-color: #5aa9ee;
      color: #5aa9ee;
    }
    :host-context(html[data-theme='dark']) .tag[data-platform='Indeed'] {
      border-color: #7aa5e8;
      color: #7aa5e8;
    }
    :host-context(html[data-theme='dark']) .tag[data-platform='Glassdoor'] {
      border-color: #4ec98a;
      color: #4ec98a;
    }
    .meta {
      margin: 0.25rem 0 0;
      font-size: 0.76rem;
    }
    .snippet {
      margin: 0.6rem 0 0;
      font-size: 0.88rem;
      color: var(--muted);
    }
    .actions {
      display: flex;
      gap: 0.4rem;
      margin-top: 0.9rem;
      flex-wrap: wrap;
    }
    .actions .btn {
      font-size: 0.84rem;
      padding: 0.4rem 0.7rem;
    }

    @media (max-width: 620px) {
      .row {
        grid-template-columns: 1fr;
      }
      .gutter {
        grid-auto-flow: column;
        justify-content: start;
        gap: 0.6rem;
        padding: 0.5rem 1rem;
        border-right: none;
        border-bottom: 1px solid var(--rule);
      }
    }
  `,
})
export class Jobs {
  protected readonly jobService = inject(JobService);
  protected readonly searchProfiles = inject(SearchProfileService);
  private readonly cvService = inject(CvService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly statusTabs = STATUS_TABS;
  protected readonly segments = Array.from({ length: METER_SEGMENTS }, (_, i) => i + 1);
  protected readonly jobs = this.jobService.jobs;
  protected readonly status = computed<JobStatus>(() => {
    const value = this.queryParams().get('status');
    return STATUS_TABS.some((tab) => tab.value === value) ? (value as JobStatus) : 'new';
  });
  private readonly searchRequest = computed(() => this.queryParams().get('search'));
  protected readonly platform = signal<string>('All');
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly messageIsOk = signal(false);
  private handledSearchRequest: string | null = null;
  private loadRevision = 0;

  protected readonly platformTabs = computed(() => {
    const all = this.jobs();
    const isOther = (job: Job) =>
      !KNOWN_PLATFORMS.includes((job.publisher ?? '') as (typeof KNOWN_PLATFORMS)[number]);
    const other = all.filter(isOther).length;

    return [
      { value: 'All', label: 'All', count: all.length },
      ...KNOWN_PLATFORMS.map((name) => ({
        value: name as string,
        label: name as string,
        count: all.filter((job) => job.publisher === name).length,
      })),
      ...(other ? [{ value: 'Other', label: 'Other', count: other }] : []),
    ];
  });

  protected readonly visibleJobs = computed(() => {
    const chosen = this.platform();
    const all = this.jobs();
    if (chosen === 'All') return all;
    const isKnown = (job: Job) =>
      KNOWN_PLATFORMS.includes((job.publisher ?? '') as (typeof KNOWN_PLATFORMS)[number]);
    if (chosen === 'Other') return all.filter((job) => !isKnown(job));
    return all.filter((job) => job.publisher === chosen);
  });

  constructor() {
    void this.cvService.reload().catch(() => undefined);

    effect(() => {
      const profileId = this.searchProfiles.activeId();
      const status = this.status();
      const searchRequest = this.searchRequest();
      const ensureResults = !!searchRequest && searchRequest !== this.handledSearchRequest;
      if (ensureResults) this.handledSearchRequest = searchRequest;
      void this.loadJobs(profileId, status, ensureResults);
    });
  }

  protected selectStatus(status: JobStatus): void {
    this.platform.set('All');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status, search: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected percent(score: number): number {
    return Math.round(score * 100);
  }

  /** How many of the meter's segments are lit, always at least one for a hit. */
  protected filled(score: number): number {
    if (score <= 0) return 0;
    return Math.max(1, Math.round(score * METER_SEGMENTS));
  }

  /** Compact age, e.g. 3h / 2d / 5w — falls back to fetch time when unknown. */
  protected age(job: Job): string {
    const iso = job.posted_at ?? job.fetched_at;
    if (!iso) return '—';
    const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
    if (!Number.isFinite(hours) || hours < 0) return '—';
    if (hours < 1) return 'new';
    if (hours < 24) return `${Math.floor(hours)}h`;
    const days = Math.floor(hours / 24);
    if (days < 14) return `${days}d`;
    return `${Math.floor(days / 7)}w`;
  }

  protected windowLabel(value: string): string {
    return (
      {
        today: 'last 24 hours',
        '3days': 'last 3 days',
        week: 'last week',
        month: 'last month',
        all: 'any time',
      }[value] ?? value
    );
  }

  protected snippet(description: string): string {
    const clean = description.replace(/\s+/g, ' ').trim();
    return clean.length > 200 ? `${clean.slice(0, 200)}…` : clean;
  }

  protected async refresh(): Promise<void> {
    this.busy.set(true);
    this.message.set(null);
    try {
      const { found, inserted } = await this.jobService.refresh(
        this.searchProfiles.activeId() ?? undefined,
      );
      await this.jobService.reload(this.status(), this.searchProfiles.activeId());
      this.ok(`Found ${found} postings, ${inserted} new.`);
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }

  private async loadJobs(
    profileId: string | null,
    status: JobStatus,
    ensureResults: boolean,
  ): Promise<void> {
    const revision = ++this.loadRevision;
    if (ensureResults) this.message.set(null);

    try {
      await this.jobService.reload(status, profileId);
      if (revision !== this.loadRevision) return;

      // Explicit searches reuse cached jobs. Only an empty New board spends a
      // provider request, so normal navigation does not consume API quota.
      if (ensureResults && profileId && status === 'new' && !this.jobs().length) {
        this.busy.set(true);
        const { found, inserted } = await this.jobService.refresh(profileId);
        if (revision !== this.loadRevision) return;
        await this.jobService.reload(status, profileId);
        if (revision !== this.loadRevision) return;
        this.ok(`Found ${found} postings, ${inserted} new.`);
      }
    } catch (error) {
      if (revision === this.loadRevision) this.fail(error);
    } finally {
      if (revision === this.loadRevision) this.busy.set(false);
    }
  }

  protected async setStatus(job: Job, status: JobStatus): Promise<void> {
    try {
      await this.jobService.setStatus(job, status);
    } catch (error) {
      this.fail(error);
    }
  }

  protected async apply(job: Job): Promise<void> {
    try {
      await this.jobService.markApplied(job, this.cvService.cvs()[0]?.id ?? null);
    } catch (error) {
      this.fail(error);
    }
  }

  private ok(text: string): void {
    this.messageIsOk.set(true);
    this.message.set(text);
  }

  private fail(error: unknown): void {
    this.messageIsOk.set(false);
    this.message.set(error instanceof Error ? error.message : String(error));
  }
}
