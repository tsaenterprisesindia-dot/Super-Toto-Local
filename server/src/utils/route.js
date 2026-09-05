// Road-distance resolution. Uses an OSRM-compatible routing server for driving
// distance + duration so fares and ETAs reflect real roads rather than a
// straight (haversine) line. Falls back to haversine when the router is
// unreachable so pricing never breaks.
import { haversineKm } from './pricing.js';

const OSRM_BASE = process.env.OSRM_URL || 'https://router.project-osrm.org';
const OSRM_DISABLED = process.env.OSRM_DISABLED === '1';
const TIMEOUT_MS = Number(process.env.OSRM_TIMEOUT_MS) || 3000;
const POSITIVE_TTL = 6 * 60 * 60 * 1000; // real road result: 6h
const NEGATIVE_TTL = 60 * 1000; // fallback result: 60s so outages don't re-hit
const MAX_CACHE = 500;

const cache = new Map();

export function clearRouteCache() {
  cache.clear();
}

// fetch one OSRM route. OSRM expects (lng,lat). Returns null on any failure so
// callers fall back to haversine.
async function fetchOsmr(a, b, fetchImpl, base) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const url = `${base}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false&alternatives=false&steps=false&annotations=false`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'super-toto-local/1' },
    });
    if (!res || !res.ok) return null;
    const data = await res.json();
    const route = data && data.routes && data.routes[0];
    if (data.code !== 'Ok' || !route || typeof route.distance !== 'number' || typeof route.duration !== 'number') {
      return null;
    }
    return {
      distanceKm: Math.max(0, Math.round((route.distance / 1000) * 1000) / 1000),
      durationSec: Math.max(0, route.duration),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Resolve road distance + duration for a pickup/drop pair.
// Returns { distanceKm, durationMin, source } where source is 'osrm' (road)
// or 'haversine' (straight-line fallback; durationMin is null so the caller
// derives a nominal duration from distance).
export async function getRoute({ pickup, drop, fetchImpl } = {}) {
  const a = pickup || {};
  const b = drop || {};
  const key =
    a.lat != null && a.lng != null && b.lat != null && b.lng != null
      ? `${a.lat.toFixed(4)},${a.lng.toFixed(4)}|${b.lat.toFixed(4)},${b.lng.toFixed(4)}`
      : null;
  if (key && cache.has(key)) {
    const hit = cache.get(key);
    const ttl = hit.source === 'osrm' ? POSITIVE_TTL : NEGATIVE_TTL;
    if (hit.ts + ttl > Date.now()) {
      return { distanceKm: hit.distanceKm, durationMin: hit.durationMin, source: hit.source };
    }
  }

  const haversine = haversineKm(a, b);
  let distanceKm = haversine;
  let durationMin = null;
  let source = 'haversine';
  if (!OSRM_DISABLED) {
    const road = await fetchOsmr(a, b, fetchImpl || globalThis.fetch, OSRM_BASE);
    if (road) {
      distanceKm = road.distanceKm;
      durationMin = Math.max(2, Math.round(road.durationSec / 60));
      source = 'osrm';
    }
  }

  if (key) {
    if (cache.size >= MAX_CACHE) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
    cache.set(key, { distanceKm, durationMin, source, ts: Date.now() });
  }
  return { distanceKm, durationMin, source };
}