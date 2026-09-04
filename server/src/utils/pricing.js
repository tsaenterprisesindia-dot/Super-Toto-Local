export const VEHICLE_TYPES = [
  { id: 'toto', label: 'Toto (E-Rickshaw)', defaultRates: { base: 30, perKm: 14, perMin: 1.5, minimum: 40, avgSpeedKmh: 30, minutesPerKm: 2, seatCount: 4 } },
  { id: 'auto', label: 'Auto Rickshaw', defaultRates: { base: 40, perKm: 18, perMin: 2, minimum: 50, avgSpeedKmh: 25, minutesPerKm: 2.4, seatCount: 3 } },
  { id: 'taxi', label: 'Taxi', defaultRates: { base: 60, perKm: 22, perMin: 2.5, minimum: 70, avgSpeedKmh: 35, minutesPerKm: 1.7, seatCount: 4 } },
  { id: 'bike', label: 'Bike Taxi', defaultRates: { base: 20, perKm: 10, perMin: 1, minimum: 25, avgSpeedKmh: 40, minutesPerKm: 1.5, seatCount: 1 } },
];

export function getVehicleRates(stored = {}) {
  const rates = {};
  for (const vt of VEHICLE_TYPES) {
    const merged = { ...vt.defaultRates, ...(stored[vt.id] || {}) };
    // If minutesPerKm was set by admin, derive avgSpeedKmh from it
    if (merged.minutesPerKm && merged.minutesPerKm > 0) {
      merged.avgSpeedKmh = Math.round((60 / merged.minutesPerKm) * 10) / 10;
    }
    rates[vt.id] = merged;
  }
  return rates;
}

export const PRICING = {
  base: 30, // INR per charged passenger
  perKm: 14,
  perMin: 1.5,
  minimum: 40,
  avgSpeedKmh: 30, // 1 km = 2 minutes (base rule)
  searchRadiusKm: 6,
  minRideDistanceKm: 0.5,
  maxRideDistanceKm: 100,
  surgeFloor: 1.0,
  surgeCeil: 1.6,
  dispatchTimeoutSec: 25,
  freeChildCount: 2,        // children under 7 ride free (up to this many)
  freeLuggageItems: 1,
  freeLuggageWeightKg: 5,
  extraLuggageFee: 10,
  heavyLuggageFee: 20,
  heavyLuggageWeightKg: 10,
  gstRate: 0.05,
  commissionRate: 0.15,
  cancellationFee: 20,
};

// ---- Face recognition helpers ----
// face-api.js descriptors are 128-dim. We L2-normalize defensively (the model
// already returns unit vectors) and verify using Euclidean distance, the
// canonical metric for face-api.js. FACE_MATCH_THRESHOLD is the max distance
// to accept as a genuine match (default 0.6).
export function normalize(vec = []) {
  const len = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / len);
}

export function faceDistance(a = [], b = []) {
  if (!a || !b || a.length !== b.length || a.length === 0) return Infinity;
  const na = normalize(a);
  const nb = normalize(b);
  let sum = 0;
  for (let i = 0; i < na.length; i++) sum += (na[i] - nb[i]) ** 2;
  return Math.sqrt(sum);
}

export function FACE_THRESHOLD() {
  return Number(process.env.FACE_MATCH_THRESHOLD || 0.6);
}

export function faceMatch(stored, probe) {
  const distance = faceDistance(stored, probe);
  return { distance, matched: distance <= FACE_THRESHOLD() };
}

export function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return 0;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function estimate(distanceKm, cfg = PRICING) {
  const durationMin = (distanceKm / cfg.avgSpeedKmh) * 60;
  return { distanceKm, durationMin: Math.max(2, Math.round(durationMin)) };
}

export function computeSurge(activeRequests, onlineDrivers, cfg = PRICING) {
  const online = Math.max(onlineDrivers, 1);
  const ratio = activeRequests / online;
  // No surge while supply comfortably covers demand (ratio <= 0.6).
  // Otherwise scale linearly from 1.0 up to the surge ceiling.
  const surge =
    ratio <= 0.6
      ? 1.0
      : Math.min(cfg.surgeCeil, 1 + (ratio - 0.6) * 0.5);
  return Math.round(surge * 100) / 100;
}

export function computeLuggageCharge(luggageCount, luggageHeavyCount, cfg = PRICING) {
  const free = cfg.freeLuggageItems || 0;
  const extraItems = Math.max(0, luggageCount - free);
  const extraCharge = extraItems * (cfg.extraLuggageFee || 0);
  const heavyCharge = (luggageHeavyCount || 0) * (cfg.heavyLuggageFee || 0);
  return extraCharge + heavyCharge;
}

export function computePassengers(adults, children, cfg = PRICING) {
  const a = Math.max(1, Math.min(6, Number(adults) || 1));
  const c = Math.max(0, Math.min(5, Number(children) || 0));
  const freeChildLimit = cfg.freeChildCount || 2;
  const freeChildren = Math.min(c, freeChildLimit);
  const paidChildren = Math.max(0, c - freeChildLimit);
  const totalPassengers = a + c;
  const chargedPassengers = a + paidChildren;
  return { adults: a, children: c, freeChildren, paidChildren, totalPassengers, chargedPassengers };
}

// Determine whether a trip is intra-state or inter-state for GST.
// Compare the operator's registered state (cfg.gstState) with the trip's state
// (cfg.tripState). Accepts either state NAME ("Delhi") or CODE ("DL") so the two
// sides are matched after normalising to codes.
const STATE_ALIAS = {
  AP: 'ANDHRA PRADESH', AR: 'ARUNACHAL PRADESH', AS: 'ASSAM', BR: 'BIHAR', CG: 'CHHATTISGARH',
  GA: 'GOA', GJ: 'GUJARAT', HR: 'HARYANA', HP: 'HIMACHAL PRADESH', JH: 'JHARKHAND', KA: 'KARNATAKA',
  KL: 'KERALA', MP: 'MADHYA PRADESH', MH: 'MAHARASHTRA', MN: 'MANIPUR', ML: 'MEGHALAYA', MZ: 'MIZORAM',
  NL: 'NAGALAND', OD: 'ODISHA', PB: 'PUNJAB', RJ: 'RAJASTHAN', SK: 'SIKKIM', TN: 'TAMIL NADU',
  TS: 'TELANGANA', TR: 'TRIPURA', UP: 'UTTAR PRADESH', UK: 'UTTARAKHAND', WB: 'WEST BENGAL',
  AN: 'ANDAMAN & NICOBAR', CH: 'CHANDIGARH', DD: 'DNH & DAMAN-DIU', DL: 'DELHI', JK: 'JAMMU & KASHMIR',
  LA: 'LADAKH', LD: 'LAKSHADWEEP', PY: 'PUDUCHERRY',
};
function stateCode(v) {
  const s = String(v || '').trim().toUpperCase();
  if (!s) return '';
  if (STATE_ALIAS[s]) return s; // already a code
  const hit = Object.entries(STATE_ALIAS).find(([, name]) => name === s);
  return hit ? hit[0] : '';
}
export function isIntraState(cfg = PRICING) {
  const op = stateCode(cfg.gstState);
  const trip = stateCode(cfg.tripState);
  // Unknown trip state defaults to intra-state (conservative same-state assumption).
  return !op || !trip || op === trip;
}

export function computeFare(distanceKm, durationMin, surge = 1, cfg = PRICING, luggageCharge = 0, chargedPassengers = 1) {
  const base = Math.round(cfg.base * Math.max(1, chargedPassengers));
  const distance = Math.round(distanceKm * cfg.perKm);
  const time = Math.round(durationMin * cfg.perMin);
  const luggage = luggageCharge;
  const raw = base + distance + time + luggage;
  const subtotal = Math.max(raw, cfg.minimum); // fare before surge & tax
  const gross = Math.round(subtotal * surge); // what the fare earns pre-tax
  // Automatic GST (5%) split: CGST 2.5% + SGST 2.5% (intra-state) or IGST 5% (inter-state).
  const gstRate = cfg.gstRate || 0.05;
  const gst = Math.round(gross * gstRate); // GST paid by the rider
  const intra = isIntraState(cfg);
  const cgst = intra ? Math.round(gst / 2) : 0;
  const sgst = intra ? gst - cgst : 0; // intra-state remainder
  const igst = intra ? 0 : gst; // inter-state
  const commission = Math.round(gross * cfg.commissionRate); // platform cut
  const driverEarnings = gross - commission; // what the driver keeps
  const total = gross + gst; // what the rider is charged (incl. GST)
  return {
    base,
    distance,
    time,
    luggage,
    feedbackDiscount: 0,
    surge,
    subtotal,
    gross,
    gst,
    cgst,
    sgst,
    igst,
    gstRatePct: Math.round(gstRate * 100 * 100) / 100,
    supplyType: intra ? 'intra' : 'inter',
    commission,
    driverEarnings,
    total,
    chargedPassengers,
  };
}

// Shared / seat-booking fare: the whole vehicle costs the normal 1-passenger
// fare; every seat shares it equally. Returns the trip fare (whole vehicle)
// and the per-seat price so a rider pays only for the seats they book.
export function computeSharedFare(distanceKm, durationMin, surge = 1, cfg = PRICING, luggageCharge = 0, seatCount = 1) {
  const capacity = Math.max(1, Math.round(Number(seatCount) || 1));
  const tripFare = computeFare(distanceKm, durationMin, surge, cfg, luggageCharge, 1);
  const perSeatFare = Math.max(1, Math.round(tripFare.total / capacity));
  return { tripFare, perSeatFare, seatCount: capacity };
}
