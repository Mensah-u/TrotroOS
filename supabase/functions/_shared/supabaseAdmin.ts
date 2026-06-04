import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

/** Extract Bearer token from Authorization header. */
export function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

/** True when jwt is literally the service-role key (admin / cron callers). */
export function isServiceRoleKey(jwt: string): boolean {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return !!key && jwt === key;
}

/**
 * Create a Supabase client scoped to a user JWT.
 * Use this to verify identity or call RLS-protected tables as the user.
 */
export function getUserClient(jwt: string): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY is not configured');
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getPaystackSecretKey(): string {
  const key = Deno.env.get('PAYSTACK_SECRET_KEY')?.trim();
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not configured');
  return key;
}

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400): Response {
  console.error('[payment]', message);
  return jsonResponse({ ok: false, error: message }, status);
}
