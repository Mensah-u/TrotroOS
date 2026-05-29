/**
 * Read-only wallet client. Balance and ledger come from the server (which
 * computes them from the append-only `wallet_ledger` table).
 *
 * Falls back to a zero balance and an empty ledger when the API is offline,
 * so screens still render something sensible.
 */

import { apiAvailable, apiFetch } from '@/services/apiClient';

export async function fetchWalletBalance(userId) {
  if (!apiAvailable() || !userId) {
    return { balanceGhs: 0, lastTxnAt: null, authoritative: false };
  }
  const { ok, data } = await apiFetch(`/wallet/${encodeURIComponent(userId)}`);
  if (!ok || !data) return { balanceGhs: 0, lastTxnAt: null, authoritative: false };
  return { ...data, authoritative: true };
}

export async function fetchWalletLedger(userId, limit = 50) {
  if (!apiAvailable() || !userId) return { entries: [], authoritative: false };
  const { ok, data } = await apiFetch(`/wallet/${encodeURIComponent(userId)}/ledger?limit=${limit}`);
  if (!ok || !data) return { entries: [], authoritative: false };
  return { entries: data, authoritative: true };
}
