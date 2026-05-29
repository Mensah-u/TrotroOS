# TrotroOS

**Real-time shared transport for Kumasi, Ghana.**

TrotroOS connects passengers with trotro mates (drivers) on live routes across Kumasi. Passengers find nearby vehicles, reserve seats, and track trips on a live map. Mates broadcast their location, manage demand queues, and depart when ready.

| | |
|---|---|
| **Version** | 1.3.0 |
| **Platform** | Android (primary), iOS-ready |
| **Package** | `com.trotro.os` |
| **Region** | Kumasi — GHS fares, on-board / MoMo payment |

---

## Features

### For passengers
- Browse routes and view live vehicle positions on a map
- Signal **I'm waiting** to join the mate's demand queue
- Reserve seats and receive trip updates in real time
- Rate completed trips and manage profile, history, and privacy settings

### For mates
- Sign in with Supabase Auth and manage a driver profile
- Start trips, broadcast GPS while the app is open, and view waiting passengers
- **Depart Now** to activate a live trip and sync reservations
- Dashboard with demand queue and trip controls

### Platform
- Foreground-only location (no background GPS)
- Supabase Realtime for live map and queue sync
- Privacy policy, data export, and account deletion flows
- Play Store release tooling (`check:release`, EAS build scripts)

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Mobile | [Expo SDK 54](https://docs.expo.dev/) · React Native 0.81 · React 19 |
| Navigation | React Navigation 7 |
| Backend | [Supabase](https://supabase.com) — Auth, Postgres, Realtime |
| Maps | react-native-maps · Google Maps (Android) |
| Build | [EAS Build](https://docs.expo.dev/build/introduction/) |

---

## Prerequisites

- **Node.js** 18+ and npm
- **Expo Go** on a physical device, or Android Studio for an emulator
- A **Supabase** project with the schema applied (see [supabase/README.md](./supabase/README.md))
- A **Google Maps Android API key** restricted to `com.trotro.os`

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/Mensah-u/TrotroOS.git
cd TrotroOS
npm install
```

### 2. Configure API keys

API keys are **not** stored in the public repository. Set them locally using either method below.

**Option A — secrets file (recommended for local dev)**

```bash
cp constants/config.secrets.example.js constants/config.secrets.js
```

Edit `constants/config.secrets.js` with your Supabase URL, anon key, and Google Maps key.

**Option B — environment file**

```bash
cp .env.example .env
```

Fill in the `EXPO_PUBLIC_*` variables in `.env`.

Both files are gitignored and will never be committed.

### 3. Set up Supabase

Run the SQL scripts in the [supabase/](./supabase/) folder against your project:

1. **`RUN_THIS_FIRST.sql`** — base schema (required)
2. **`FIX_passenger_profiles_and_reservations.sql`** — booking fixes
3. **`FIX_ratings.sql`** — ratings table
4. **`FIX_mate_depart_now.sql`** — mate trip permissions
5. **`FIX_live_demand.sql`** — passenger queue / Realtime

See [supabase/README.md](./supabase/README.md) for full details.

In **Authentication → URL Configuration**, add the redirect URL:

```
trotrops://auth/callback
```

### 4. Run the app

```powershell
npm start
```

Scan the QR code with Expo Go, or press `a` for Android.

| Command | Description |
|---------|-------------|
| `npm start` | Start Metro on LAN with QR code (Windows) |
| `npm run qr` | Reprint QR code |
| `npm run android` | Open on Android emulator |
| `npm run lint` | Run ESLint |
| `npm run check:release` | Pre-flight Play Store checks |

Press **`r`** in the Metro terminal to reload after code changes.

---

## Project structure

```
TrotroOS/
├── App.js                 # Root navigation and session bootstrap
├── screens/               # Passenger, mate, and profile screens
├── components/          # Shared UI (maps, modals, passenger widgets)
├── services/              # Supabase client, auth, location, monitoring
├── hooks/                 # Session and app state hooks
├── constants/             # Theme, routes, config (secrets gitignored)
├── supabase/              # SQL migrations and fix scripts
├── docs/                  # Privacy policy, Play Store, scaling guides
├── scripts/               # Dev server, release checks, build helpers
└── server/                # Optional ETA cache and API services
```

For contributor and AI-agent conventions, see [AGENTS.md](./AGENTS.md).

---

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` | Yes | Google Maps key for Android builds |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | Play Store | Hosted privacy policy URL |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional | Production crash reporting |

For EAS production builds, set these as [EAS secrets](https://docs.expo.dev/build-reference/variables/).

---

## Building for release

```powershell
npm run check:release    # Verify no blockers before submission
npm run build:aab        # Production Android App Bundle via EAS
```

Release checklist and store listing copy: [docs/PLAY_STORE.md](./docs/PLAY_STORE.md).

---

## Security

- Never commit `constants/config.secrets.js` or `.env`
- Restrict your Google Maps key to package `com.trotro.os` and your release SHA-1
- Use Supabase Row Level Security (RLS) — policies are defined in the SQL scripts
- Rotate any keys that were previously exposed in git history

---

## Documentation

| Document | Purpose |
|----------|---------|
| [AGENTS.md](./AGENTS.md) | Architecture, conventions, and known pitfalls |
| [supabase/README.md](./supabase/README.md) | Database setup and Realtime |
| [docs/PLAY_STORE.md](./docs/PLAY_STORE.md) | Play Store submission guide |
| [docs/PRIVACY_POLICY.md](./docs/PRIVACY_POLICY.md) | Privacy policy source |
| [docs/SCALE_UP.md](./docs/SCALE_UP.md) | Scaling and performance notes |

---

## License

Private project. All rights reserved.
