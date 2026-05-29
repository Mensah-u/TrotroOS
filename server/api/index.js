/**
 * TrotroOS API service.
 *
 * Authoritative server for anything the client must not be allowed to forge:
 *   • Fare quotes (per route, in GHS, computed from the server's own table).
 *   • Paystack payment initialisation (signed by the secret key, never the client).
 *   • Paystack webhook → idempotent payment + wallet ledger updates.
 *   • Wallet balance and ledger reads.
 *
 * Required environment variables (see `.env.example`):
 *   PORT                        default 8788
 *   SUPABASE_URL                project URL (https://xyz.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY   service role key (server only, never ship to client)
 *   PAYSTACK_SECRET_KEY         sk_live_... or sk_test_...
 *   PAYSTACK_PUBLIC_KEY         pk_live_... or pk_test_... (echoed to client for SDK init)
 *   PAYSTACK_WEBHOOK_SECRET     same as PAYSTACK_SECRET_KEY (Paystack signs with the secret)
 *   APP_API_KEY                 shared secret the mobile client sends as `x-api-key`
 *
 * All read endpoints require `x-api-key`. The webhook does NOT require it —
 * it is verified by HMAC signature from Paystack.
 */

const express = require('express');
const morgan = require('morgan');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const fareTable = require('./data/fares');

const PORT = Number(process.env.PORT || 8788);
const APP_API_KEY = process.env.APP_API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[api] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — DB-backed routes will degrade.');
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const app = express();

// Capture the raw body for HMAC verification on the webhook route. We have to
// do this BEFORE `express.json()` runs, otherwise the buffer is lost.
app.use(
  express.json({
    limit: '64kb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(morgan('tiny'));

function requireApiKey(req, res, next) {
  if (!APP_API_KEY) return next(); // dev mode
  if (req.headers['x-api-key'] !== APP_API_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  return next();
}

app.get('/health', (_req, res) =>
  res.json({
    ok: true,
    supabase: Boolean(supabase),
    paystack: Boolean(PAYSTACK_SECRET_KEY),
    fareRoutes: fareTable.routes.length,
  }),
);

// ── Public config ──────────────────────────────────────────────────────────
// Client fetches `paystackPublicKey` once so we never bake it into the bundle.
app.get('/config', requireApiKey, (_req, res) => {
  res.json({
    paystackPublicKey: PAYSTACK_PUBLIC_KEY,
    currency: 'GHS',
  });
});

// ── Fares ───────────────────────────────────────────────────────────────────
function normalisePlace(s) {
  return String(s || '').trim().toLowerCase();
}

function quoteFare({ origin, destination, routeId }) {
  if (routeId) {
    const route = fareTable.routes.find((r) => r.id === routeId);
    if (route) {
      return { fareGhs: route.fareGhs, source: 'route-id', routeId: route.id };
    }
  }
  if (origin && destination) {
    const o = normalisePlace(origin);
    const d = normalisePlace(destination);
    const route = fareTable.routes.find(
      (r) =>
        (normalisePlace(r.origin) === o && normalisePlace(r.destination) === d) ||
        (normalisePlace(r.origin) === d && normalisePlace(r.destination) === o),
    );
    if (route) return { fareGhs: route.fareGhs, source: 'route-pair', routeId: route.id };
  }
  // Fallback: flat city fare. Keeps custom routes from breaking the client.
  return { fareGhs: fareTable.defaultFareGhs, source: 'default', routeId: null };
}

app.post('/fares/quote', requireApiKey, (req, res) => {
  const { origin, destination, routeId } = req.body ?? {};
  const quote = quoteFare({ origin, destination, routeId });
  res.json({ ...quote, currency: 'GHS', quotedAt: new Date().toISOString() });
});

// ── Payments: init Paystack transaction ────────────────────────────────────
async function dbInsertPayment({ reference, reservationId, passengerId, amountGhs, channel }) {
  if (!supabase) return { error: { message: 'db not configured' } };
  const { error } = await supabase.from('payments').insert({
    reference,
    reservation_id: reservationId ?? null,
    passenger_id: passengerId ?? null,
    amount_ghs: amountGhs,
    channel,
    provider: 'paystack',
    status: 'pending',
  });
  return { error };
}

app.post('/payments/init', requireApiKey, async (req, res) => {
  const { reservationId, passengerId, amountGhs, channel, email } = req.body ?? {};

  if (!amountGhs || amountGhs <= 0) {
    return res.status(400).json({ error: 'amountGhs must be > 0' });
  }
  if (!PAYSTACK_SECRET_KEY) {
    return res.status(503).json({ error: 'paystack not configured' });
  }

  // We always re-verify the amount against the server's own fare table when a
  // reservationId+route is supplied. This is the bit you cannot move client-side.
  let serverAmountGhs = amountGhs;
  let serverFareNote = 'client-supplied';
  if (reservationId && supabase) {
    try {
      const { data: r } = await supabase
        .from('reservations')
        .select('id, trips(route, origin, destination)')
        .eq('id', reservationId)
        .maybeSingle();
      const route = r?.trips?.route;
      if (route) {
        const [origin, destination] = route.split(' - ').map((s) => s?.trim());
        const quote = quoteFare({ origin, destination });
        serverAmountGhs = quote.fareGhs;
        serverFareNote = `server-route(${origin}→${destination})`;
      }
    } catch (e) {
      console.warn('[api] could not verify fare:', e.message);
    }
  }

  const reference = `trotro_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const insertResult = await dbInsertPayment({
    reference,
    reservationId,
    passengerId,
    amountGhs: serverAmountGhs,
    channel,
  });
  if (insertResult.error) {
    console.warn('[api] could not record pending payment:', insertResult.error.message);
  }

  try {
    const resp = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email || 'guest@trotro.os',
        amount: Math.round(serverAmountGhs * 100), // kobo (pesewas)
        currency: 'GHS',
        reference,
        channels: channel === 'momo' ? ['mobile_money'] : ['card', 'mobile_money'],
        metadata: { reservationId, passengerId },
      }),
    });
    const body = await resp.json();
    if (!resp.ok || !body?.status) {
      return res.status(502).json({ error: body?.message || 'paystack init failed' });
    }
    return res.json({
      reference,
      authorizationUrl: body.data?.authorization_url,
      accessCode: body.data?.access_code,
      amountGhs: serverAmountGhs,
      fareSource: serverFareNote,
    });
  } catch (e) {
    console.warn('[api] paystack init error:', e.message);
    return res.status(502).json({ error: 'paystack unreachable' });
  }
});

// ── Payments: status read (used by the client while waiting for webhook) ──
app.get('/payments/:reference', requireApiKey, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'db not configured' });
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('reference', req.params.reference)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'unknown reference' });
  return res.json(data);
});

// ── Wallet ─────────────────────────────────────────────────────────────────
app.get('/wallet/:userId', requireApiKey, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'db not configured' });
  const { data, error } = await supabase
    .from('wallet_balances')
    .select('*')
    .eq('user_id', req.params.userId)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json({
    userId: req.params.userId,
    balanceGhs: data?.balance_ghs ?? 0,
    lastTxnAt: data?.last_txn_at ?? null,
  });
});

app.get('/wallet/:userId/ledger', requireApiKey, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'db not configured' });
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const { data, error } = await supabase
    .from('wallet_ledger')
    .select('*')
    .eq('user_id', req.params.userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// ── Paystack webhook (idempotent) ──────────────────────────────────────────
function verifyPaystackSignature(req) {
  const signature = req.headers['x-paystack-signature'];
  if (!signature || !PAYSTACK_SECRET_KEY) return false;
  const computed = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(req.rawBody || Buffer.from(JSON.stringify(req.body)))
    .digest('hex');
  // timingSafeEqual requires equal-length buffers
  try {
    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(computed, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function processWebhookEvent(event) {
  if (!supabase) throw new Error('db not configured');

  // Step 1: idempotency claim. The unique constraint on event_id is what
  // prevents double-crediting if Paystack retries.
  const eventId = event?.id || event?.data?.id || `${event?.event}:${event?.data?.reference}`;
  if (!eventId) throw new Error('no event id');

  const { error: claimError } = await supabase.from('webhook_events').insert({
    provider: 'paystack',
    event_id: String(eventId),
    event_type: event?.event,
    raw: event,
  });
  if (claimError) {
    // 23505 = unique_violation → we already processed this event.
    if (claimError.code === '23505') return { duplicate: true };
    throw claimError;
  }

  // Step 2: apply side effects per event type.
  const ref = event?.data?.reference;
  if (!ref) return { applied: false, reason: 'no reference' };

  if (event?.event === 'charge.success') {
    const status = event?.data?.status === 'success' ? 'success' : 'failed';
    const amountKobo = Number(event?.data?.amount ?? 0);
    const amountGhs = amountKobo / 100;

    const { data: payment } = await supabase
      .from('payments')
      .update({
        status,
        processed_at: new Date().toISOString(),
        provider_response: event?.data,
      })
      .eq('reference', ref)
      .select('id, reservation_id, passenger_id, amount_ghs')
      .maybeSingle();

    if (status === 'success' && payment) {
      // Confirm reservation (idempotent — only flips active→paid).
      if (payment.reservation_id) {
        await supabase
          .from('reservations')
          .update({ status: 'paid' })
          .eq('id', payment.reservation_id)
          .eq('status', 'active');
      }
      // Credit the passenger ledger so we have a single auditable view of
      // what each user has actually paid. Credits here represent money in
      // (passenger → trotro). For mate payouts, run a separate batch job.
      if (payment.passenger_id) {
        await supabase.from('wallet_ledger').insert({
          user_id: payment.passenger_id,
          kind: 'spend',
          amount_ghs: amountGhs || payment.amount_ghs,
          reference: ref,
        });
      }
    }
  } else if (event?.event === 'charge.failed' || event?.event === 'charge.dispute.create') {
    await supabase
      .from('payments')
      .update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        provider_response: event?.data,
      })
      .eq('reference', ref);
  }

  return { applied: true };
}

app.post('/webhooks/paystack', async (req, res) => {
  if (!verifyPaystackSignature(req)) {
    return res.status(401).json({ error: 'bad signature' });
  }
  try {
    const result = await processWebhookEvent(req.body);
    return res.json({ ok: true, ...result });
  } catch (e) {
    console.warn('[api] webhook processing failed:', e.message);
    // Return 200 so Paystack stops retrying once we've at least logged it.
    // Use 500 if you'd rather have Paystack retry.
    return res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`[api] listening on :${PORT}`);
});
