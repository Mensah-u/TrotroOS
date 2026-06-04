/**
 * send-push — deliver a push notification to any user.
 *
 * Callers must be authenticated:
 *   • Service-role callers (admin / cron / other edge functions): pass the
 *     service-role key as the Bearer token — unrestricted.
 *   • Regular authenticated users (e.g. mates sending invite notifications):
 *     pass their JWT — allowed.
 *   • Anon / missing token: rejected 401.
 *
 * POST body: { recipientId, title, body, data? }
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { pushToUser } from '../_shared/expoPush.ts';
import {
  corsHeaders,
  errorResponse,
  getBearerToken,
  getServiceClient,
  getUserClient,
  isServiceRoleKey,
  jsonResponse,
} from '../_shared/supabaseAdmin.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  // ── Authorization ──────────────────────────────────────────────────────────
  const jwt = getBearerToken(req);
  if (!jwt) return errorResponse('Authorization header required', 401);

  if (!isServiceRoleKey(jwt)) {
    // Verify the token is a real authenticated user (not anon key)
    const userClient = getUserClient(jwt);
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return errorResponse('Authenticated user required', 401);
    }
  }
  // ── End Authorization ───────────────────────────────────────────────────────

  let body: { recipientId?: string; title?: string; body?: string; data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  const { recipientId, title, body: pushBody, data } = body;

  if (!recipientId?.trim()) return errorResponse('recipientId is required');
  if (!title?.trim())       return errorResponse('title is required');
  if (!pushBody?.trim())    return errorResponse('body is required');

  const supabase = getServiceClient();

  try {
    await pushToUser(supabase, recipientId, { title, body: pushBody, data });
    return jsonResponse({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[send-push]', msg);
    return errorResponse(msg, 500);
  }
});
