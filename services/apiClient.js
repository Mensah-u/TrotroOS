/**
 * Thin fetch wrapper for the TrotroOS backend API.
 *
 * If `API_BASE_URL` is empty the client treats the backend as unavailable
 * and every caller is expected to fall back to its bundled defaults
 * (e.g. fares from `constants/routes.js`).
 */

import { API_BASE_URL, API_KEY } from '@/constants/config';

const DEFAULT_TIMEOUT_MS = 12_000;

export function apiAvailable() {
  return Boolean(API_BASE_URL);
}

async function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function apiFetch(path, { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!apiAvailable()) {
    return { ok: false, status: 0, data: null, error: { message: 'api not configured' } };
  }
  const url = `${API_BASE_URL.replace(/\/$/, '')}${path}`;
  try {
    const res = await withTimeout(
      fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
        body: body == null ? undefined : JSON.stringify(body),
      }),
      timeoutMs,
    );
    let data = null;
    try {
      data = await res.json();
    } catch {
      // non-JSON response (e.g. 204) — leave data null
    }
    if (!res.ok) {
      return { ok: false, status: res.status, data, error: { message: data?.error ?? res.statusText } };
    }
    return { ok: true, status: res.status, data, error: null };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: { message: e?.message ?? 'network error' } };
  }
}
