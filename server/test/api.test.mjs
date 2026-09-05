// Super Toto Local — server integration tests.
//
// Boots the real API against an in-memory MongoDB (auto-seeded with demo data)
// and exercises the public endpoints end-to-end. Run with: npm test -w server
//
// Node >= 18 required (uses the built-in test runner and global fetch).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '..');

const PICKUP = { name: 'Gangtok', lat: 27.3389, lng: 88.6065 };
const DROP = { name: 'Deorali', lat: 27.3658, lng: 88.615 };

const CREDS = {
  rider: { email: 'rider@supertoto.local', password: 'Rider@Gangtok1' },
  driver: { email: 'driver@supertoto.local', password: 'Driver@Toto9' },
  admin: { email: 'admin@supertoto.local', password: 'Admin@Toto2k26' },
};

let child = null;
let port = -1;
let B = '';
const tokens = {};

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port;
      srv.close(() => resolve(p));
    });
    srv.on('error', reject);
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function healthReady(timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${B}/api/health`);
      if (r.ok) return true;
    } catch {}
    await wait(500);
  }
  return false;
}

async function api(method, p, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${B}/api${p}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

const login = async (who) => {
  const { status, data } = await api('POST', '/auth/login', CREDS[who]);
  assert.equal(status, 200, `login ${who} should succeed`);
  assert.ok(data.token, `login ${who} should return a token`);
  return data.token;
};

before(async () => {
  port = await freePort();
  B = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['src/index.js'], {
    cwd: SERVER_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, MONGODB_URI: '', PORT: String(port), NODE_ENV: 'test' },
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  assert.ok(await healthReady(), 'server did not become healthy in time');
  tokens.rider = await login('rider');
  tokens.driver = await login('driver');
  tokens.admin = await login('admin');
});

after(async () => {
  if (child) {
    try {
      child.kill('SIGTERM');
    } catch {}
  }
});

// ---------------------------------------------------------------- estimate
test('estimate defaults to the operator seat mode (shared)', async () => {
  const { status, data } = await api('POST', '/rides/estimate', {
    pickup: PICKUP, drop: DROP, seats: 1, vehicleType: 'toto',
  }, tokens.rider);
  assert.equal(status, 200);
  assert.equal(data.seatMode, 'shared');
  assert.equal(data.reserved, false);
  assert.equal(data.seatsEnabled, true);
  assert.ok(data.fare?.total > 0);
});

test('estimate reserved books the whole vehicle at the full trip fare', async () => {
  const { status, data } = await api('POST', '/rides/estimate', {
    pickup: PICKUP, drop: DROP, seats: 1, vehicleType: 'toto', mode: 'reserved',
  }, tokens.rider);
  assert.equal(status, 200);
  assert.equal(data.seatMode, 'reserved');
  assert.equal(data.reserved, true);
  assert.equal(data.seats, data.seatCount);
  assert.equal(data.availableSeats, 0);
  assert.equal(data.riderTotal, data.fare.total);
});

test('estimate shared prices per seat and leaves seats available', async () => {
  const { status, data } = await api('POST', '/rides/estimate', {
    pickup: PICKUP, drop: DROP, seats: 2, vehicleType: 'toto', mode: 'shared',
  }, tokens.rider);
  assert.equal(status, 200);
  assert.equal(data.seatMode, 'shared');
  assert.equal(data.reserved, false);
  assert.equal(data.seats, 2);
  assert.equal(data.riderTotal, data.perSeatFare * 2);
  assert.ok(data.riderTotal < data.fare.total);
  assert.equal(data.availableSeats, data.seatCount - 2);
});

test('estimate ignores an unknown mode and falls back to the default', async () => {
  const { status, data } = await api('POST', '/rides/estimate', {
    pickup: PICKUP, drop: DROP, seats: 1, vehicleType: 'toto', mode: 'hacker',
  }, tokens.rider);
  assert.equal(status, 200);
  assert.equal(data.seatMode, 'shared');
});

test('promo code discounts the estimate', async () => {
  const { status, data } = await api('POST', '/rides/estimate', {
    pickup: PICKUP, drop: DROP, seats: 1, vehicleType: 'toto', mode: 'reserved', promo: 'WELCOME10',
  }, tokens.rider);
  assert.equal(status, 200);
  assert.ok(data.promoDiscount > 0);
  assert.equal(data.riderTotal, data.riderTotalBeforePromo - data.promoDiscount);
});

test('estimate rejects trips outside the allowed distance range', async () => {
  const { status, data } = await api('POST', '/rides/estimate', {
    pickup: PICKUP, drop: { ...PICKUP, name: 'Same spot' }, seats: 1, vehicleType: 'toto',
  }, tokens.rider);
  assert.equal(status, 200);
  assert.equal(data.fare, null);
  assert.match(data.distanceError || '', /Minimum ride distance/);
});

// ------------------------------------------------------------ booking modes
test('book reserved creates a whole-vehicle ride and can be cancelled', async () => {
  const { status, data } = await api('POST', '/rides', {
    pickup: PICKUP, drop: DROP, seats: 1, vehicleType: 'toto', mode: 'reserved',
  }, tokens.rider);
  assert.equal(status, 201);
  const ride = data.ride;
  assert.equal(ride.status, 'requested');
  assert.equal(ride.shared.reserved, true);
  assert.equal(ride.shared.mode, 'reserved');
  assert.equal(ride.shared.seatsTaken, ride.shared.seatCount);
  assert.equal(ride.fare, ride.fareBreakup.total);
  assert.equal(ride.passengers.totalPassengers, ride.shared.seatCount);
  const c = await api('POST', `/rides/${ride._id}/cancel`, {}, tokens.rider);
  assert.equal(c.status, 200);
});

test('book shared prices only the booked seats', async () => {
  const { status, data } = await api('POST', '/rides', {
    pickup: PICKUP, drop: DROP, seats: 2, vehicleType: 'toto', mode: 'shared',
  }, tokens.rider);
  assert.equal(status, 201);
  const ride = data.ride;
  assert.equal(ride.shared.reserved, false);
  assert.equal(ride.shared.mode, 'shared');
  assert.equal(ride.shared.seatsTaken, 2);
  assert.equal(ride.shared.availableSeats, ride.shared.seatCount - 2);
  assert.equal(ride.fare, ride.shared.perSeatFare * 2);
  assert.equal(ride.occupants[0].seats, 2);
  await api('POST', `/rides/${ride._id}/cancel`, {}, tokens.rider);
});

test('a rider cannot hold two active rides', async () => {
  const first = await api('POST', '/rides', {
    pickup: PICKUP, drop: DROP, seats: 1, vehicleType: 'toto',
  }, tokens.rider);
  assert.equal(first.status, 201);
  const second = await api('POST', '/rides', {
    pickup: PICKUP, drop: DROP, seats: 1, vehicleType: 'toto',
  }, tokens.rider);
  assert.equal(second.status, 409);
  await api('POST', `/rides/${first.data.ride._id}/cancel`, {}, tokens.rider);
});

test('reserve endpoint holds a ride until unreserved', async () => {
  const { status, data } = await api('POST', '/rides/reserve', {
    pickup: PICKUP, drop: DROP, seats: 1, vehicleType: 'toto', mode: 'shared',
  }, tokens.rider);
  assert.equal(status, 201);
  const ride = data.ride;
  assert.equal(ride.status, 'reserved');
  assert.equal(ride.shared.reserved, false);
  const ur = await api('POST', `/rides/${ride._id}/unreserve`, {}, tokens.rider);
  assert.equal(ur.status, 200);
  assert.equal(ur.data.message, 'Reservation cancelled');
});

test('reserve whole-vehicle flow: reserved then unreserved', async () => {
  const { status, data } = await api('POST', '/rides/reserve', {
    pickup: PICKUP, drop: DROP, seats: 1, vehicleType: 'toto', mode: 'reserved',
  }, tokens.rider);
  assert.equal(status, 201);
  const ride = data.ride;
  assert.equal(ride.shared.reserved, true);
  assert.equal(ride.status, 'reserved');
  const ur = await api('POST', `/rides/${ride._id}/unreserve`, {}, tokens.rider);
  assert.equal(ur.status, 200);
});

// -------------------------------------------------- saved places + promo book
test('rider saved places CRUD', async () => {
  const created = await api('POST', '/rider/places', {
    name: 'Test Place', lat: 27.33, lng: 88.61,
  }, tokens.rider);
  assert.equal(created.status, 201);
  const id = created.data.place?._id || created.data._id;
  const list = await api('GET', '/rider/places', null, tokens.rider);
  assert.equal(list.status, 200);
  assert.ok(list.data.places?.some((p) => String(p._id) === String(id)), 'saved place is listed');
  const del = await api('DELETE', `/rider/places/${id}`, null, tokens.rider);
  assert.equal(del.status, 200);
});

test('promo code is recorded on the ride at booking time', async () => {
  const { status, data } = await api('POST', '/rides', {
    pickup: PICKUP, drop: DROP, seats: 1, vehicleType: 'toto', promo: 'WELCOME10',
  }, tokens.rider);
  assert.equal(status, 201);
  const ride = data.ride;
  assert.ok(ride.fareBreakup.promoDiscount > 0);
  assert.equal(ride.promo.code, 'WELCOME10');
  assert.equal(ride.fareBreakup.promoDiscount, ride.promo.discount);
  await api('POST', `/rides/${ride._id}/cancel`, {}, tokens.rider);
});

test('promo usage is limited per user', async () => {
  // A promo with perUserLimit=1: the first redemption succeeds, the next booking
  // with the same code must be rejected. Deterministic regardless of other tests.
  const created = await api('POST', '/admin/promos', {
    code: 'TEST10', type: 'pct', value: 10, maxDiscount: 30, minFare: 0,
    description: 'test promo', active: true, perUserLimit: 1,
  }, tokens.admin);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const promoId = created.data.promo._id;

  const bookRide = async () =>
    api('POST', '/rides', {
      pickup: PICKUP, drop: DROP, seats: 1, vehicleType: 'toto', promo: 'TEST10',
    }, tokens.rider);

  const first = await bookRide();
  assert.equal(first.status, 201, JSON.stringify(first.data));
  assert.equal(first.data.ride.promo.code, 'TEST10');
  await api('POST', `/rides/${first.data.ride._id}/cancel`, {}, tokens.rider);

  const second = await bookRide();
  assert.equal(second.status, 400, JSON.stringify(second.data));
  assert.match(second.data.message || '', /promo/i);

  await api('DELETE', `/admin/promos/${promoId}`, null, tokens.admin);
});

// ------------------------------------------------------------ end-to-end ride
test('full ride lifecycle: book -> accept -> share+sos -> verify-face gate -> start -> complete -> wallet pay -> rate', async () => {
  // book
  const book = await api('POST', '/rides', {
    pickup: PICKUP, drop: DROP, seats: 1, vehicleType: 'toto',
  }, tokens.rider);
  assert.equal(book.status, 201);
  const ride = book.data.ride;
  const rid = ride._id;

  // driver accepts the ride (status -> assigned)
  const accept = await api('POST', `/driver/accept/${rid}`, {}, tokens.driver);
  assert.equal(accept.status, 200, JSON.stringify(accept.data));
  assert.equal(accept.data.ride.status, 'assigned');

  // share a live-tracking link (only valid once assigned)
  const share = await api('POST', `/rides/${rid}/share`, { enabled: true }, tokens.rider);
  assert.equal(share.status, 200, JSON.stringify(share.data));
  assert.ok(share.data.token);

  // raise SOS during the trip
  const sos = await api('POST', `/rides/${rid}/sos`, { message: 'test' }, tokens.rider);
  assert.equal(sos.status, 201);

  // face-verify gate: seed driver has no enrolled face -> 409
  const dimension = new Array(128).fill(0.01);
  const face = await api('POST', `/driver/verify-face/${rid}`, { descriptor: dimension }, tokens.driver);
  assert.equal(face.status, 409);

  // start (seed driver not face-enabled -> start succeeds without a selfie)
  const start = await api('POST', `/driver/start/${rid}`, {}, tokens.driver);
  assert.equal(start.status, 200, JSON.stringify(start.data));
  assert.equal(start.data.ride.status, 'in_progress');

  // wallet top-up then pay by wallet on completion
  const recharge = await api('POST', '/rider/wallet/recharge', { amount: 500 }, tokens.rider);
  assert.equal(recharge.status, 200);
  assert.equal(recharge.data.balance ?? recharge.data.wallet?.balance, 500);

  const complete = await api('POST', `/driver/complete/${rid}`, {}, tokens.driver);
  assert.equal(complete.status, 200);
  assert.equal(complete.data.ride.status, 'completed');

  const pay = await api('POST', `/rides/${rid}/pay`, { method: 'Wallet' }, tokens.rider);
  assert.equal(pay.status, 200, JSON.stringify(pay.data));
  assert.equal(pay.data.ride.payment.status, 'paid');

  const afterPay = await api('GET', '/rider/wallet', null, tokens.rider);
  assert.equal(afterPay.data.balance, 500 - ride.fare);
  const ledger = afterPay.data.transactions || [];
  assert.ok(ledger.some((tx) => tx.type === 'payment'), 'wallet ledger has a payment entry');

  // rate the completed ride
  const rate = await api('POST', `/rides/${rid}/rate`, { rating: 5, ratedRole: 'driver', review: 'Great ride' }, tokens.rider);
  assert.equal(rate.status, 200);
});

// ------------------------------------------------------------ face registration
test('face register rejects a malformed descriptor', async () => {
  const { status } = await api('POST', '/face/register', { descriptor: [1, 2, 3] }, tokens.rider);
  assert.equal(status, 400);
});

// ------------------------------------------------------------ auth + admin
test('auth: /me returns the authenticated user', async () => {
  const me = await api('GET', '/auth/me', null, tokens.rider);
  assert.equal(me.status, 200);
  assert.equal(me.data.user.email, CREDS.rider.email);
});

test('admin stats and promos endpoints respond', async () => {
  const stats = await api('GET', '/admin/stats', null, tokens.admin);
  assert.equal(stats.status, 200);
  assert.ok(typeof stats.data === 'object' && stats.data !== null);
  const promos = await api('GET', '/admin/promos', null, tokens.admin);
  assert.equal(promos.status, 200);
  assert.ok(promos.data.promos?.some((p) => p.code === 'WELCOME10'), 'WELCOME10 promo is seeded');
});