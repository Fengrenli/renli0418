import fs from 'node:fs';
import path from 'node:path';

const releaseRootArg = process.argv[2];
if (!releaseRootArg) {
  console.error('Usage: node verify-editor-assets.mjs <editor-release-root>');
  process.exit(1);
}

const releaseRoot = path.resolve(releaseRootArg);
const requiredPaths = [
  'apps/editor/server.js',
  'apps/editor/.next/static',
  'apps/editor/public/pascal.svg',
  'apps/editor/public/pascal-logo-shape.svg',
  'apps/editor/public/pascal-logo-full.svg',
  'apps/editor/public/globe.svg',
  'apps/editor/public/file-text.svg',
  'apps/editor/public/cursor.svg',
];

const missing = requiredPaths.filter((relPath) => !fs.existsSync(path.join(releaseRoot, relPath)));

if (missing.length > 0) {
  console.error('[verify-editor-assets] Missing files:');
  missing.forEach((item) => console.error(`  - ${item}`));
  process.exit(2);
}

console.log(`[verify-editor-assets] OK (${releaseRoot})`);

