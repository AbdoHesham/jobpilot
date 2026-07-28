import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { SupabaseService } from './supabase.service';

/**
 * Awaits getSession() rather than reading the session signal: on a hard reload
 * the signal is still null while the persisted session is being restored, and a
 * signal read would bounce the user to /login.
 */
export const authGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  const { data } = await supabase.client.auth.getSession();
  return data.session ? true : router.createUrlTree(['/login']);
};

/** Keeps signed-in users off the login and signup pages. */
export const guestGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  const { data } = await supabase.client.auth.getSession();
  return data.session ? router.createUrlTree(['/jobs']) : true;
};
