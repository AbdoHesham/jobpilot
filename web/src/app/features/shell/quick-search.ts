import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';

import { SearchProfileService } from '../../core/search-profile.service';

/**
 * Search any job title from anywhere in the app. A native <datalist> supplies
 * the history dropdown — it opens on click, filters as you type and is keyboard
 * accessible without a line of popup code.
 */
@Component({
  selector: 'app-quick-search',
  imports: [MatButtonModule, MatInputModule],
  template: `
    <form class="quick" role="search" (submit)="go($event)">
      <label class="sr-only" for="quick-search">Search job titles</label>
      <input
        matInput
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
      <button matButton="filled" class="btn" type="submit" [disabled]="busy() || !term().trim()">
        {{ busy() ? '…' : 'Search' }}
      </button>
    </form>
    @if (error(); as message) {
      <p class="quick-error" role="alert">{{ message }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
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
      color: var(--ink);
      background: var(--paper);
      border: 1px solid var(--rule);
      border-radius: var(--radius);
    }
    .btn {
      padding: 0.35rem 0.8rem;
      font-size: 0.88rem;
    }
    .quick-error {
      margin: 0.25rem 0 0;
      color: var(--danger);
      font-size: 0.76rem;
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
  private readonly router = inject(Router);

  protected readonly term = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async go(event: Event): Promise<void> {
    event.preventDefault();
    const query = this.term().trim();
    if (!query || this.busy()) return;

    this.busy.set(true);
    this.error.set(null);
    try {
      const { profile } = await this.searchProfiles.findOrCreateByTitle(query);
      this.searchProfiles.rememberTerm(query);
      this.searchProfiles.setActive(profile.id);
      await this.router.navigate(['/jobs'], {
        queryParams: { status: 'new', search: crypto.randomUUID() },
      });
      this.term.set('');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.busy.set(false);
    }
  }
}
