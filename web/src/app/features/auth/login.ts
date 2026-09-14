import { Component, inject, signal } from '@angular/core';
import {
  email,
  form,
  FormField,
  FormRoot,
  minLength,
  required,
  submit,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';

import { SupabaseService } from '../../core/supabase.service';

interface Credentials {
  email: string;
  password: string;
}

@Component({
  selector: 'app-login',
  imports: [FormField, FormRoot, MatButtonModule, MatInputModule, RouterLink],
  template: `
    <main class="wrap">
      <div class="card panel">
        <h1>JobPilot</h1>
        <p class="muted">Sign in to your job search.</p>

        @if (errorMessage(); as message) {
          <p class="banner" role="alert">{{ message }}</p>
        }

        <form [formRoot]="fields" (submit)="onSubmit($event)">
          <div class="field">
            <label for="email">Email</label>
            <input
              matInput
              id="email"
              type="email"
              autocomplete="email"
              [formField]="fields.email"
              [attr.aria-invalid]="showError('email')"
              aria-describedby="email-error"
            />
            @if (showError('email')) {
              <p class="error" id="email-error">Enter a valid email address.</p>
            }
          </div>

          <div class="field">
            <label for="password">Password</label>
            <input
              matInput
              id="password"
              type="password"
              autocomplete="current-password"
              [formField]="fields.password"
              [attr.aria-invalid]="showError('password')"
              aria-describedby="password-error"
            />
            @if (showError('password')) {
              <p class="error" id="password-error">At least 8 characters.</p>
            }
          </div>

          <button matButton="filled" class="btn btn--block" type="submit" [disabled]="busy()">
            {{ busy() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <button
          matButton="outlined"
          class="btn btn--ghost btn--block linkedin"
          type="button"
          [disabled]="busy()"
          (click)="signInWithLinkedIn()"
        >
          Continue with LinkedIn
        </button>
        <p class="muted note">LinkedIn is used only to import your name, headline and photo.</p>

        <p class="switch">No account? <a routerLink="/signup">Create one</a></p>
      </div>
    </main>
  `,
  styles: `
    .wrap {
      display: grid;
      place-items: center;
      min-height: 100dvh;
      padding: 1.5rem;
    }
    .panel {
      width: 100%;
      max-width: 380px;
      padding: 1.75rem;
    }
    .linkedin {
      margin-top: 0.75rem;
    }
    .note {
      font-size: 0.78rem;
      margin: 0.5rem 0 0;
    }
    .switch {
      margin: 1.25rem 0 0;
      font-size: 0.9rem;
    }
  `,
})
export class Login {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  protected readonly model = signal<Credentials>({ email: '', password: '' });

  protected readonly fields = form(this.model, (path) => {
    required(path.email);
    email(path.email);
    required(path.password);
    minLength(path.password, 8);
  });

  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Only nag once the user has actually visited the field. */
  protected showError(field: keyof Credentials): boolean {
    const state = this.fields[field]();
    return state.touched() && !state.valid();
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);
    this.busy.set(true);

    await submit(this.fields, {
      action: async () => {
        const { error } = await this.supabase.signIn(this.model().email, this.model().password);
        if (error) {
          this.errorMessage.set(error.message);
          return;
        }
        await this.router.navigate(['/jobs']);
      },
    });

    this.busy.set(false);
  }

  protected async signInWithLinkedIn(): Promise<void> {
    this.errorMessage.set(null);
    const { error } = await this.supabase.signInWithLinkedIn();
    if (error) {
      this.errorMessage.set(error.message);
    }
  }
}
