/**
 * Both values are public by design: the publishable key only ever reaches the
 * browser, and row-level security is what actually protects the data.
 */
export const environment = {
  supabaseUrl: 'https://gisjqgvdgxxqkpswuqzz.supabase.co',
  supabasePublishableKey: 'sb_publishable_q_WhuW8tudVw1Sqqm1xdqg_qq9rDjiI',
} as const;
