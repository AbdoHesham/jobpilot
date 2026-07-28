import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SearchProfileService } from '../../core/search-profile.service';
import { SupabaseService } from '../../core/supabase.service';
import { QuickSearch } from './quick-search';

@Component({
  selector: 'app-shell',
  imports: [QuickSearch, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <a class="skip" href="#main">Skip to content</a>

    <header class="bar">
      <a class="brand" routerLink="/jobs" aria-label="JobPilot home">
        <span class="brand-mark" aria-hidden="true"></span>JobPilot
      </a>
      <nav aria-label="Main">
        <a routerLink="/jobs" routerLinkActive="active">Jobs</a>
        <a routerLink="/searches" routerLinkActive="active">Searches</a>
        <a routerLink="/cvs" routerLinkActive="active">CVs</a>
      </nav>
      <app-quick-search />

      <div class="right">
        @if (searchProfiles.profiles().length) {
          <label class="sr-only" for="active-search">Active search</label>
          <select
            id="active-search"
            class="switcher"
            [value]="searchProfiles.activeId() ?? ''"
            (change)="onSearchChange($event)"
          >
            @for (profile of searchProfiles.profiles(); track profile.id) {
              <option [value]="profile.id">
                {{ profile.title }}@if (!profile.active) { (paused) }
              </option>
            }
          </select>
        } @else {
          <a class="btn btn--ghost" routerLink="/searches">Create a search</a>
        }
        <span class="muted email">{{ email() }}</span>
        <button class="btn btn--ghost" type="button" (click)="signOut()">Sign out</button>
      </div>
    </header>

    <main id="main" class="wrap">
      <router-outlet />
    </main>
  `,
  styles: `
    .skip {
      position: absolute;
      left: -9999px;
    }
    .skip:focus {
      left: 1rem;
      top: 1rem;
      z-index: 10;
      background: var(--card);
      padding: 0.5rem 0.75rem;
      border-radius: var(--radius);
      border: 1px solid var(--rule);
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding: 0.7rem 1.25rem;
      border-bottom: 1px solid var(--rule);
      background: var(--card);
      flex-wrap: wrap;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--ink);
      text-decoration: none;
      flex-shrink: 0;
    }
    /* Amber pip — the one piece of instrument lighting in the chrome. */
    .brand-mark {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--signal);
      box-shadow: 0 0 0 3px var(--signal-wash);
    }
    nav {
      display: flex;
      gap: 0.1rem;
    }
    app-quick-search {
      flex: 1;
      min-width: 10rem;
      display: block;
    }
    nav a {
      padding: 0.3rem 0.65rem;
      text-decoration: none;
      color: var(--muted);
      font-size: 0.9rem;
      border-bottom: 2px solid transparent;
    }
    nav a:hover {
      color: var(--ink);
    }
    nav a.active {
      color: var(--ink);
      border-bottom-color: var(--signal);
      font-weight: 500;
    }
    .right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .email {
      font-size: 0.82rem;
    }
    .switcher {
      font: inherit;
      font-size: 0.88rem;
      padding: 0.35rem 0.5rem;
      max-width: 15rem;
      color: var(--ink);
      background: var(--paper);
      border: 1px solid var(--rule);
      border-radius: var(--radius);
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    .wrap {
      max-width: 820px;
      margin: 0 auto;
      padding: 1.75rem 1.25rem 4rem;
    }
    @media (max-width: 560px) {
      .email {
        display: none;
      }
    }
  `,
})
export class Shell {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  protected readonly searchProfiles = inject(SearchProfileService);

  protected readonly email = () => this.supabase.session()?.user.email ?? '';

  constructor() {
    // Loaded once here so the switcher is populated on every page.
    void this.searchProfiles.reload().catch(() => undefined);
  }

  protected onSearchChange(event: Event): void {
    this.searchProfiles.setActive((event.target as HTMLSelectElement).value || null);
  }

  protected async signOut(): Promise<void> {
    await this.supabase.signOut();
    await this.router.navigate(['/login']);
  }
}
