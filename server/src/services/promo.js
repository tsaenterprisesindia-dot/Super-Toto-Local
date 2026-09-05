import { Promo } from '../models/Promo.js';

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Validates a promo code WITHOUT mutating it (used by the estimate endpoint and
// by booking before anything is created). Counts as a live usage check only.
export async function validatePromo({ code, baseFare, userId }) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return { ok: false, message: 'Enter a promo code' };
  const promo = await Promo.findOne({ code: clean });
  if (!promo) return { ok: false, message: `Invalid promo code "${clean}"` };
  if (!promo.active) return { ok: false, message: `Promo code ${clean} is inactive` };
  const now = new Date();
  if (promo.validFrom && now < promo.validFrom) {
    return { ok: false, message: `Promo ${clean} is not valid yet` };
  }
  if (promo.validUntil && now > promo.validUntil) {
    return { ok: false, message: `Promo ${clean} has expired` };
  }
  if (promo.usageLimit != null && promo.usedCount >= promo.usageLimit) {
    return { ok: false, message: `Promo ${clean} has been fully redeemed` };
  }
  if (baseFare != null && promo.minFare > 0 && baseFare < promo.minFare) {
    return { ok: false, message: `Promo ${clean} needs a minimum trip fare of ₹${promo.minFare}` };
  }
  if (userId) {
    const entry = (promo.redeemedBy || []).find((e) => String(e.user) === String(userId));
    if (promo.perUserLimit != null && entry && entry.count >= promo.perUserLimit) {
      return { ok: false, message: `You have already used promo ${clean}` };
    }
  }
  return { ok: true, promo };
}

// Pure discount math for a given base fare.
export function computePromoDiscount(promo, baseFare) {
  if (!promo || !baseFare || baseFare <= 0) return 0;
  let disc =
    promo.type === 'pct' ? (baseFare * (promo.value || 0)) / 100 : promo.value || 0;
  if (promo.type === 'pct' && promo.maxDiscount != null) disc = Math.min(disc, promo.maxDiscount);
  disc = Math.min(disc, baseFare);
  return Math.max(0, Math.round(disc));
}

// Validates + computes the discount (no mutation). Booking then persists the
// redemption with recordRedemption() once the ride has actually been created.
export async function redeemPromo({ code, baseFare, userId }) {
  const v = await validatePromo({ code, baseFare, userId });
  if (!v.ok) return { ok: false, message: v.message };
  const discount = computePromoDiscount(v.promo, baseFare);
  if (discount <= 0) return { ok: false, message: 'No applicable discount for this fare' };
  return { ok: true, promo: v.promo, discount };
}

// Persists one successful redemption (usage counters).
export async function recordRedemption(promo, userId) {
  const p = await Promo.findById(promo._id);
  if (!p) return null;
  p.usedCount = (p.usedCount || 0) + 1;
  const entry = (p.redeemedBy || []).find((e) => String(e.user) === String(userId));
  if (entry) {
    entry.count += 1;
    entry.lastUsedAt = new Date();
  } else {
    p.redeemedBy.push({ user: userId, count: 1, lastUsedAt: new Date() });
  }
  await p.save();
  return p;
}