import Settings from '../models/Settings.js';
import { PRICING, getVehicleRates } from '../utils/pricing.js';

// ─── State-wise Fare Policies (GoI / State transport dept fare rules) ─────────

export const INDIA_STATES = [
  { code: 'AP', name: 'Andhra Pradesh', ut: false },
  { code: 'AR', name: 'Arunachal Pradesh', ut: false },
  { code: 'AS', name: 'Assam', ut: false },
  { code: 'BR', name: 'Bihar', ut: false },
  { code: 'CG', name: 'Chhattisgarh', ut: false },
  { code: 'GA', name: 'Goa', ut: false },
  { code: 'GJ', name: 'Gujarat', ut: false },
  { code: 'HR', name: 'Haryana', ut: false },
  { code: 'HP', name: 'Himachal Pradesh', ut: false },
  { code: 'JH', name: 'Jharkhand', ut: false },
  { code: 'KA', name: 'Karnataka', ut: false },
  { code: 'KL', name: 'Kerala', ut: false },
  { code: 'MP', name: 'Madhya Pradesh', ut: false },
  { code: 'MH', name: 'Maharashtra', ut: false },
  { code: 'MN', name: 'Manipur', ut: false },
  { code: 'ML', name: 'Meghalaya', ut: false },
  { code: 'MZ', name: 'Mizoram', ut: false },
  { code: 'NL', name: 'Nagaland', ut: false },
  { code: 'OD', name: 'Odisha', ut: false },
  { code: 'PB', name: 'Punjab', ut: false },
  { code: 'RJ', name: 'Rajasthan', ut: false },
  { code: 'SK', name: 'Sikkim', ut: false },
  { code: 'TN', name: 'Tamil Nadu', ut: false },
  { code: 'TS', name: 'Telangana', ut: false },
  { code: 'TR', name: 'Tripura', ut: false },
  { code: 'UP', name: 'Uttar Pradesh', ut: false },
  { code: 'UK', name: 'Uttarakhand', ut: false },
  { code: 'WB', name: 'West Bengal', ut: false },
  { code: 'AN', name: 'Andaman & Nicobar', ut: true },
  { code: 'CH', name: 'Chandigarh', ut: true },
  { code: 'DD', name: 'DNH & Daman-Diu', ut: true },
  { code: 'DL', name: 'Delhi', ut: true },
  { code: 'JK', name: 'Jammu & Kashmir', ut: true },
  { code: 'LA', name: 'Ladakh', ut: true },
  { code: 'LD', name: 'Lakshadweep', ut: true },
  { code: 'PY', name: 'Puducherry', ut: true },
];

export const stateName = (code) => INDIA_STATES.find((s) => s.code === code)?.name || code || 'National';

// ─── Geo → State resolution (self-contained, no external API) ────────────────
// A compact lat/lng → Indian state/UT lookup using bounding boxes. Because state
// borders are irregular, boxes can overlap near boundaries; the resolver returns
// the single most specific match (smallest area) containing the point, which for
// ordinary in-state ride pickups is correct. This is a fare-zone convenience on
// top of the rider-selected state (which the server still cross-checks), not a
// survey-grade boundary engine.
const STATE_BOXES = [
  // [code, minLat, minLng, maxLat, maxLng]
  ['AP', 12.6, 76.7, 19.7, 84.8],
  ['AR', 26.6, 91.5, 29.5, 97.4],
  ['AS', 24.0, 89.6, 28.0, 96.0],
  ['BR', 24.0, 83.3, 27.5, 88.2],
  ['CG', 17.8, 80.2, 23.9, 84.3],
  ['GA', 14.8, 73.7, 15.9, 74.3],
  ['GJ', 20.0, 68.1, 24.7, 74.5],
  ['HR', 27.6, 74.4, 30.9, 77.0],
  ['HP', 30.3, 75.7, 33.3, 79.1],
  ['JH', 21.9, 83.3, 25.4, 87.9],
  ['KA', 11.5, 74.0, 18.5, 78.5],
  ['KL', 8.1, 74.8, 12.8, 77.4],
  ['MP', 21.0, 74.0, 26.9, 82.5],
  ['MH', 15.6, 72.6, 22.0, 80.9],
  ['MN', 23.8, 92.9, 25.7, 94.7],
  ['ML', 25.0, 89.8, 26.2, 92.8],
  ['MZ', 21.9, 92.2, 24.5, 93.5],
  ['NL', 25.2, 93.2, 27.1, 95.2],
  ['OD', 17.7, 81.4, 22.6, 87.5],
  ['PB', 29.5, 73.8, 32.6, 76.9],
  ['RJ', 23.0, 69.3, 30.2, 78.3],
  ['SK', 27.0, 88.0, 28.2, 88.9],
  ['TN', 8.0, 76.2, 13.6, 80.4],
  ['TS', 15.4, 77.0, 19.9, 81.4],
  ['TR', 22.8, 90.9, 24.6, 92.4],
  ['UP', 23.8, 77.0, 30.4, 84.6],
  ['UK', 28.7, 77.5, 31.5, 81.0],
  ['WB', 21.5, 85.8, 27.1, 89.1],
  ['AN', 6.7, 92.1, 13.7, 93.9],
  ['CH', 30.6, 76.7, 30.8, 76.9],
  ['DD', 20.1, 72.7, 20.4, 73.1],
  ['DL', 28.4, 76.8, 28.9, 77.3],
  ['JK', 32.2, 73.7, 35.5, 80.3],
  ['LA', 29.7, 75.0, 35.5, 79.6],
  ['LD', 8.1, 72.5, 11.8, 73.9],
  ['PY', 11.6, 79.7, 12.0, 79.9],
];

// Smallest-area, most specific box wins so border overlaps resolve deterministically.
export function stateForCoords({ lat, lng } = {}) {
  if (lat == null || lng == null) return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  let best = null;
  let bestArea = Infinity;
  for (const [code, minLat, minLng, maxLat, maxLng] of STATE_BOXES) {
    if (la >= minLat && la <= maxLat && ln >= minLng && ln <= maxLng) {
      const area = (maxLat - minLat) * (maxLng - minLng);
      if (area < bestArea) {
        bestArea = area;
        best = code;
      }
    }
  }
  return best || null;
}

export const STATE_DEFAULT_POLICY = {
  status: 'draft', // draft | active | archived
  effectiveFrom: '',
  effectiveUntil: '',
  sourceLabel: '',
  sourceUrl: '',
  surgeCap: null, // null = use the global compliance surge cap
  cancellationFee: null, // null = use the global cancellation fee
  notes: '',
  vehicleRates: {}, // per-vehicle overrides over the national defaults
  lastUpdatedBy: '',
  lastUpdatedAt: '',
};

export async function getStateFares() {
  const doc = await Settings.findOne();
  return doc?.stateFares || {};
}

export async function getStateFarePolicy(stateCode, { activeOnly = true } = {}) {
  if (!stateCode) return null;
  const all = await getStateFares();
  const p = all[String(stateCode).trim().toUpperCase()];
  if (!p || typeof p !== 'object') return null;
  if (activeOnly && p.status !== 'active') return null;
  return { ...STATE_DEFAULT_POLICY, ...p, vehicleRates: { ...(p.vehicleRates || {}) } };
}

const RATE_KEYS = ['base', 'perKm', 'perMin', 'minimum', 'seatCount'];

export async function saveStateFarePolicy(stateCode, input = {}, adminEmail = '') {
  const code = String(stateCode || '').trim().toUpperCase();
  if (!code) return null;
  const doc = (await Settings.findOne()) || new Settings();
  const fares = { ...(doc.stateFares || {}) };
  const prev = { ...STATE_DEFAULT_POLICY, ...(fares[code] || {}) };

  const vehicleRates = {};
  if (input.vehicleRates && typeof input.vehicleRates === 'object') {
    for (const [vtId, r] of Object.entries(input.vehicleRates)) {
      if (typeof r !== 'object' || r === null) continue;
      vehicleRates[vtId] = {};
      for (const key of RATE_KEYS) {
        if (r[key] === undefined || r[key] === null || r[key] === '') continue;
        const v = key === 'seatCount' ? Math.round(Number(r[key])) : Number(r[key]);
        if (Number.isFinite(v) && v > 0) vehicleRates[vtId][key] = Math.round(v * 100) / 100;
      }
    }
  }

  let surgeCap = prev.surgeCap;
  if (input.surgeCap === '') surgeCap = null;
  else if (input.surgeCap !== undefined && input.surgeCap !== null) surgeCap = Math.min(Math.max(Number(input.surgeCap) || 1, 1), 4);

  let cancellationFee = prev.cancellationFee;
  if (input.cancellationFee === '') cancellationFee = null;
  else if (input.cancellationFee !== undefined && input.cancellationFee !== null) cancellationFee = Math.max(Number(input.cancellationFee) || 0, 0);

  const status = ['draft', 'active', 'archived'].includes(input.status) ? input.status : prev.status;
  const policy = {
    ...prev,
    status,
    effectiveFrom: input.effectiveFrom || prev.effectiveFrom || '',
    effectiveUntil: input.effectiveUntil || prev.effectiveUntil || '',
    sourceLabel: typeof input.sourceLabel === 'string' ? input.sourceLabel.trim() : prev.sourceLabel,
    sourceUrl: typeof input.sourceUrl === 'string' ? input.sourceUrl.trim() : prev.sourceUrl,
    notes: typeof input.notes === 'string' ? input.notes.trim() : prev.notes,
    surgeCap,
    cancellationFee,
    vehicleRates,
    lastUpdatedBy: adminEmail || prev.lastUpdatedBy,
    lastUpdatedAt: new Date().toISOString(),
  };
  fares[code] = policy;
  doc.stateFares = fares;
  await doc.save();
  return policy;
}

// Full per-vehicle rate set for a state: national defaults merged with the state
// policy overrides. Returns null when there is no active policy for the state.
export async function resolveFarePolicy(stateCode) {
  const policy = await getStateFarePolicy(stateCode);
  if (!policy) return null;
  const vehicleRates = getVehicleRates(policy.vehicleRates || {});
  return {
    policy,
    vehicleRates,
    stateCode: String(stateCode).trim().toUpperCase(),
    stateName: stateName(String(stateCode).trim().toUpperCase()),
    surgeCap: policy.surgeCap,
    cancellationFee: policy.cancellationFee,
  };
}

// Ensures every Indian state/UT has an explicit (active) fare-policy record so no
// state silently falls back to national defaults without an audit trail. Uses the
// compiled national per-vehicle rates as the baseline; existing state records are
// never overwritten. Records are labelled as framework defaults — an operator must
// verify them against the state transport dept's notified fare order before a
// public release.
export async function seedStateFareDefaults() {
  const doc = (await Settings.findOne()) || new Settings();
  const fares = { ...(doc.stateFares || {}) };
  const nationalRates = await getVehicleRatesConfig();
  const now = new Date().toISOString();
  let changed = false;
  for (const s of INDIA_STATES) {
    const existing = fares[s.code];
    if (existing && typeof existing === 'object') continue;
    const vehicleRates = {};
    for (const [vtId, r] of Object.entries(nationalRates)) {
      if (typeof r !== 'object' || r === null) continue;
      vehicleRates[vtId] = {};
      for (const key of RATE_KEYS) {
        if (r[key] !== undefined && r[key] !== null && Number.isFinite(r[key]) && Number(r[key]) > 0) {
          vehicleRates[vtId][key] = Math.round(Number(r[key]) * 100) / 100;
        }
      }
    }
    fares[s.code] = {
      ...STATE_DEFAULT_POLICY,
      status: 'active',
      effectiveFrom: now.slice(0, 10),
      sourceLabel: 'Framework default — verify against state notified fare order',
      sourceUrl: '',
      notes: 'Auto-initialised framework default. Replace with the state transport dept\u2019s notified rates before a public listing.',
      vehicleRates,
      lastUpdatedBy: 'system',
      lastUpdatedAt: now,
    };
    changed = true;
  }
  if (changed) {
    doc.stateFares = fares;
    await doc.save();
  }
  return Object.keys(fares).length;
}

// Merges stored (admin-editable) pricing values over the compiled defaults.
export async function getPricingConfig() {
  const doc = await Settings.findOne();
  const stored = doc?.pricing || {};
  const cfg = { ...PRICING };
  for (const key of Object.keys(stored)) {
    const value = stored[key];
    if (key in cfg && typeof value === 'number' && Number.isFinite(value)) {
      cfg[key] = value;
    }
  }
  return cfg;
}

// Returns per-vehicle-type rates (merged over defaults).
export async function getVehicleRatesConfig() {
  const doc = await Settings.findOne();
  return getVehicleRates(doc?.vehicleRates || {});
}

// Saves per-vehicle-type rates.
export async function saveVehicleRatesConfig(input = {}) {
  const doc = (await Settings.findOne()) || new Settings();
  const clean = {};
  for (const [vtId, rates] of Object.entries(input)) {
    if (typeof rates !== 'object' || rates === null) continue;
    clean[vtId] = {};
    for (const key of ['base', 'perKm', 'perMin', 'minimum', 'avgSpeedKmh', 'minutesPerKm', 'seatCount']) {
      const v = Number(rates[key]);
      if (Number.isFinite(v) && v > 0) clean[vtId][key] = Math.round(v * 100) / 100;
    }
  }
  doc.vehicleRates = clean;
  await doc.save();
  return getVehicleRates(clean);
}

export const FEEDBACK_DEFAULTS = {
  enabled: true,
  discountAmount: 10,
  requireDriverFeedback: true,
  requireDistanceFeedback: true,
  requireTimeFeedback: true,
  driverFeedbackLabel: 'How was the driver?',
  driverFeedbackPlaceholder: 'Driver behaviour, driving skills, politeness…',
  distanceFeedbackLabel: 'Was the travel distance accurate?',
  distanceFeedbackPlaceholder: 'Was the route taken accurate and shortest?',
  timeFeedbackLabel: 'Was the travel time reasonable?',
  timeFeedbackPlaceholder: 'Was the estimated time accurate?',
  successMessage: 'Thanks for your review!',
  discountMessage: 'Thanks for your review! ₹{amount} discount applied.',
};

// Returns the feedback configuration (merged over defaults).
export async function getFeedbackConfig() {
  const doc = await Settings.findOne();
  const stored = doc?.feedbackConfig || {};
  return { ...FEEDBACK_DEFAULTS, ...stored };
}

// Saves feedback configuration.
export async function saveFeedbackConfig(input = {}) {
  const doc = (await Settings.findOne()) || new Settings();
  const clean = {};
  // Boolean fields
  for (const key of ['enabled', 'requireDriverFeedback', 'requireDistanceFeedback', 'requireTimeFeedback']) {
    if (input[key] !== undefined) clean[key] = input[key] === true || input[key] === 'true';
  }
  // Number fields
  for (const key of ['discountAmount']) {
    const v = Number(input[key]);
    if (Number.isFinite(v) && v >= 0) clean[key] = v;
  }
  // String fields
  for (const key of [
    'driverFeedbackLabel', 'driverFeedbackPlaceholder',
    'distanceFeedbackLabel', 'distanceFeedbackPlaceholder',
    'timeFeedbackLabel', 'timeFeedbackPlaceholder',
    'successMessage', 'discountMessage',
  ]) {
    if (typeof input[key] === 'string') clean[key] = input[key];
  }
  doc.feedbackConfig = clean;
  await doc.save();
  return { ...FEEDBACK_DEFAULTS, ...clean };
}

// Validates and persists pricing overrides. Returns the merged config.
export async function savePricingConfig(input = {}) {
  const doc = (await Settings.findOne()) || new Settings();
  const clean = {};
  for (const key of Object.keys(PRICING)) {
    if (input[key] === undefined || input[key] === null || input[key] === '') continue;
    const value = Number(input[key]);
    if (!Number.isFinite(value) || value < 0) continue;
    clean[key] = value;
  }
  doc.pricing = clean;
  await doc.save();
  return { ...PRICING, ...clean };
}

export const ADS_DEFAULTS = {
  enabled: true,
  bannerEnabled: true,
  interstitialEnabled: true,
  interstitialFrequency: 3,
  bannerPosition: 'bottom',
  ads: [],
};

export async function getAdsConfig() {
  const doc = await Settings.findOne();
  const stored = doc?.adsConfig || {};
  return { ...ADS_DEFAULTS, ...stored };
}

export async function saveAdsConfig(input = {}) {
  const doc = (await Settings.findOne()) || new Settings();
  const clean = { ...ADS_DEFAULTS };
  if (input.enabled !== undefined) clean.enabled = input.enabled === true || input.enabled === 'true';
  if (input.bannerEnabled !== undefined) clean.bannerEnabled = input.bannerEnabled === true || input.bannerEnabled === 'true';
  if (input.interstitialEnabled !== undefined) clean.interstitialEnabled = input.interstitialEnabled === true || input.interstitialEnabled === 'true';
  const freq = Number(input.interstitialFrequency);
  if (Number.isFinite(freq) && freq >= 1) clean.interstitialFrequency = freq;
  if (['top', 'bottom'].includes(input.bannerPosition)) clean.bannerPosition = input.bannerPosition;
  if (Array.isArray(input.ads)) {
    clean.ads = input.ads.filter(a => a && a.title && a.image).map(a => ({
      id: a.id || String(Date.now()) + Math.random().toString(36).slice(2, 6),
      title: String(a.title),
      subtitle: String(a.subtitle || ''),
      image: String(a.image),
      link: String(a.link || ''),
      enabled: a.enabled !== false,
      priority: Number(a.priority) || 0,
    }));
  }
  doc.adsConfig = clean;
  await doc.save();
  return { ...ADS_DEFAULTS, ...clean };
}

export const SAFETY_TIPS_DEFAULTS = {
  riderEnabled: true,
  driverEnabled: true,
  riderTips: [
    { id: 'r1', icon: '🔍', title: 'Verify Driver Identity', text: 'Always check the driver\'s name, photo, and vehicle details before boarding.', enabled: true },
    { id: 'r2', icon: '📱', title: 'Share Your Trip', text: 'Use the share trip feature to let a friend or family member track your ride in real time.', enabled: true },
    { id: 'r3', icon: '🪪', title: 'Check Vehicle Number', text: 'Match the vehicle number plate with the one shown in the app before getting in.', enabled: true },
    { id: 'r4', icon: '💰', title: 'Pay Through App', text: 'Prefer digital payments to avoid carrying large amounts of cash.', enabled: true },
    { id: 'r5', icon: '🚨', title: 'Use SOS Button', text: 'In case of emergency, use the SOS button to alert emergency contacts immediately.', enabled: true },
    { id: 'r6', icon: '🌙', title: 'Late Night Rides', text: 'Share your trip details with someone you trust when travelling late at night.', enabled: true },
    { id: 'r7', icon: '🚫', title: 'Don\'t Share Personal Info', text: 'Never share your home address, phone number, or personal details with the driver.', enabled: true },
    { id: 'r8', icon: '⭐', title: 'Rate Your Driver', text: 'Always rate your ride after completion — it helps us maintain quality service.', enabled: true },
  ],
  driverTips: [
    { id: 'd1', icon: '🪪', title: 'Keep Documents Ready', text: 'Always carry your driving license, RC, and insurance documents while on duty.', enabled: true },
    { id: 'd2', icon: '🛡️', title: 'Drive Safely', text: 'Follow all traffic rules. Your safety and the rider\'s safety come first.', enabled: true },
    { id: 'd3', icon: '📱', title: 'Stay Connected', text: 'Keep your phone charged and connected to the internet for ride notifications.', enabled: true },
    { id: 'd4', icon: '🚗', title: 'Vehicle Maintenance', text: 'Regularly check brakes, tyres, and battery. A well-maintained vehicle ensures rider trust.', enabled: true },
    { id: 'd5', icon: '💬', title: 'Be Polite', text: 'Greet riders politely and maintain professional behaviour throughout the trip.', enabled: true },
    { id: 'd6', icon: '🧭', title: 'Follow the Route', text: 'Take the shortest safe route. Avoid unnecessary deviations to build rider trust.', enabled: true },
    { id: 'd7', icon: '🚫', title: 'No Overloading', text: 'Never carry more passengers than the vehicle capacity allows.', enabled: true },
    { id: 'd8', icon: '🌙', title: 'Night Safety', text: 'Be extra cautious during night rides. Report any suspicious activity immediately.', enabled: true },
  ],
};

export async function getSafetyTipsConfig() {
  const doc = await Settings.findOne();
  const stored = doc?.safetyTipsConfig || {};
  const result = { ...SAFETY_TIPS_DEFAULTS, ...stored };
  if (!Array.isArray(result.riderTips)) result.riderTips = SAFETY_TIPS_DEFAULTS.riderTips;
  if (!Array.isArray(result.driverTips)) result.driverTips = SAFETY_TIPS_DEFAULTS.driverTips;
  return result;
}

export async function saveSafetyTipsConfig(input = {}) {
  const doc = (await Settings.findOne()) || new Settings();
  const clean = {};
  if (input.riderEnabled !== undefined) clean.riderEnabled = input.riderEnabled === true || input.riderEnabled === 'true';
  if (input.driverEnabled !== undefined) clean.driverEnabled = input.driverEnabled === true || input.driverEnabled === 'true';
  const cleanTip = (t) => ({
    id: t.id || String(Date.now()) + Math.random().toString(36).slice(2, 6),
    icon: String(t.icon || '📌'),
    title: String(t.title || ''),
    text: String(t.text || ''),
    enabled: t.enabled !== false,
  });
  if (Array.isArray(input.riderTips)) {
    clean.riderTips = input.riderTips.filter(t => t && t.title).map(cleanTip);
  }
  if (Array.isArray(input.driverTips)) {
    clean.driverTips = input.driverTips.filter(t => t && t.title).map(cleanTip);
  }
  doc.safetyTipsConfig = clean;
  await doc.save();
  const result = { ...SAFETY_TIPS_DEFAULTS, ...clean };
  if (!Array.isArray(result.riderTips)) result.riderTips = SAFETY_TIPS_DEFAULTS.riderTips;
  if (!Array.isArray(result.driverTips)) result.driverTips = SAFETY_TIPS_DEFAULTS.driverTips;
  return result;
}

export const BIKE_TAXI_DEFAULTS = {
  enabled: true,
  helmetRequired: true,
  pillionAllowed: true,
  maxPassengers: 1,
  maxRideDistanceKm: 20,
  minDriverAge: 18,
  requireInsurance: false,
  requirePuc: false,
  safetyMessage: 'Bike taxi rides are fast and affordable. Driver provides a helmet for your safety.',
  riderSafetyAck: true,
};

export async function getBikeTaxiConfig() {
  const doc = await Settings.findOne();
  const stored = doc?.bikeTaxiConfig || {};
  return { ...BIKE_TAXI_DEFAULTS, ...stored };
}

export async function saveBikeTaxiConfig(input = {}) {
  const doc = (await Settings.findOne()) || new Settings();
  const clean = { ...BIKE_TAXI_DEFAULTS };
  if (input.enabled !== undefined) clean.enabled = input.enabled === true || input.enabled === 'true';
  if (input.helmetRequired !== undefined) clean.helmetRequired = input.helmetRequired === true || input.helmetRequired === 'true';
  if (input.pillionAllowed !== undefined) clean.pillionAllowed = input.pillionAllowed === true || input.pillionAllowed === 'true';
  if (input.riderSafetyAck !== undefined) clean.riderSafetyAck = input.riderSafetyAck === true || input.riderSafetyAck === 'true';
  if (input.requireInsurance !== undefined) clean.requireInsurance = input.requireInsurance === true || input.requireInsurance === 'true';
  if (input.requirePuc !== undefined) clean.requirePuc = input.requirePuc === true || input.requirePuc === 'true';
  const numFields = ['maxPassengers', 'maxRideDistanceKm', 'minDriverAge'];
  for (const key of numFields) {
    const v = Number(input[key]);
    if (Number.isFinite(v) && v >= 0) clean[key] = v;
  }
  if (typeof input.safetyMessage === 'string') clean.safetyMessage = input.safetyMessage;
  doc.bikeTaxiConfig = clean;
  await doc.save();
  return { ...BIKE_TAXI_DEFAULTS, ...clean };
}

// ─── Seat Booking (reserved seats) Configuration ────────────────────────────

export const SEAT_MODES = ['shared', 'reserved', 'off'];

export const SEAT_BOOKING_DEFAULTS = {
  mode: 'shared', // 'shared' (per-seat, joinable) | 'reserved' (whole vehicle) | 'off'
  message: '',
};

export async function getSeatBookingConfig() {
  const doc = await Settings.findOne();
  const stored = doc?.seatBookingConfig || {};
  // back-compat: legacy { enabled: false } -> 'off', { enabled: true } -> 'shared'
  let mode = stored.mode;
  if (!SEAT_MODES.includes(mode)) {
    mode = stored.enabled === false ? 'off' : 'shared';
  }
  return { ...SEAT_BOOKING_DEFAULTS, ...stored, mode };
}

export async function saveSeatBookingConfig(input = {}) {
  const doc = (await Settings.findOne()) || new Settings();
  const clean = { ...SEAT_BOOKING_DEFAULTS };
  let mode = input.mode;
  if (mode === undefined && input.enabled !== undefined) {
    mode = input.enabled === true || input.enabled === 'true' ? 'shared' : 'off';
  }
  if (SEAT_MODES.includes(mode)) clean.mode = mode;
  if (typeof input.message === 'string' && input.message.trim()) clean.message = input.message.trim();
  doc.seatBookingConfig = clean;
  await doc.save();
  return { ...SEAT_BOOKING_DEFAULTS, ...clean };
}

// ─── UPI Configuration ────────────────────────────────────────────────────────

export const UPI_DEFAULTS = {
  // Never hardcode a personal/business UPI handle in source. The operator sets
  // it via env (UPI_ID) or the Admin → Settings → UPI page (persisted in DB).
  upiId: process.env.UPI_ID || '',
  merchantName: 'Super Toto Local',
  enabled: true,
  showQr: true,
  instructions: 'Scan the QR or tap the button below to pay via any UPI app.',
};

export async function getUpiConfig() {
  const doc = await Settings.findOne();
  const stored = doc?.upiConfig || {};
  return { ...UPI_DEFAULTS, ...stored };
}

export async function saveUpiConfig(input = {}) {
  const doc = (await Settings.findOne()) || new Settings();
  const clean = { ...UPI_DEFAULTS };
  if (input.upiId && typeof input.upiId === 'string') clean.upiId = input.upiId.trim();
  if (input.merchantName && typeof input.merchantName === 'string') clean.merchantName = input.merchantName.trim();
  if (input.instructions && typeof input.instructions === 'string') clean.instructions = input.instructions.trim();
  if (input.enabled !== undefined) clean.enabled = input.enabled === true || input.enabled === 'true';
  if (input.showQr !== undefined) clean.showQr = input.showQr === true || input.showQr === 'true';
  doc.upiConfig = clean;
  await doc.save();
  return { ...UPI_DEFAULTS, ...clean };
}

// ─── Contact / Helpline Configuration ─────────────────────────────────────────

export const CONTACT_DEFAULTS = {
  helplinePhone: '+919811997286',
  helplineLabel: '24×7 Helpline',
  email: 'tsaenterprisesindia@gmail.com',
  whatsapp: '+919811997286',
  showHelpline: true,
};

export async function getContactConfig() {
  const doc = await Settings.findOne();
  const stored = doc?.contactConfig || {};
  return { ...CONTACT_DEFAULTS, ...stored };
}

export async function saveContactConfig(input = {}) {
  const doc = (await Settings.findOne()) || new Settings();
  const clean = { ...CONTACT_DEFAULTS };
  if (input.helplinePhone && typeof input.helplinePhone === 'string') clean.helplinePhone = input.helplinePhone.trim();
  if (input.helplineLabel && typeof input.helplineLabel === 'string') clean.helplineLabel = input.helplineLabel.trim();
  if (input.email && typeof input.email === 'string') clean.email = input.email.trim();
  if (input.whatsapp && typeof input.whatsapp === 'string') clean.whatsapp = input.whatsapp.trim();
  if (input.showHelpline !== undefined) clean.showHelpline = input.showHelpline === true || input.showHelpline === 'true';
  doc.contactConfig = clean;
  await doc.save();
  return { ...CONTACT_DEFAULTS, ...clean };
}

export const CHATBOT_DEFAULTS = {
  enabled: true,
  botName: 'Toto Assist',
  greeting: 'Hi! 👋 I am Toto Assist, your Super Toto Local helper. Ask me about fares, booking, payments, safety or anything else!',
  fallback: 'I am not sure about that yet 😅. Try asking about fares, booking a ride, payments, safety, or type "help" for options.',
  helpText: 'I can help you with:\n\n💰 Fares & pricing\n🚕 Booking a ride\n🛺 Vehicle types (Toto, Auto, Taxi, Bike)\n💳 Payments (UPI, Cash)\n🛡️ Safety & emergency\n🧳 Luggage & passengers\n❌ Cancellations',
  quickReplies: ['💰 Fares', '🚕 How to book?', '💳 Payments', '🛡️ Safety', '🧳 Luggage', '❌ Cancellation'],
};

export async function getChatbotConfig() {
  const doc = await Settings.findOne();
  const stored = doc?.chatbotConfig || {};
  return { ...CHATBOT_DEFAULTS, ...stored };
}

export async function saveChatbotConfig(input = {}) {
  const doc = (await Settings.findOne()) || new Settings();
  const clean = { ...CHATBOT_DEFAULTS };
  if (input.enabled !== undefined) clean.enabled = input.enabled === true || input.enabled === 'true';
  if (typeof input.botName === 'string' && input.botName.trim()) clean.botName = input.botName.trim();
  if (typeof input.greeting === 'string' && input.greeting.trim()) clean.greeting = input.greeting.trim();
  if (typeof input.fallback === 'string' && input.fallback.trim()) clean.fallback = input.fallback.trim();
  if (typeof input.helpText === 'string' && input.helpText.trim()) clean.helpText = input.helpText.trim();
  if (Array.isArray(input.quickReplies)) {
    clean.quickReplies = input.quickReplies.filter((q) => typeof q === 'string' && q.trim()).slice(0, 10);
  }
  doc.chatbotConfig = clean;
  await doc.save();
  return { ...CHATBOT_DEFAULTS, ...clean };
}

// ─── Compliance Configuration (GoI) ───────────────────────────────────────────

export const COMPLIANCE_DEFAULTS = {
  gstin: '',
  operatingState: 'Delhi',
  legalEntityName: 'TSA Enterprises',
  legalAddress: '',
  surgeCap: 1.5, // state-compliant max surge multiplier
  cancellationFee: 20,
  cancellationPolicy:
    'Cancelling a ride after a driver accepts incurs a ₹20 cancellation fee. No fee is charged if the toto has not been assigned.',
  insurancePolicyNo: '',
  passengerInsuranceNote:
    'Every trip includes passenger and third-party insurance coverage as required under the Motor Vehicles Act, 1988.',
  grievanceOfficer: {
    name: '',
    designation: 'Grievance Officer',
    email: '',
    phone: '',
    address: '',
  },
  // Cash-settlement policy: how long a driver may hold the platform's cash share
  // collected on cash rides before being blocked, and the free-carry limit.
  cashSettlement: {
    overdueLimit: 500, // ₹ — below this, no urgency even if old
    deadlineHours: 48, // hours allowed to return the platform's cash share
  },
  aadhaarUidaiMode: false, // false = checksum validation (demo), true = UIDAI offline-KYC
  driverDocs: {
    aadhaar: true,
    rc: true,
    license: true,
    bank: true,
    photo: true,
    insurance: false,
    puc: false,
    pcc: true,
  },
};

// All document types a driver may upload and their labels (driver onboarding).
export const DRIVER_DOC_TYPES = [
  { key: 'aadhaar', label: 'Aadhaar Card' },
  { key: 'rc', label: 'Vehicle RC' },
  { key: 'license', label: 'Driver License' },
  { key: 'bank', label: 'Bank Account Details' },
  { key: 'photo', label: 'Passport Photo' },
  { key: 'insurance', label: 'Insurance Certificate' },
  { key: 'puc', label: 'PUC Certificate' },
  { key: 'pcc', label: 'Police Clearance Certificate' },
];

const DRIVER_DOC_DEFAULTS = { aadhaar: true, rc: true, license: true, bank: true, photo: true, insurance: false, puc: false, pcc: true };

// Which driver documents are required (true) vs optional (false) for onboarding.
export function getRequiredDriverDocs(compliance = {}) {
  return { ...DRIVER_DOC_DEFAULTS, ...(compliance.driverDocs || {}) };
}

export async function getComplianceConfig() {
  const doc = await Settings.findOne();
  const stored = doc?.compliance || {};
  const cfg = { ...COMPLIANCE_DEFAULTS };
  for (const key of Object.keys(COMPLIANCE_DEFAULTS)) {
    if (stored[key] !== undefined) cfg[key] = stored[key];
  }
  cfg.grievanceOfficer = { ...COMPLIANCE_DEFAULTS.grievanceOfficer, ...(stored.grievanceOfficer || {}) };
  cfg.cashSettlement = { ...COMPLIANCE_DEFAULTS.cashSettlement, ...(stored.cashSettlement || {}) };
  return cfg;
}

export async function saveComplianceConfig(input = {}) {
  const doc = (await Settings.findOne()) || new Settings();
  const clean = { ...COMPLIANCE_DEFAULTS };
  for (const key of ['gstin', 'operatingState', 'legalEntityName', 'legalAddress', 'cancellationPolicy', 'insurancePolicyNo', 'passengerInsuranceNote']) {
    if (typeof input[key] === 'string') clean[key] = input[key].trim();
  }
  const cap = Number(input.surgeCap);
  if (Number.isFinite(cap) && cap > 1) clean.surgeCap = Math.min(cap, 4);
  const cfee = Number(input.cancellationFee);
  if (Number.isFinite(cfee) && cfee >= 0) clean.cancellationFee = cfee;
  if (input.aadhaarUidaiMode !== undefined) clean.aadhaarUidaiMode = input.aadhaarUidaiMode === true || input.aadhaarUidaiMode === 'true';
  const driverDocs = input.driverDocs || {};
  clean.driverDocs = { ...DRIVER_DOC_DEFAULTS };
  for (const key of Object.keys(DRIVER_DOC_DEFAULTS)) {
    if (driverDocs[key] !== undefined) clean.driverDocs[key] = driverDocs[key] === true || driverDocs[key] === 'true';
  }
  const go = input.grievanceOfficer || {};
  clean.grievanceOfficer = {
    name: typeof go.name === 'string' ? go.name.trim() : COMPLIANCE_DEFAULTS.grievanceOfficer.name,
    designation: typeof go.designation === 'string' ? go.designation.trim() : COMPLIANCE_DEFAULTS.grievanceOfficer.designation,
    email: typeof go.email === 'string' ? go.email.trim() : '',
    phone: typeof go.phone === 'string' ? go.phone.trim() : '',
    address: typeof go.address === 'string' ? go.address.trim() : '',
  };
  const cs = input.cashSettlement || {};
  clean.cashSettlement = {
    overdueLimit: Number.isFinite(Number(cs.overdueLimit)) && Number(cs.overdueLimit) > 0 ? Number(cs.overdueLimit) : COMPLIANCE_DEFAULTS.cashSettlement.overdueLimit,
    deadlineHours: Number.isFinite(Number(cs.deadlineHours)) && Number(cs.deadlineHours) > 0 ? Number(cs.deadlineHours) : COMPLIANCE_DEFAULTS.cashSettlement.deadlineHours,
  };
  doc.compliance = clean;
  await doc.save();
  return { ...clean, grievanceOfficer: { ...clean.grievanceOfficer }, cashSettlement: { ...clean.cashSettlement } };
}

// ─── Driver Training Configuration ────────────────────────────────────────────

export const TRAINING_DEFAULTS = {
  enabled: true,
  certificateText: 'By acknowledging, I confirm that I have read and understood the Super Toto Local driver safety and service training.',
  modules: [
    { id: 't1', icon: '🚦', title: 'Traffic Rules & Safe Driving', text: 'Follow all traffic signals and speed limits. Never overload the vehicle beyond its permitted capacity (e-rickshaw: max 4 passengers).' },
    { id: 't2', icon: '🪪', title: 'Documents Always Ready', text: 'Carry your driving licence, RC, insurance and permit certificates in the vehicle at all times.' },
    { id: 't3', icon: '🤝', title: 'Behaviour & Service', text: 'Treat every rider with respect. No refusals, harassment, smoking or overcharging. Make sure the meter/estimate matches the app fare.' },
    { id: 't4', icon: '🚨', title: 'Emergency & SOS', text: 'In an accident, protect passengers, call emergency services, inform Super Toto Local through the helpline within 24 hours and file a police report if required by law.' },
    { id: 't5', icon: '🔌', title: 'Battery & Vehicle Care', text: 'For e-rickshaws, use only BIS-marked batteries and charge responsibly. Report any vehicle fault before going online.' },
    { id: 't6', icon: '📞', title: 'Mission Critical: No Unauthorised Trips', text: 'Never conduct trips outside the app. Unauthorised trips void insurance and lead to permanent deactivation.' },
  ],
};

export async function getTrainingConfig() {
  const doc = await Settings.findOne();
  const stored = doc?.trainingConfig || {};
  const t = { ...TRAINING_DEFAULTS };
  if (stored.enabled !== undefined) t.enabled = stored.enabled;
  if (typeof stored.certificateText === 'string') t.certificateText = stored.certificateText;
  if (Array.isArray(stored.modules)) t.modules = stored.modules;
  return t;
}

export async function saveTrainingConfig(input = {}) {
  const doc = (await Settings.findOne()) || new Settings();
  const clean = { ...TRAINING_DEFAULTS };
  if (input.enabled !== undefined) clean.enabled = input.enabled === true || input.enabled === 'true';
  if (typeof input.certificateText === 'string') clean.certificateText = input.certificateText;
  if (Array.isArray(input.modules)) {
    clean.modules = input.modules.filter((m) => m && m.title).map((m) => ({
      id: m.id || String(Date.now()) + Math.random().toString(36).slice(2, 6),
      icon: String(m.icon || '📌'),
      title: String(m.title),
      text: String(m.text || ''),
      required: m.required !== false,
    }));
  }
  doc.trainingConfig = clean;
  await doc.save();
  return { ...clean };
}
