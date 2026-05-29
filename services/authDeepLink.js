import * as Linking from 'expo-linking';

import { supabase } from '@/services/supabase';

/** Redirect target for Supabase email confirmation (add to Supabase Auth → URL config). */
export function getMateAuthRedirectUrl() {
  return Linking.createURL('auth/callback');
}

function parseAuthParams(url) {
  const params = {};
  if (!url) return params;

  const hash = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? url.split('?')[1]?.split('#')[0] : '';
  const raw = `${query}&${hash}`.replace(/^&/, '');

  for (const part of raw.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const key = decodeURIComponent(eq >= 0 ? part.slice(0, eq) : part);
    const val = decodeURIComponent(eq >= 0 ? part.slice(eq + 1) : '');
    if (key) params[key] = val;
  }
  return params;
}

/** Turn an email-confirm / magic-link URL into a persisted Supabase session. */
export async function createSessionFromAuthUrl(url) {
  const params = parseAuthParams(url);
  const access_token = params.access_token;
  const refresh_token = params.refresh_token;

  if (!access_token) {
    return { ok: false, reason: 'no_tokens' };
  }

  const { error } = await supabase.auth.setSession({
    access_token,
    refresh_token: refresh_token ?? '',
  });

  if (error) {
    return { ok: false, error };
  }
  return { ok: true };
}

/** Listen for auth callback URLs (email confirm opens the app). */
export function subscribeToAuthUrls(onSignedIn) {
  const handle = async (url) => {
    if (!url || !url.includes('access_token')) return;
    const result = await createSessionFromAuthUrl(url);
    if (result.ok) onSignedIn?.();
  };

  Linking.getInitialURL().then((url) => {
    if (url) handle(url);
  });

  const sub = Linking.addEventListener('url', ({ url }) => handle(url));
  return () => sub.remove();
}

export function isEmailNotConfirmedError(error) {
  const msg = (error?.message ?? '').toLowerCase();
  return msg.includes('email not confirmed') || msg.includes('not confirmed');
}
