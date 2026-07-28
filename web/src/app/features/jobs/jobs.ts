import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { SupabaseService } from '../../core/supabase.service';

@Component({
  selector: 'app-jobs',
  template: `
    <header class="bar">
      <strong>JobPilot</strong>
      <button class="btn btn--ghost" type="button" (click)="signOut()">Sign out</button>
    </header>

    <main class="wrap">
      <div class="card empty">
        <h2>No jobs yet</h2>
        <p class="muted">
          Signed in as {{ email() }}. The jobs feed arrives once search profiles and the
          fetch-jobs function are wired up.
        </p>
      </div>
    </main>
  `,
  styles: `
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }
    .wrap {
      max-width: 900px;
      margin: 0 auto;
      padding: 1.5rem;
    }
    .empty {
      padding: 2.5rem;
      text-align: center;
    }
  `,
})
export class Jobs {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  protected readonly email = () => this.supabase.session()?.user.email ?? 'unknown';

  protected async signOut(): Promise<void> {
    await this.supabase.signOut();
    await this.router.navigate(['/login']);
  }
}
