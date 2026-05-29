#!/usr/bin/env node
/**
 * scripts/check-release.js
 *
 * Play Store pre-flight checks. Exits non-zero on blockers.
 * Run: npm run check:release
 */

const fs = require('fs');
const path = require('path');

const ROOTS = ['screens', 'components', 'services', 'constants', 'hooks'];
const SUFFIXES = ['.js', '.jsx', '.ts', '.tsx'];

const violations = [];
const warnings = [];

const RULES = [
  { re: /Lorem ipsum/i, msg: 'Lorem ipsum placeholder text' },
  { re: /\b555[- ]?\d{3,4}\b/, msg: 'Placeholder 555-xxx phone number' },
  { re: /TODO:\s*replace\s+before\s+ship/i, msg: 'Unresolved pre-ship TODO' },
  { re: /replace-with-publish-date/i, msg: 'Privacy policy publish date placeholder' },
  { re: /checkout\.stripe\.com/i, msg: 'External Stripe checkout URL' },
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (SUFFIXES.includes(path.extname(entry.name))) checkFile(full);
  }
}

function checkFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const rule of RULES) {
      if (rule.re.test(lines[i])) {
        violations.push({
          file: path.relative(process.cwd(), file),
          line: i + 1,
          msg: rule.msg,
          snippet: lines[i].trim().slice(0, 100),
        });
      }
    }
  }
}

for (const root of ROOTS) {
  if (fs.existsSync(root)) walk(root);
}

// app.json
try {
  const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  const expo = appJson?.expo ?? {};
  const perms = expo.android?.permissions ?? [];
  const blocked = expo.android?.blockedPermissions ?? [];

  if (perms.includes('android.permission.ACCESS_BACKGROUND_LOCATION')) {
    violations.push({ file: 'app.json', line: 0, msg: 'ACCESS_BACKGROUND_LOCATION must not be requested' });
  }
  if (!blocked.includes('android.permission.ACCESS_BACKGROUND_LOCATION')) {
    violations.push({ file: 'app.json', line: 0, msg: 'Block ACCESS_BACKGROUND_LOCATION in blockedPermissions' });
  }
  if (!expo.version || !expo.android?.versionCode) {
    violations.push({ file: 'app.json', line: 0, msg: 'Missing version or versionCode' });
  }
} catch (e) {
  violations.push({ file: 'app.json', line: 0, msg: `Could not parse: ${e.message}` });
}

// Version sync
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  const appInfo = fs.readFileSync('constants/appInfo.js', 'utf8');
  const appVersion = appJson.expo?.version;
  if (pkg.version !== appVersion) {
    warnings.push(`package.json version (${pkg.version}) != app.json (${appVersion})`);
  }
  if (!appInfo.includes(`APP_VERSION = '${appVersion}'`)) {
    warnings.push(`constants/appInfo.js APP_VERSION may not match app.json (${appVersion})`);
  }
} catch (e) {
  warnings.push(`Version sync check skipped: ${e.message}`);
}

// Store assets
const storeAssets = [
  'assets/store/icon-512.png',
  'assets/store/feature.png',
];
for (const asset of storeAssets) {
  if (!fs.existsSync(asset)) {
    warnings.push(`Missing store asset: ${asset} (required before Play submission)`);
  }
}

// Privacy policy hosted URL (warn only — set in EAS for production)
if (!process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL) {
  warnings.push('EXPO_PUBLIC_PRIVACY_POLICY_URL not set — host docs/PRIVACY_POLICY.md before Play submission');
}

// Sentry for production
if (!process.env.EXPO_PUBLIC_SENTRY_DSN) {
  warnings.push('EXPO_PUBLIC_SENTRY_DSN not set — recommended for production crash monitoring');
}

// Placeholder icon check (grid template in default Expo assets)
try {
  const iconPath = 'assets/images/icon.png';
  if (fs.existsSync(iconPath) && fs.statSync(iconPath).size < 50000) {
    warnings.push(`${iconPath} may still be a placeholder — replace with final 1024×1024 brand icon`);
  }
} catch {
  /* ignore */
}

if (warnings.length) {
  console.log(`check-release: ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(` ⚠ ${w}`);
  console.log('');
}

if (violations.length === 0) {
  console.log('check-release: OK — no blockers.');
  process.exit(0);
}

console.log(`check-release: ${violations.length} blocker(s):`);
for (const v of violations) {
  console.log(` ✗ ${v.file}:${v.line} — ${v.msg}`);
  if (v.snippet) console.log(`     ${v.snippet}`);
}
process.exit(1);
