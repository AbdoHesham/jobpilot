import { Component, inject, signal } from '@angular/core';
import { email, form, FormField, FormRoot, minLength, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';

import { SupabaseService } from '../../core/supabase.service';

interface Registration {
  fullName: string;
  email: string;
  password: string;
}

@Component({
  selector: 'app-signup',
  imports: [FormField, FormRoot, RouterLink],
  template: `
    <main class="wrap">
      <div class="card panel">
        <h1>Create account</h1>

        @if (errorMessage(); as message) {
          <p class="banner" role="alert">{{ message }}</p>
        }

        @if (needsConfirmation()) {
          <p class="banner confirm" role="status">
            Check your inbox to confirm your email address, then sign in.
          </p>
        }

        <form [formRoot]="fields" (submit)="onSubmit($event)">
          <div class="field">
            <label for="fullName">Full name</label>
            <input
              id="fullName"
              type="text"
              autocomplete="name"
              [formField]="fields.fullName"
              [attr.aria-invalid]="showError('fullName')"
              aria-describedby="fullName-error"
            />
            @if (showError('fullName')) {
              <p class="error" id="fullName-error">Please enter your name.</p>
            }
          </div>

          <div class="field">
            <label for="email">Email</label>
            <input
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
              id="password"
              type="password"
              autocomplete="new-password"
              [formField]="fields.password"
              [attr.aria-invalid]="showError('password')"
              aria-describedby="password-error"
            />
            @if (showError('password')) {
              <p class="error" id="password-error">At least 8 characters.</p>
            }
          </div>

          <button class="btn btn--block" type="submit" [disabled]="busy()">
            {{ busy() ? 'Creating…' : 'Create account' }}
          </button>
        </form>

        <p class="switch">Already registered? <a routerLink="/login">Sign in</a></p>
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
    .confirm {
      border-color: var(--ok);
      color: var(--ok);
    }
    .switch {
      margin: 1.25rem 0 0;
      font-size: 0.9rem;
    }
  `,
})
export class Signup {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  protected readonly model = signal<Registration>({ fullName: '', email: '', password: '' });

  protected readonly fields = form(this.model, (path) => {
    required(path.fullName);
    minLength(path.fullName, 2);
    required(path.email);
    email(path.email);
    required(path.password);
    minLength(path.password, 8);
  });

  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly needsConfirmation = signal(false);

  protected showError(field: keyof Registration): boolean {
    const state = this.fields[field]();
    return state.touched() && !state.valid();
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);
    this.needsConfirmation.set(false);
    this.busy.set(true);

    await submit(this.fields, {
      action: async () => {
        const { fullName, email: address, password } = this.model();
        const { data, error } = await this.supabase.signUp(address, password, fullName);
        if (error) {
          this.errorMessage.set(error.message);
          return;
        }
        // With email confirmation on, signUp returns a user but no session.
        if (data.session) {
          await this.router.navigate(['/jobs']);
        } else {
          this.needsConfirmation.set(true);
        }
      },
    });

    this.busy.set(false);
  }
}
