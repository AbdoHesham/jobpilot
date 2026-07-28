import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CvService } from '../../core/cv.service';
import { JobService, type Job, type JobStatus } from '../../core/job.service';
import { SearchProfileService } from '../../core/search-profile.service';

const STATUS_TABS: ReadonlyArray<{ value: JobStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
  { value: 'dismissed', label: 'Dismissed' },
];

/** Boards we call out by name; anything else falls into "Other". */
const KNOWN_PLATFORMS = ['LinkedIn', 'Indeed', 'Glassdoor'] as const;

@Component({
  selector: 'app-jobs',
  imports: [RouterLink],
  template: `
    <div class="top">
      <div>
        <h1>Jobs</h1>
        @if (searchProfiles.active(); as active) {
          <p class="muted sub">
            {{ active.title }} · {{ active.location || 'Anywhere' }} ·
            {{ active.country.toUpperCase() }}
          </p>
        }
      </div>
      <button class="btn" type="button" [disabled]="busy() || !searchProfiles.active()" (click)="refresh()">
        {{ busy() ? 'Refreshing…' : 'Refresh' }}
      </button>
    </div>

    @if (message(); as text) {
      <p class="banner" [class.ok]="messageIsOk()" role="status">{{ text }}</p>
    }

    @if (!searchProfiles.profiles().length) {
      <div class="card empty">
        <h2>No search profiles yet</h2>
        <p class="muted">
          Create a <a routerLink="/searches">search profile</a> first — the feed is built from it,
          and you pick which one is active from the header.
        </p>
      </div>
    } @else {
      <div class="tabs" role="tablist" aria-label="Job status">
        @for (tab of statusTabs; track tab.value) {
          <button
            class="tab"
            type="button"
            role="tab"
            [class.active]="status() === tab.value"
            [attr.aria-selected]="status() === tab.value"
            (click)="selectStatus(tab.value)"
          >
            {{ tab.label }}
          </button>
        }
      </div>

      <div class="tabs platforms" role="tablist" aria-label="Job platform">
        @for (tab of platformTabs(); track tab.value) {
          <button
            class="tab tab--platform"
            type="button"
            role="tab"
            [class.active]="platform() === tab.value"
            [attr.aria-selected]="platform() === tab.value"
            (click)="platform.set(tab.value)"
          >
            {{ tab.label }} <span class="count">{{ tab.count }}</span>
          </button>
        }
      </div>

      @if (jobService.isLoading()) {
        <div class="card skeleton" aria-hidden="true"></div>
        <div class="card skeleton" aria-hidden="true"></div>
      } @else if (!visibleJobs().length) {
        <div class="card empty">
          <h2>Nothing here</h2>
          <p class="muted">
            @if (jobs().length) {
              No {{ status() }} jobs on {{ platform() }}. Try another platform tab.
            } @else {
              Hit Refresh to pull the latest postings for this search.
            }
          </p>
        </div>
      } @else {
        <ul class="list">
          @for (job of visibleJobs(); track job.id) {
            <li class="card item">
              <div class="head">
                <div class="titles">
                  <h2>{{ job.title }}</h2>
                  <p class="muted meta">
                    {{ job.company_name || 'Unknown company' }}
                    @if (job.location) {
                      · {{ job.location }}
                    }
                    @if (job.salary_text) {
                      · {{ job.salary_text }}
                    }
                  </p>
                </div>
                <div class="badges">
                  <span class="badge platform" [attr.data-platform]="job.publisher">
                    {{ job.publisher || 'Unknown source' }}
                  </span>
                  <span class="badge score" [class.strong]="job.match_score >= 0.5">
                    {{ percent(job.match_score) }}% match
                  </span>
                </div>
              </div>

              @if (job.description) {
                <p class="snippet">{{ snippet(job.description) }}</p>
              }

              <div class="actions">
                @if (job.apply_url) {
                  <a class="btn" [href]="job.apply_url" target="_blank" rel="noopener noreferrer" (click)="apply(job)">
                    Apply on {{ job.publisher || 'site' }}
                  </a>
                } @else {
                  <span class="muted meta">No application link provided.</span>
                }
                @if (job.status !== 'saved') {
                  <button class="btn btn--ghost" type="button" (click)="setStatus(job, 'saved')">Save</button>
                }
                @if (job.status !== 'dismissed') {
                  <button class="btn btn--ghost" type="button" (click)="setStatus(job, 'dismissed')">Dismiss</button>
                }
                @if (job.status !== 'applied') {
                  <button class="btn btn--ghost" type="button" (click)="apply(job)">Mark applied</button>
                }
              </div>
            </li>
          }
        </ul>
      }
    }
  `,
  styles: `
    .top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }
    .top h1 {
      margin: 0;
    }
    .sub {
      margin: 0.2rem 0 0;
      font-size: 0.85rem;
    }
    .tabs {
      display: flex;
      gap: 0.35rem;
      margin: 1rem 0 0;
      flex-wrap: wrap;
    }
    .tabs.platforms {
      margin: 0.5rem 0 1.25rem;
    }
    .tab {
      font: inherit;
      font-size: 0.88rem;
      padding: 0.35rem 0.8rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--muted);
      cursor: pointer;
    }
    .tab.active {
      background: var(--surface);
      color: var(--text);
      border-color: var(--accent);
    }
    .tab--platform {
      font-size: 0.82rem;
    }
    .count {
      opacity: 0.65;
      margin-left: 0.15rem;
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 1rem;
    }
    .item {
      padding: 1.25rem;
    }
    .head {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
    }
    .head h2 {
      font-size: 1.05rem;
      margin: 0;
    }
    .meta {
      font-size: 0.82rem;
      margin: 0.2rem 0 0;
    }
    .badges {
      display: flex;
      gap: 0.4rem;
      flex-shrink: 0;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .badge {
      font-size: 0.72rem;
      padding: 0.12rem 0.5rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      color: var(--muted);
      white-space: nowrap;
    }
    .badge.platform[data-platform='LinkedIn'] {
      border-color: #0a66c2;
      color: #0a66c2;
    }
    .badge.platform[data-platform='Indeed'] {
      border-color: #2557a7;
      color: #2557a7;
    }
    .badge.platform[data-platform='Glassdoor'] {
      border-color: #0caa41;
      color: #0caa41;
    }
    .badge.score.strong {
      border-color: var(--success);
      color: var(--success);
    }
    .snippet {
      margin: 0.85rem 0 0;
      font-size: 0.9rem;
      color: var(--muted);
    }
    .actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .actions .btn {
      text-decoration: none;
    }
    .empty {
      padding: 2.5rem;
      text-align: center;
    }
    .skeleton {
      height: 110px;
      margin-bottom: 1rem;
      background: linear-gradient(90deg, var(--surface), var(--border), var(--surface));
      background-size: 200% 100%;
      animation: shimmer 1.2s linear infinite;
    }
    .banner.ok {
      border-color: var(--success);
      color: var(--success);
    }
    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton {
        animation: none;
      }
    }
  `,
})
export class Jobs {
  protected readonly jobService = inject(JobService);
  protected readonly searchProfiles = inject(SearchProfileService);
  private readonly cvService = inject(CvService);

  protected readonly statusTabs = STATUS_TABS;
  protected readonly jobs = this.jobService.jobs;
  protected readonly status = signal<JobStatus>('new');
  protected readonly platform = signal<string>('All');
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly messageIsOk = signal(false);

  /** Counts come from the loaded page, so switching platform costs no request. */
  protected readonly platformTabs = computed(() => {
    const all = this.jobs();
    const named = KNOWN_PLATFORMS.map((name) => ({
      value: name as string,
      label: name as string,
      count: all.filter((job) => job.publisher === name).length,
    }));
    const other = all.filter(
      (job) => !KNOWN_PLATFORMS.includes((job.publisher ?? '') as (typeof KNOWN_PLATFORMS)[number]),
    ).length;

    return [
      { value: 'All', label: 'All', count: all.length },
      ...named,
      ...(other ? [{ value: 'Other', label: 'Other', count: other }] : []),
    ];
  });

  protected readonly visibleJobs = computed(() => {
    const chosen = this.platform();
    const all = this.jobs();
    if (chosen === 'All') return all;
    if (chosen === 'Other') {
      return all.filter(
        (job) => !KNOWN_PLATFORMS.includes((job.publisher ?? '') as (typeof KNOWN_PLATFORMS)[number]),
      );
    }
    return all.filter((job) => job.publisher === chosen);
  });

  constructor() {
    void this.cvService.reload().catch(() => undefined);

    // Reloads whenever the header switches search, or the status tab changes.
    effect(() => {
      const profileId = this.searchProfiles.activeId();
      const status = this.status();
      void this.jobService.reload(status, profileId).catch((error) => this.fail(error));
    });
  }

  protected percent(score: number): number {
    return Math.round(score * 100);
  }

  protected snippet(description: string): string {
    const clean = description.replace(/\s+/g, ' ').trim();
    return clean.length > 240 ? `${clean.slice(0, 240)}…` : clean;
  }

  protected selectStatus(status: JobStatus): void {
    this.status.set(status);
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

  protected async setStatus(job: Job, status: JobStatus): Promise<void> {
    try {
      await this.jobService.setStatus(job, status);
    } catch (error) {
      this.fail(error);
    }
  }

  /** Fires alongside the outbound link — the anchor still opens the posting. */
  protected async apply(job: Job): Promise<void> {
    try {
      const cvId = this.cvService.cvs()[0]?.id ?? null;
      await this.jobService.markApplied(job, cvId);
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
