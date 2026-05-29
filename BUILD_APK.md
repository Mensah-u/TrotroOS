# Build TrotroOS installable APK

This produces a **standalone `.apk`** you can install on any Android phone — no Expo Go required.

## One-time setup (5 minutes)

1. **Create a free Expo account** at [expo.dev/signup](https://expo.dev/signup)

2. **Log in** in your terminal:
   ```powershell
   cd "C:\Users\HP\Documents\TrotroOSv2"
   npx eas-cli login
   ```

3. **Link the project** (first time only):
   ```powershell
   npx eas-cli init
   ```
   Accept the prompts — this adds your project ID to `app.json`.

## Build the APK

**Option A — script (recommended):**
```powershell
cd "C:\Users\HP\Documents\TrotroOSv2"
.\scripts\build-apk.ps1
```

**Option B — npm script:**
```powershell
npm run build:apk:interactive
```

The build runs on Expo’s cloud servers (~10–20 min). When finished, you get a **download link** for `TrotroOS.apk`.

## Install on your phone

1. Download the `.apk` from the build page (or scan the QR code Expo shows).
2. On Android: **Settings → Security → Install unknown apps** (allow your browser/files app).
3. Open the APK file and tap **Install**.

## Profiles

| Profile      | Output | Use case                    |
|-------------|--------|-----------------------------|
| `preview`   | `.apk` | Share & test (recommended)  |
| `production`| `.aab` | Google Play Store           |

Config is in `eas.json`.

## Troubleshooting

- **Not logged in** → `npx eas-cli login`
- **No project ID** → `npx eas-cli init`
- **Maps blank on device** → Add a Google Maps API key in `app.json` under `android.config.googleMaps.apiKey` (optional for testing other features)
