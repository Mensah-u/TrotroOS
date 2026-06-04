/**
 * send-push — internal Edge Function to deliver a push notification to any user.
 * Called server-to-server; requires service role key in Authorization header
 * (or from other Edge Functions via supabase.functions.invoke with service context).
 *
 * POST body: { recipientId, title, body, data? }
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { pushToUser } from '../_shared/expoPush.ts';
import {
  corsHeaders,
  errorResponse,
  getServiceClient,
  jsonResponse,
} from '../_shared/supabaseAdmin.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

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
