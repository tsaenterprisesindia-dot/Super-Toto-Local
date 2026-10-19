import User from '../models/User.js';

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

// What is still owed to an account: lifetime net earnings minus payouts already
// settled to the account holder. Never negative.
export function payableOf(user) {
  return Math.max(0, round((user?.earnings || 0) - (user?.paidOut || 0)));
}

// Record a payout to a driver or fleet owner. The amount must be positive and
// cannot exceed the currently payable balance. Payouts are append-only so the
// admin console keeps a full settlement history per account.
export async function recordPayout({ userId, amount, note = '', paidBy = null }) {
  const amt = round(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    const err = new Error('Enter a valid payout amount');
    err.status = 400;
    throw err;
  }
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('Account not found');
    err.status = 404;
    throw err;
  }
  if (!['driver', 'fleet_owner'].includes(user.role)) {
    const err = new Error('Payouts are only available for drivers and fleet owners');
    err.status = 400;
    throw err;
  }
  const payable = payableOf(user);
  if (amt > payable + 0.005) {
    const err = new Error(`Amount exceeds the payable balance (₹${payable.toLocaleString('en-IN')})`);
    err.status = 400;
    throw err;
  }
  user.paidOut = round((user.paidOut || 0) + amt);
  user.lastPayoutAt = new Date();
  user.payouts.push({ amount: amt, note: String(note || '').trim().slice(0, 160), by: paidBy || null, at: new Date() });
  await user.save();
  return { amount: amt, payable: payableOf(user), paidOut: user.paidOut };
}
