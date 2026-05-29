# Store listing assets (Google Play)

Create these before submitting to Play Console. See `docs/PLAY_STORE.md`.

| File | Size | Notes |
|------|------|-------|
| `icon-512.png` | 512×512 PNG | **No transparency** — Play Store high-res icon |
| `feature.png` | 1024×500 PNG | Feature graphic banner |
| `screenshots/*.png` | 1080×1920 or 1080×2400 | 4–6 phone screenshots, real Kumasi routes |

**Tips**

- Use the same orange/blue brand as the in-app UI (`#F97316` passenger, dark `#0C0C0C` background).
- Show Find Ride with a real route (e.g. KNUST → Adum), mate dashboard with live map, reservation flow.
- No "DEBUG", Lorem ipsum, or placeholder grid icons.
- Export from Android device screenshots or Figma at exact pixel dimensions.

**App icon source:** Replace `assets/images/icon.png` (1024×1024) and adaptive layers under `assets/images/android-icon-*.png` before production AAB build.
