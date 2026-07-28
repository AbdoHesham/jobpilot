import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SupabaseService } from '../../core/supabase.service';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <a class="skip" href="#main">Skip to content</a>

    <header class="bar">
      <strong class="brand">JobPilot</strong>
      <nav aria-label="Main">
        <a routerLink="/jobs" routerLinkActive="active">Jobs</a>
        <a routerLink="/searches" routerLinkActive="active">Searches</a>
        <a routerLink="/cvs" routerLinkActive="active">CVs</a>
      </nav>
      <div class="right">
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
      background: var(--surface);
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding: 0.7rem 1.25rem;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      flex-wrap: wrap;
    }
    .brand {
      font-size: 1.05rem;
    }
    nav {
      display: flex;
      gap: 0.35rem;
      flex: 1;
    }
    nav a {
      padding: 0.35rem 0.7rem;
      border-radius: 8px;
      text-decoration: none;
      color: var(--muted);
      font-size: 0.92rem;
    }
    nav a.active {
      color: var(--text);
      background: var(--bg);
    }
    .right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .email {
      font-size: 0.82rem;
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

  protected readonly email = () => this.supabase.session()?.user.email ?? '';

  protected async signOut(): Promise<void> {
    await this.supabase.signOut();
    await this.router.navigate(['/login']);
  }
}
