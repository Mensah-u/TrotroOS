# TrotroOS Admin Dashboard (static)

Lightweight ops dashboard — open `index.html` in a browser after configuring Supabase credentials in the page (anon key only; use service role only on a secure server).

For production admin, deploy `server/api` with service role and add authenticated routes.

Mobile in-app admin: Profile → App Diagnostics → Open admin dashboard.

Run `supabase/FIX_v14_features.sql` before using safety reports, scheduled demand, and boarding RPC.
