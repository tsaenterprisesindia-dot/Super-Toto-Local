// Robust Vite build entry: locates the installed `vite` package (whether npm
// hoists it to the workspace root or nests it under client/node_modules) and
// runs its CLI. Fixes npm-workspaces bin-resolution failures on Render.
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

// Try resolving the vite package main entry from this directory (client/).
let viteMain;
try {
  viteMain = require.resolve('vite', { paths: [resolve(dirname(fileURLToPath(import.meta.url)))] });
} catch {
  console.error('Could not resolve vite package. Run `npm ci` at the repo root first.');
  process.exit(1);
}

// vite's main points at dist/node/index.js; the CLI lives at <pkg>/bin/vite.js.
// Derive the bin script from the package.json "bin" field when possible.
const pkgPath = require.resolve('vite/package.json', { paths: [resolve(dirname(fileURLToPath(import.meta.url)))] });
const vitePkg = require(pkgPath);
const binScript = vitePkg.bin && (typeof vitePkg.bin === 'string' ? vitePkg.bin : vitePkg.bin.vite);
if (!binScript) {
  console.error('Could not determine vite bin script.');
  process.exit(1);
}
const viteBin = resolve(dirname(pkgPath), binScript);

const args = process.argv.slice(2);
console.log(`[build] vite: ${viteBin}`);
const res = spawnSync(process.execPath, [viteBin, ...args], { stdio: 'inherit', cwd: dirname(fileURLToPath(import.meta.url)) });
process.exit(res.status ?? 1);
