import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

// supabase-js sends apikey and x-client-info alongside authorization; any header
// missing from this list fails the preflight and the browser blocks the call
// before it is sent — which surfaces as a network error, not an HTTP status.
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

/** Thrown for anything the caller did wrong; becomes a structured error response. */
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/**
 * Wraps a handler with CORS preflight, JWT auth, and a structured error envelope.
 * The client is bound to the caller's JWT, so RLS does the ownership checks for us.
 */
export function serve(
  handler: (req: Request, db: SupabaseClient, userId: string | null) => Promise<Response>,
  { allowServiceRole = false } = {},
) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    try {
      const auth = req.headers.get('Authorization');
      if (!auth) throw new HttpError(401, 'missing Authorization header');

      // Scheduled invocations present the service role key rather than a user
      // JWT. That client bypasses RLS, so only opt in where it is intended.
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (allowServiceRole && serviceRoleKey && auth === `Bearer ${serviceRoleKey}`) {
        const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);
        return await handler(req, admin, null);
      }

      const db = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: auth } } },
      );
      const { data, error } = await db.auth.getUser();
      if (error || !data.user) throw new HttpError(401, 'invalid token');

      return await handler(req, db, data.user.id);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      return json({ error: { message: String((e as Error).message ?? e) } }, status);
    }
  };
}

export function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing secret: ${name}`);
  return v;
}
