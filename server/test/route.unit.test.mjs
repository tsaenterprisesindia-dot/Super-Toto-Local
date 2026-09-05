import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRoute, clearRouteCache } from '../src/utils/route.js';
import { haversineKm } from '../src/utils/pricing.js';

const PICKUP = { lat: 27.331, lng: 88.614 };
const DROP = { lat: 27.289, lng: 88.606 };

const okFetch = (js) => () => ({ ok: true, json: async () => js });
const failFetch = () => {
  throw new Error('router unreachable');
};

test('route: parses a real OSRM response', async () => {
  clearRouteCache();
  const fetchImpl = okFetch({ code: 'Ok', routes: [{ distance: 4300, duration: 720 }] });
  const r = await getRoute({ pickup: PICKUP, drop: DROP, fetchImpl });
  assert.equal(r.source, 'osrm');
  assert.equal(r.distanceKm, 4.3);
  assert.equal(r.durationMin, 12);
});

test('route: falls back to haversine when the router errors', async () => {
  clearRouteCache();
  const r = await getRoute({ pickup: PICKUP, drop: DROP, fetchImpl: failFetch });
  assert.equal(r.source, 'haversine');
  assert.equal(r.durationMin, null);
  assert.equal(r.distanceKm, haversineKm(PICKUP, DROP));
});

test('route: falls back when OSRM returns no route (code != Ok)', async () => {
  clearRouteCache();
  const fetchImpl = okFetch({ code: 'NoRoute', routes: [] });
  const r = await getRoute({ pickup: PICKUP, drop: DROP, fetchImpl });
  assert.equal(r.source, 'haversine');
  assert.equal(r.distanceKm, haversineKm(PICKUP, DROP));
});

test('route: road result is reused from cache even if the router later fails', async () => {
  clearRouteCache();
  await getRoute({ pickup: PICKUP, drop: DROP, fetchImpl: okFetch({ code: 'Ok', routes: [{ distance: 4300, duration: 720 }] }) });
  const second = await getRoute({ pickup: PICKUP, drop: DROP, fetchImpl: failFetch });
  assert.equal(second.source, 'osrm');
  assert.equal(second.distanceKm, 4.3);
});

test('route: fallback result is negative-cached (no repeat router hit)', async () => {
  clearRouteCache();
  let calls = 0;
  const fetchImpl = () => {
    calls += 1;
    return { ok: true, json: async () => ({ code: 'Ok', routes: [{ distance: 4300, duration: 720 }] }) };
  };
  const first = await getRoute({ pickup: PICKUP, drop: DROP, fetchImpl: failFetch }); // router fails -> haversine cached
  assert.equal(first.source, 'haversine');
  const second = await getRoute({ pickup: PICKUP, drop: DROP, fetchImpl });
  assert.equal(calls, 0);
  assert.equal(second.source, 'haversine');
});

test('route: degenerate coordinates skip the router entirely', async () => {
  clearRouteCache();
  let called = false;
  const fetchImpl = () => {
    called = true;
    return { ok: true, json: async () => ({ code: 'Ok', routes: [{ distance: 1000, duration: 120 }] }) };
  };
  const r = await getRoute({ pickup: { lat: null, lng: 88.6 }, drop: DROP, fetchImpl });
  assert.equal(called, false);
  assert.equal(r.source, 'haversine');
});