import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { JobService } from '../../core/job.service';
import { SearchProfileService } from '../../core/search-profile.service';

/**
 * Search any job title from anywhere in the app. A native <datalist> supplies
 * the history dropdown — it opens on click, filters as you type and is keyboard
 * accessible without a line of popup code.
 */
@Component({
  selector: 'app-quick-search',
  template: `
    <form class="quick" role="search" (submit)="go($event)">
      <label class="sr-only" for="quick-search">Search job titles</label>
      <input
        id="quick-search"
        type="search"
        name="q"
        list="quick-search-history"
        autocomplete="off"
        placeholder="Search any job title…"
        [value]="term()"
        [disabled]="busy()"
        (input)="term.set($any($event.target).value)"
      />
      <datalist id="quick-search-history">
        @for (suggestion of searchProfiles.suggestions(); track suggestion) {
          <option [value]="suggestion"></option>
        }
      </datalist>
      <button class="btn" type="submit" [disabled]="busy() || !term().trim()">
        {{ busy() ? '…' : 'Search' }}
      </button>
    </form>
  `,
  styles: `
    .quick {
      display: flex;
      gap: 0.4rem;
      align-items: center;
    }
    input {
      font: inherit;
      font-size: 0.88rem;
      padding: 0.35rem 0.6rem;
      min-width: 12rem;
      color: var(--text);
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
    }
    .btn {
      padding: 0.35rem 0.8rem;
      font-size: 0.88rem;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    @media (max-width: 720px) {
      input {
        min-width: 8rem;
      }
    }
  `,
})
export class QuickSearch {
  protected readonly searchProfiles = inject(SearchProfileService);
  private readonly jobService = inject(JobService);
  private readonly router = inject(Router);

  protected readonly term = signal('');
  protected readonly busy = signal(false);

  protected async go(event: Event): Promise<void> {
    event.preventDefault();
    const query = this.term().trim();
    if (!query || this.busy()) return;

    this.busy.set(true);
    try {
      const { profile, created } = await this.searchProfiles.findOrCreateByTitle(query);
      this.searchProfiles.rememberTerm(query);
      this.searchProfiles.setActive(profile.id);
      await this.router.navigate(['/jobs']);

      // A brand-new search has nothing stored yet, so fetch once. Switching to a
      // search you already have just shows what's there — no quota spent.
      if (created) await this.jobService.refresh(profile.id);
      await this.jobService.reload('new', profile.id);
      this.term.set('');
    } catch {
      // The jobs page surfaces failures; keep what was typed so it can be retried.
    } finally {
      this.busy.set(false);
    }
  }
}
