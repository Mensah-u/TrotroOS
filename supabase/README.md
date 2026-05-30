# TrotroOS Supabase Backend

## One-time setup (required for mate sign-up)

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/siwzjxwholmoassrdtwx/sql/new)
2. Open **`RUN_THIS_FIRST.sql`** in this folder, copy **all** of it, paste into the editor, click **Run**
3. Wait ~1 minute (or **Settings → API → Reload schema**), then retry mate sign-up in the app

Alternatively run `migrations/000_trotroos_complete_schema.sql` then `006_reservation_seat_sync.sql`.

**Mate can't start a trip / "permission denied"?** Run the **entire** **`FIX_mate_depart_now.sql`** in SQL Editor (grants, RLS, `create_mate_trip` RPC). From project root: `.\scripts\fix-depart-now.ps1` opens the file and editor. Wait ~30s after Run, then try **Depart Now** again.

**Mate fare not showing for passengers?** Run **`FIX_trip_fare.sql`** once (adds `trips.fare_ghs` + `driver_locations.fare_ghs` + updates `create_mate_trip`). Helper: `.\scripts\fix-trip-fare.ps1`. After running, end the current trip and start a new one with your fare set.

**Mate can't see seat reservations?** Run **`FIX_mate_reservations.sql`** once (mate RLS + `get_mate_trip_reservations` RPC). Helper: `.\scripts\fix-mate-reservations.ps1`.

**v1.4 features (verification, scheduled rides, safety reports, boarding RPC)?** Run **`FIX_v14_features.sql`** once.

**Security Advisor warnings (RLS / public access)?** Run **`FIX_security_hardening.sql`** once after updating the app. Helper: `.\scripts\fix-security.ps1` opens the SQL Editor and the file. Your admin account (`mensahstephen385@gmail.com`) is auto-added to `app_admins` when that email exists in Auth.

**Mate dashboard shows static "No queue yet" / Live sync?** Run **`FIX_live_demand.sql`** so `passenger_locations` + Realtime work. Passengers must tap **I'm waiting** on Find Ride to appear in the queue.

**Want cheaper reads as the fleet grows?** Run **`FIX_nearby_indexes.sql`** once. Adds `(latitude, longitude)` B-tree indexes plus a generated `geohash5` column on `driver_locations` and `passenger_locations` so the app's 2 km bounding-box queries stay sub-millisecond. Safe to run multiple times.

3. In **Authentication → Providers → Email**, disable **Confirm email** for easier dev testing (optional)

4. In **Database → Replication**, confirm these tables show Realtime enabled:
   - `trips`, `reservations`, `driver_locations`, `passenger_locations`, `ratings`

## Tables created

| Table | Purpose |
|-------|---------|
| `mate_profiles` | Driver name, phone, vehicle, default route |
| `trips` | Live mate trips (Depart Now) |
| `reservations` | Passenger seat holds |
| `driver_locations` | Mate GPS on map |
| `passenger_locations` | Waiting passengers + demand queue |
| `passenger_profiles` | Passenger display name, notifications, privacy |
| `ratings` | Post-trip star ratings |

## App sync

- **Mate profile** → Supabase auth + `mate_profiles`
- **Passenger profile** → `passenger_profiles` keyed by device ID (synced from Profile tab)
- **Trips / reservations / locations / ratings** → real-time via Supabase Realtime

After running SQL, reload the app (`r` in Metro).
