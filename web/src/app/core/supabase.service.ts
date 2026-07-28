import { computed, Service, signal } from '@angular/core';
import { createClient, FunctionsHttpError, type Session, type SupabaseClient } from '@supabase/supabase-js';

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

  /**
   * Invokes an Edge Function and surfaces the server's own error text.
   *
   * supabase-js reports a non-2xx as an opaque FunctionsHttpError with the body
   * left unread, so without this every failure looks identical to the caller —
   * a missing key, a bad provider response and a deployment problem would all
   * produce the same useless message.
   */
  async invokeFunction<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await this.client.functions.invoke<T>(name, { body });
    if (!error) return data as T;

    if (error instanceof FunctionsHttpError) {
      try {
        const payload = await error.context.json();
        const message = payload?.error?.message ?? payload?.message;
        if (message) throw new Error(message);
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message) throw parseError;
      }
      throw new Error(`${name} failed (HTTP ${error.context.status}).`);
    }

    // Network failure or a timeout — the function was never reached.
    throw new Error(`Could not reach ${name}. Is it deployed?`);
  }
}
