#!/usr/bin/env node
/** Ensure privacy.html is present in web export output. */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../public/privacy.html');
const dist = path.join(__dirname, '../dist/privacy.html');

if (!fs.existsSync(src)) {
  console.warn('post-web-build: public/privacy.html missing — skip');
  process.exit(0);
}

if (!fs.existsSync(path.dirname(dist))) {
  console.warn('post-web-build: dist/ missing — run build:web first');
  process.exit(0);
}

fs.copyFileSync(src, dist);
console.log('post-web-build: copied privacy.html → dist/privacy.html');
