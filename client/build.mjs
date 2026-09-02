// Robust Vite build entry.
// npm + Render can hoist the `vite` package to either the repo root
// node_modules or the client workspace node_modules. This script searches all
// of them and runs whatever vite CLI it finds, so the build never depends on a
// specific workspace layout. Also prints a diagnostic of the local layout.
import { createRequire } from 'node:module';
import { resolve, dirname, join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // client/
const require = createRequire(import.meta.url);
const root = resolve(here, '..');

function findViteBin() {
  // Standard Node resolution from the client dir (covers hoisted-to-root too).
  for (const pkg of ['vite', 'vite/package.json']) {
    try {
      const p = require.resolve(pkg, { paths: [here, root] });
      if (p) {
        const bin = pkg === 'vite' ? deriveBin(p) : deriveBinFromPkg(p);
        if (bin) return bin;
      }
    } catch {}
  }
  // Fallback: scan known locations for the vite CLI JS.
  const candidates = [];
  for (const base of [here, root]) {
    candidates.push(join(base, 'node_modules', 'vite', 'bin', 'vite.js'));
    candidates.push(join(base, 'node_modules', '.bin', 'vite'));
    candidates.push(join(base, 'node_modules', '.bin', 'vite.cmd'));
  }
  for (const c of candidates) { if (existsSync(c)) return c; }
  return null;
}

function pkgDir(path) { return path.split('node_modules')[0] + 'node_modules'; }
function deriveBin(p) {
  // p is the main entry; find the package dir upward
  const nu = p.replace(/\\/g, '/');
  const idx = nu.lastIndexOf('/node_modules/');
  if (idx < 0) return p;
  const base = nu.slice(0, idx + '/node_modules/'.length);
  for (const dir of readdirSync(base)) {
    if (dir === 'vite' && existsSync(join(base, 'vite', 'bin', 'vite.js'))) {
      return join(base, 'vite', 'bin', 'vite.js');
    }
  }
  return p;
}
function deriveBinFromPkg(pkgPath) {
  const pkg = require(pkgPath);
  const bin = pkg.bin && (typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.vite);
  return bin ? resolve(dirname(pkgPath), bin) : null;
}

console.log(`[build] here=${here}`);
console.log(`[build] root=${root}`);
const viteBin = findViteBin();
if (!viteBin) {
  // Diagnostic dump so the next build shows exactly what is present.
  console.log('[build] vite NOT found. node_modules listing:');
  for (const base of [here, root]) {
    const nm = join(base, 'node_modules');
    if (existsSync(nm)) {
      console.log(`  ${nm}:`);
      try { readdirSync(nm).filter((d) => /vite|@vitejs/i.test(d)).forEach((d) => console.log(`    ${d}`)); } catch {}
    } else { console.log(`  ${nm}: <missing>`); }
  }
  process.exit(1);
}
console.log(`[build] using vite: ${viteBin}`);
const res = spawnSync(process.execPath, [viteBin, ...process.argv.slice(2)], { stdio: 'inherit', cwd: here });
process.exit(res.status ?? 1);
