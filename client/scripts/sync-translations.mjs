#!/usr/bin/env node
/*
 * sync-translations.mjs
 *
 * Regenerates / fills the translation locale files (src/locales/*.json) from the
 * English source-of-truth (en.json).
 *
 * Providers:
 *   free   (default)  Google Translate public endpoint. No API key needed.
 *   google            Google Cloud Translation v2. Needs GOOGLE_TRANSLATE_API_KEY.
 *
 * Behaviour:
 *   - en.json is the master key set (namespaced JSON).
 *   - Existing (non-empty) translations are KEPT unless --force is passed.
 *   - i18next plural variants (_one/_other) in en.json are folded into the base
 *     key for target locales (targets use a single generic form that i18next
 *     falls back to for all counts).
 *   - Placeholders like {{count}}, {{fare}}, {amount} are protected around
 *     translation so they survive intact.
 *
 * Usage:
 *   node scripts/sync-translations.mjs [lang...] [--provider free|google] [--force]
 *   examples:
 *     node scripts/sync-translations.mjs                 # fill all locales, free provider
 *     node scripts/sync-translations.mjs te ta --force   # overwrite Telugu & Tamil
 *     $env:GOOGLE_TRANSLATE_API_KEY="..." ; node scripts/sync-translations.mjs --provider google
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALE_DIR = join(__dirname, '..', 'src', 'locales');

const DEFAULT_LOCALES = ['hi', 'bn', 'mr', 'te', 'ta'];
const isPlaceholderKey = (k) => /_(one|other|zero|two|few|many)$/.test(k);
const PLACEHOLDER_RE = /\{\{[\w\s._-]+\}\}|\{[A-Za-z][\w.]*\}/g;

function protect(text) {
  const found = [];
  const protected_ = text.replace(PLACEHOLDER_RE, (m) => {
    found.push(m);
    return `\u0001${found.length - 1}\u0001`;
  });
  return { protected_, found };
}

function restore(text, found) {
  return text.replace(/\u0001(\d+)\u0001/g, (_, i) => (found[Number(i)] ?? ''));
}

function flatten(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flatten(v, key));
    else out.push([key, String(v)]);
  }
  return out;
}

function setPath(obj, path, value) {
  const parts = path.split('.');
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cursor[parts[i]] ??= {};
    cursor = cursor[parts[i]];
  }
  cursor[parts[parts.length - 1]] = value;
}

function unflatten(entries) {
  const obj = {};
  for (const [key, value] of entries) setPath(obj, key, value);
  return obj;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

async function translateFree(text, target) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`free provider HTTP ${res.status}`);
  const data = await res.json();
  return (data[0] || []).map((seg) => seg[0]).join('');
}

async function translateGoogle(text, target, key) {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, source: 'en', target, format: 'text' }),
  });
  if (!res.ok) throw new Error(`google provider HTTP ${res.status}`);
  const data = await res.json();
  return data?.data?.translations?.[0]?.translatedText ?? '';
}

const args = process.argv.slice(2);
const langArgs = args.filter((a) => !a.startsWith('--'));
const flags = new Set(args.filter((a) => a.startsWith('--')));
const provider = flags.has('--provider')
  ? args[args.indexOf('--provider') + 1]
  : 'free';
const force = flags.has('--force');
const locales = langArgs.length ? langArgs : DEFAULT_LOCALES;

const en = readJson(join(LOCALE_DIR, 'en.json'));
if (!en) {
  console.error('en.json not found; aborting.');
  process.exit(1);
}
const master = flatten(en);
const googleKey = provider === 'google' ? process.env.GOOGLE_TRANSLATE_API_KEY : '';
if (provider === 'google' && !googleKey) {
  console.error('--provider google requires GOOGLE_TRANSLATE_API_KEY env var.');
  process.exit(1);
}
if (!['free', 'google'].includes(provider)) {
  console.error(`Unknown provider "${provider}" (use free or google).`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const lang of locales) {
  const path = join(LOCALE_DIR, `${lang}.json`);
  const existing = readJson(path) || {};
  const targets = master.filter(([key]) => {
    if (isPlaceholderKey(key)) return false; // handled by folding below
    return typeof existing[key] !== 'string' || existing[key].trim() === '' || force;
  });
  const toOverwrite = master.filter(([key]) => {
    const base = lang === 'en' ? null : key.replace(/_(one|other|zero|two|few|many)$/, '');
    if (/_(other|zero|two|few|many)$/.test(key)) return false;
    if (/_(one)$/.test(key)) {
      return base && !(typeof existing[base] === 'string' && existing[base].trim() !== '');
    }
    return false;
  });

  console.log(`\n[${lang}]`);
  let translated = 0;
  let skipped = 0;

  const queue = [];
  for (const [key, text] of targets) queue.push([key, text]);
  for (const [key, text] of toOverwrite) {
    const base = key.replace(/_(one)$/, '');
    if (!queue.some(([k]) => k === base)) queue.push([base, text]);
  }

  for (const [key, text] of queue) {
    const already = typeof existing[key] === 'string' && existing[key].trim() !== '';
    if (already && !force) {
      skipped++;
      continue;
    }
    const { protected_, found } = protect(text);
    let translated_text;
    try {
      translated_text = provider === 'google'
        ? await translateGoogle(protected_, lang, googleKey)
        : await translateFree(protected_, lang);
      translated_text = restore(translated_text, found).trim();
    } catch (e) {
      console.error(`  ✗ ${key}: ${e.message}`);
      await sleep(1000);
      continue;
    }
    if (!translated_text) {
      console.error(`  ✗ ${key}: empty translation`);
      await sleep(500);
      continue;
    }
    setPath(existing, key, translated_text);
    translated++;
    await sleep(provider === 'free' ? 250 : 80);
  }

  mkdirSync(LOCALE_DIR, { recursive: true });
  const ordered = {};
  for (const [key] of master) {
    const base = key.replace(/_(one|other|zero|two|few|many)$/, '');
    if (/_(one|other|zero|two|few|many)$/.test(key)) {
      if (typeof existing[base] === 'string') ordered[base] = existing[base];
    } else if (!(key in ordered) || typeof existing[key] === 'string') {
      ordered[key] = existing[key];
    }
  }
  writeFileSync(path, `${JSON.stringify(unflatten(Object.entries(ordered)), null, 2)}\n`);
  console.log(`  ✓ ${translated} filled · ${skipped} kept existing`);
}

const CHK = flatten(readJson(join(LOCALE_DIR, 'en.json'))).filter(([k]) => !isPlaceholderKey(k));
for (const lang of locales) {
  const existing = readJson(join(LOCALE_DIR, `${lang}.json`)) || {};
  const missing = CHK.filter(([key]) => typeof existing[key] !== 'string').map(([key]) => key);
  if (missing.length) console.log(`[${lang}] still missing ${missing.length} keys: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`);
}
console.log('\nDone. Existing hand-written translations were preserved (use --force to overwrite).');