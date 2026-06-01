#!/usr/bin/env node
/**
 * Generate Google Play store assets from the app icon.
 * Run: npm run generate:store-assets
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ICON = path.join(ROOT, 'assets/images/icon.png');
const OUT_DIR = path.join(ROOT, 'assets/store');

async function main() {
  if (!fs.existsSync(ICON)) {
    console.error('generate-store-assets: missing', ICON);
    process.exit(1);
  }

  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('generate-store-assets: install sharp first — npm install --save-dev sharp');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Play Store icon — 512×512, no alpha
  await sharp(ICON)
    .resize(512, 512, { fit: 'cover' })
    .flatten({ background: '#121212' })
    .png()
    .toFile(path.join(OUT_DIR, 'icon-512.png'));

  // Feature graphic — 1024×500 branded banner
  const iconSmall = await sharp(ICON).resize(280, 280, { fit: 'cover' }).png().toBuffer();
  const bg = Buffer.from(
    `<svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#121212"/>
          <stop offset="50%" stop-color="#1a1208"/>
          <stop offset="100%" stop-color="#121212"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="500" fill="url(#g)"/>
      <text x="340" y="210" fill="#ffffff" font-family="system-ui,sans-serif" font-size="52" font-weight="800">TrotroOS</text>
      <text x="340" y="270" fill="#f97316" font-family="system-ui,sans-serif" font-size="28" font-weight="600">Live trotro seats for Kumasi</text>
      <text x="340" y="320" fill="#aaaaaa" font-family="system-ui,sans-serif" font-size="22">Reserve a seat · See mates on the map</text>
    </svg>`,
  );

  await sharp(bg)
    .composite([{ input: iconSmall, left: 40, top: 110 }])
    .png()
    .toFile(path.join(OUT_DIR, 'feature.png'));

  console.log('generate-store-assets: wrote assets/store/icon-512.png');
  console.log('generate-store-assets: wrote assets/store/feature.png');
}

main().catch((e) => {
  console.error('generate-store-assets:', e.message);
  process.exit(1);
});
