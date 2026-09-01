import bcrypt from 'bcryptjs';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERSIST_FILE = join(__dirname, '..', '.otp-store.json');

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_STORED = 300;

// Load persisted store from disk (survives server restarts).
let store = new Map();
if (existsSync(PERSIST_FILE)) {
  try {
    const raw = JSON.parse(readFileSync(PERSIST_FILE, 'utf8'));
    for (const [k, v] of Object.entries(raw)) {
      if (v.expiresAt > Date.now()) store.set(k, v);
    }
  } catch { /* start fresh */ }
}

function persist() {
  try {
    const obj = {};
    for (const [k, v] of store) obj[k] = v;
    writeFileSync(PERSIST_FILE, JSON.stringify(obj));
  } catch { /* ignore write errors */ }
}

const keyFor = (phone, purpose) => `${purpose}:${phone}`;

export async function createOtp(phone, purpose) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const key = keyFor(phone, purpose);
  store.set(key, {
    hash: await bcrypt.hash(code, 10),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });

  if (store.size > MAX_STORED) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }

  persist();
  return code;
}

export async function verifyOtp(phone, purpose, code) {
  if (!phone || code === undefined || code === null) return false;
  const key = keyFor(phone, purpose);
  const entry = store.get(key);
  if (!entry) return false;

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    persist();
    return false;
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(key);
    persist();
    return false;
  }
  entry.attempts += 1;

  const ok = await bcrypt.compare(String(code).trim(), entry.hash);
  if (ok) store.delete(key);
  persist();
  return ok;
}
