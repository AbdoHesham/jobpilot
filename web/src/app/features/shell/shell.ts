import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SearchProfileService } from '../../core/search-profile.service';
import { SupabaseService } from '../../core/supabase.service';
import { QuickSearch } from './quick-search';
import { ReportIssue } from './report-issue';

@Component({
  selector: 'app-shell',
  imports: [
    MatButtonModule,
    MatSelectModule,
    QuickSearch,
    ReportIssue,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
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
          <mat-select
            id="active-search"
            class="switcher"
            aria-label="Active search"
            [value]="searchProfiles.activeId() ?? ''"
            (selectionChange)="onSearchChange($event.value)"
          >
            @for (profile of searchProfiles.profiles(); track profile.id) {
              <mat-option [value]="profile.id">
                {{ profile.title }}
                @if (!profile.active) {
                  (paused)
                }
              </mat-option>
            }
          </mat-select>
        } @else {
          <a matButton="outlined" class="btn btn--ghost" routerLink="/searches">Create a search</a>
        }
        <span class="muted email">{{ email() }}</span>
        <button
          matButton="outlined"
          class="btn btn--ghost theme-toggle"
          type="button"
          [attr.aria-label]="darkTheme() ? 'Use light theme' : 'Use dark theme'"
          [attr.title]="darkTheme() ? 'Use light theme' : 'Use dark theme'"
          (click)="toggleTheme()"
        >
          <span class="theme-icon" aria-hidden="true">{{ darkTheme() ? '☀' : '☾' }}</span>
        </button>
        <button matButton="outlined" class="btn btn--ghost" type="button" (click)="signOut()">
          Sign out
        </button>
      </div>
    </header>

    <main id="main" class="wrap">
      <router-outlet />
    </main>
    <app-report-issue />
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
      padding: 0.8rem clamp(1rem, 3vw, 2rem);
      border-bottom: 1px solid var(--rule);
      background: color-mix(in srgb, var(--card) 92%, transparent);
      backdrop-filter: blur(16px);
      position: sticky;
      top: 0;
      z-index: 5;
      flex-wrap: wrap;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 1.08rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--ink);
      text-decoration: none;
      flex-shrink: 0;
    }
    /* Cobalt pip — the one piece of instrument lighting in the chrome. */
    .brand-mark {
      width: 11px;
      height: 18px;
      border-radius: 3px 8px 3px 8px;
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
      padding: 0.45rem 0.7rem;
      text-decoration: none;
      color: var(--muted);
      font-size: 0.9rem;
      border-radius: 8px;
    }
    nav a:hover {
      color: var(--ink);
    }
    nav a.active {
      color: var(--signal);
      background: var(--signal-wash);
      font-weight: 600;
    }
    .right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }
    .email {
      font-size: 0.82rem;
      max-width: 13rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .switcher {
      flex: 1 1 12rem;
      width: min(15rem, 32vw);
      min-width: 0;
      min-height: 44px;
      font: inherit;
      font-size: 0.88rem;
      padding: 0.55rem 0.75rem;
      max-width: 15rem;
      color: var(--ink);
      background: var(--paper);
      border: 1px solid var(--rule);
      border-radius: var(--radius);
    }
    .theme-toggle {
      min-width: 5rem;
      padding-inline: 0.75rem;
    }
    .theme-icon {
      font-size: 1.05rem;
      line-height: 1;
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
      width: 100%;
      min-width: 0;
      max-width: 1040px;
      margin: 0 auto;
      padding: clamp(1.5rem, 4vw, 3rem) clamp(1rem, 3vw, 2rem) 5rem;
    }
    @media (max-width: 820px) {
      .bar {
        gap: 0.75rem;
      }
      app-quick-search {
        order: 4;
        flex-basis: 100%;
      }
      .right {
        margin-left: auto;
        max-width: 100%;
      }
    }
    @media (max-width: 720px) {
      .right {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        order: 3;
        width: 100%;
        margin-left: 0;
      }
      .switcher {
        width: auto;
        max-width: none;
      }
      .email {
        display: none;
      }
      .theme-toggle {
        min-width: 44px;
        width: 44px;
        padding: 0;
      }
      .theme-label {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
    }
  `,
})
export class Shell {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  protected readonly searchProfiles = inject(SearchProfileService);

  protected readonly email = () => this.supabase.session()?.user.email ?? '';
  protected readonly darkTheme = signal(document.documentElement.dataset['theme'] === 'dark');

  constructor() {
    // Loaded once here so the switcher is populated on every page.
    void this.searchProfiles.reload().catch(() => undefined);
  }

  protected onSearchChange(id: string | null): void {
    this.searchProfiles.setActive(id || null);
  }

  protected toggleTheme(): void {
    const theme = this.darkTheme() ? 'light' : 'dark';
    document.documentElement.dataset['theme'] = theme;
    localStorage.setItem('jobpilot-theme', theme);
    this.darkTheme.set(theme === 'dark');
  }

  protected async signOut(): Promise<void> {
    await this.supabase.signOut();
    await this.router.navigate(['/login']);
  }
}
