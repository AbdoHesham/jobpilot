import { computed, Service, signal } from '@angular/core';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

import { environment } from './environment';

/**
 * Owns the Supabase client and mirrors the auth session into a signal so the
 * router guard and templates can react to sign-in/sign-out without observables.
 */
@Service()
export class SupabaseService {
  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
  );

  private readonly currentSession = signal<Session | null>(null);

  readonly session = this.currentSession.asReadonly();
  readonly isSignedIn = computed(() => this.currentSession() !== null);
  readonly userId = computed(() => this.currentSession()?.user.id ?? null);

  /** True until the initial getSession() settles, so guards don't bounce on reload. */
  private readonly restored = signal(false);
  readonly sessionRestored = this.restored.asReadonly();

  constructor() {
    // Restores a persisted session on page load; onAuthStateChange covers everything after.
    void this.client.auth.getSession().then(({ data }) => {
      this.currentSession.set(data.session);
      this.restored.set(true);
    });

    this.client.auth.onAuthStateChange((_event, session) => {
      this.currentSession.set(session);
      this.restored.set(true);
    });
  }

  signIn(email: string, password: string) {
    return this.client.auth.signInWithPassword({ email, password });
  }

  signUp(email: string, password: string, fullName: string) {
    return this.client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
  }

  /** LinkedIn is used only to import name, headline, photo and email. */
  signInWithLinkedIn() {
    return this.client.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: { redirectTo: window.location.origin },
    });
  }

  signOut() {
    return this.client.auth.signOut();
  }
}
