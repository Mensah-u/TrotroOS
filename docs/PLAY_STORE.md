# Play Store readiness checklist (TrotroOS)

Run through every box below before promoting an Android App Bundle from
internal to closed/open testing. The goal: zero rejections, ever.

## 1. Build & signing

- [ ] **Same keystore as the existing APK.** If you originally shipped a
      release APK signed by EAS, do **not** generate a new keystore. Fetch
      the current one with:
      ```bash
      eas credentials              # → Android → Production → "Download keystore"
      ```
      Save it to `secrets/trotroos-upload.jks` (gitignored — already covered
      by the default `.gitignore`).
- [ ] Confirm fingerprints match what Google Play Console shows under
      *Setup → App integrity*:
      ```bash
      keytool -list -v -keystore secrets/trotroos-upload.jks
      ```
- [ ] `app.json` is in sync (currently `versionCode: 7`, `version: "1.3.0"`).
      Every Play upload **must** bump `versionCode`. Bump `version` (the user-
      visible name) whenever there's a meaningful feature/bugfix release.

## 2. Build the AAB

```bash
# EAS-managed (recommended)
eas build --platform android --profile production
#  ⇒ produces a signed *.aab and an *.apk for sideloading

# Bare workflow (after `npx expo prebuild`)
cd android
./gradlew clean bundleRelease
#  ⇒ android/app/build/outputs/bundle/release/app-release.aab
```

## 3. Test the AAB on a real device

```bash
# Install the .aab on a connected device via bundletool
bundletool build-apks \
  --bundle=app-release.aab \
  --output=app-release.apks \
  --mode=universal \
  --ks=secrets/trotroos-upload.jks \
  --ks-key-alias=upload \
  --ks-pass=pass:KEYSTORE_PASSWORD

bundletool install-apks --apks=app-release.apks
```

Or use **Play Console → Internal testing → Upload AAB → Add testers** and
install via the Play Store link.

## 4. Google Play Developer account

- [ ] Pay the **one-time $25 USD** registration fee at
      <https://play.google.com/console/signup>.
- [ ] Create the org profile (Ghana, business or individual).
- [ ] Verify identity (passport / ID).

## 5. Store listing assets

| Asset                  | Spec                          | Where it lives in this repo |
| ---------------------- | ----------------------------- | --------------------------- |
| App icon               | 512×512 PNG (no alpha)        | `assets/store/icon-512.png` |
| Feature graphic        | 1024×500 PNG                  | `assets/store/feature.png`  |
| Phone screenshots (×4–6)| 1080×1920 or 1080×2400 PNG   | `assets/store/screenshots/` |
| Short description      | ≤ 80 chars                    | `docs/STORE_LISTING.md`     |
| Full description       | ≤ 4 000 chars                 | `docs/STORE_LISTING.md`     |
| Privacy policy URL     | Must be live before submission| see `docs/PRIVACY_POLICY.md`|

## 6. Content rating

- [ ] **Category:** Maps & Navigation (primary), Travel & Local (secondary).
- [ ] Declare location usage: **fine + coarse**, *foreground only*.
- [ ] **No background location**. We disabled it explicitly in `app.json`
      via `isAndroidBackgroundLocationEnabled: false` and listed
      `ACCESS_BACKGROUND_LOCATION` under `blockedPermissions`.
- [ ] No ads, no UGC, no in-app purchases in v1.3.0 (fares paid to mate in cash/MoMo on board).
- [ ] Privacy Policy URL returns 200 on mobile — set `EXPO_PUBLIC_PRIVACY_POLICY_URL` in EAS secrets; in-app copy at Profile → Privacy Policy.
- [ ] Data & privacy screen works (export, clear cache, deletion request email).

## 7. Distribution

- [ ] Set primary country: **Ghana**.
- [ ] Add: Côte d'Ivoire, Togo, Burkina Faso, Benin, Nigeria
      (West-Africa expansion-ready — turn off until you actually launch).
- [ ] Price: **Free** (no subscriptions, no IAP).

## 8. Test track strategy

1. **Internal testing** — up to 100 testers, instant releases.
   Use this for daily dogfood builds.
2. **Closed testing** — invite real Kumasi mates (≥ 12 testers + 14 days
   is required before Play accepts new personal-developer accounts into
   production).
3. **Open testing / Production** — only after the closed-track 14-day
   window closes with zero P1 crashes.

## 9. Pre-submission rejection checks

- [ ] Screenshots show **real KNUST/Adum routes** — no Lorem Ipsum, no
      mock data overlays, no "DEBUG" badges.
- [ ] Location permission rationale is the exact string from `app.json`'s
      `locationWhenInUsePermission`, and explains *why* in user-visible
      copy.
- [ ] No background-location language in the listing, manifest, or copy.
- [ ] GPS runs **foreground only** while the app is open (`locationBroadcaster.js`).
- [ ] Privacy Policy URL returns 200 and renders on mobile (test on device).
- [ ] App opens to a working screen within 5 seconds on a mid-range device.
- [ ] No placeholder strings in the UI (search for `TODO`, `Lorem`, `Test User`).
- [ ] Set `EXPO_PUBLIC_SENTRY_DSN` and `npx expo install sentry-expo` for production crash reports.

## 10. Sanity script

```bash
npm run check:release
npm run build:aab
# or: eas build --platform android --profile production
```

`scripts/check-release.js` greps for the common red flags (TODO strings in
screens, mock numbers, etc.) and exits non-zero if it finds any. CI can
gate the build on it.
