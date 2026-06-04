/**
 * Expo Push Notifications helper for Edge Functions.
 * Sends via https://exp.host/--/api/v2/push/send
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
};

export type PushTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

/** Send one or many push messages. Returns array of tickets. */
export async function sendExpoPush(messages: PushMessage | PushMessage[]): Promise<PushTicket[]> {
  const batch = Array.isArray(messages) ? messages : [messages];
  if (batch.length === 0) return [];

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(batch),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Expo Push API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  return (json.data ?? []) as PushTicket[];
}

/** Fetch all push tokens for a user from the push_tokens table. */
export async function fetchUserTokens(
  supabase: ReturnType<typeof import('../_shared/supabaseAdmin.ts').getServiceClient>,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('push_tokens')
    .select('expo_push_token')
    .eq('user_id', userId);

  if (error || !data?.length) return [];
  return data.map((r: { expo_push_token: string }) => r.expo_push_token).filter(Boolean);
}

/** Send a push to a user by their userId. Silently skips if no tokens. */
export async function pushToUser(
  supabase: ReturnType<typeof import('../_shared/supabaseAdmin.ts').getServiceClient>,
  userId: string,
  { title, body, data }: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  const tokens = await fetchUserTokens(supabase, userId);
  if (!tokens.length) return;

  const messages: PushMessage[] = tokens.map((to) => ({
    to,
    title,
    body,
    data: data ?? {},
    sound: 'default',
  }));

  try {
    const tickets = await sendExpoPush(messages);
    const failures = tickets.filter((t) => t.status === 'error');
    if (failures.length) {
      console.warn('[push] some tokens failed:', failures.map((f) => f.details?.error));
    }
  } catch (e) {
    console.warn('[push] sendExpoPush threw:', e instanceof Error ? e.message : e);
  }
}
