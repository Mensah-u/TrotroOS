# TrotroOS Deployment Guide

## Overview

TrotroOS has automated deployment pipelines for both web and mobile (Android) platforms.

## Android App Bundle (AAB) Deployment

### Prerequisites

1. **Expo Account**: Create a free account at [expo.dev](https://expo.dev)
2. **EAS Token**: Generate from your Expo account settings
3. **GitHub Secrets**: Configure `EAS_TOKEN` in repository settings

### Setting Up EAS Token

1. Go to [expo.dev/settings/tokens](https://expo.dev/settings/tokens)
2. Create a new token with build permissions
3. Add to GitHub repository secrets as `EAS_TOKEN`

### Deployment Process

#### Automated (Recommended)
Tag your release with semantic versioning:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow will automatically:
- Build the AAB for Google Play Store
- Upload as a GitHub release artifact
- Ready for submission to Play Store

#### Manual Build
Trigger via GitHub Actions UI:

1. Go to **Actions** → **Build Android App Bundle (AAB)**
2. Click **Run workflow**
3. Select branch and click **Run workflow**

### Build Profiles

| Profile    | Output | Distribution | Use Case                    |
|-----------|--------|-------------|---------------------------|
| preview   | .apk   | Internal    | Testing & sharing with testers |
| production| .aab   | Store       | Google Play Store submission |

### Environment Variables

Required for builds:
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` - Google Maps API key (optional)

Configure these in GitHub Secrets or `.env` file locally.

### Submitting to Google Play Store

Once the AAB is generated:

1. Download from GitHub release
2. Go to [Google Play Console](https://play.google.com/console)
3. Create/select your app
4. Navigate to **Release** → **Production**
5. Upload the `.aab` file
6. Fill in release notes and submit for review

### Local AAB Build

For development/testing:

```bash
# Build APK for testing
npm run build:apk:interactive

# Build AAB locally (requires keystore)
eas build --platform android --profile production
```

## Web Deployment

Web builds are automatically deployed on pushes to `main` branch.

See `.github/workflows/deploy-web.yml` for details.

## Troubleshooting

### Build Fails with "Not authenticated"
```bash
EAS_TOKEN=your_token_here eas build --platform android --profile production
```

### AAB Not Generated
- Ensure `eas.json` has `"buildType": "app-bundle"` in production profile
- Check that all environment variables are set
- Verify Expo project is linked correctly

### Release Not Created
- Ensure GitHub token has release creation permissions
- Check that tag follows semantic versioning (v*.*.*)

## Resources

- [Expo EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [Google Play Console](https://play.google.com/console)
- [TrotroOS BUILD_APK Guide](./BUILD_APK.md)
