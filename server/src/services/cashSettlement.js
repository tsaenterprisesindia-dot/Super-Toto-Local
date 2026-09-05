import { CashLedger } from '../models/CashLedger.js';
import User from '../models/User.js';

// ─── Core helpers ──────────────────────────────────────────────────────────────

// The platform's share of a cash-paid ride = commission + GST (collected under
// Sec 9(5) CGST Act). The driver keeps their net share and owes this back.
export function platformShareOf(ride) {
  const fb = ride.fareBreakup || {};
  const gst = (fb.cgst || 0) + (fb.sgst || 0) + (fb.igst || 0);
  return Math.round(((fb.commission || 0) + gst) * 100) / 100;
}

// ─── Ledger operations ─────────────────────────────────────────────────────────

export async function addCashCollection({ driverId, rideId, amount, note = '' }) {
  if (!amount || amount <= 0) return null;
  const driver = await User.findById(driverId);
  if (!driver) return null;
  if (driver.cashDue <= 0 && driver.cashPendingSince == null) {
    driver.cashPendingSince = new Date();
  }
  driver.cashDue = Math.round((driver.cashDue + amount) * 100) / 100;
  await driver.save();

  let ledger = await CashLedger.findOne({ driver: driverId });
  if (!ledger) ledger = new CashLedger({ driver: driverId, entries: [], totalCollected: 0, totalSettled: 0 });
  ledger.entries.push({
    type: 'cash_collected',
    rideId: rideId || null,
    amount,
    note: note || `Cash collected · platform share of ride`,
  });
  ledger.totalCollected = Math.round((ledger.totalCollected + amount) * 100) / 100;
  await ledger.save();
  return ledger;
}

// Apply a repayment against a driver's cash due. `source` is either a manual
// deposit by the driver or an automatic deduction from their digital earnings.
export async function settleCashDue({ driverId, amount, rideId = null, source = 'deposit', note = '' }) {
  if (!amount || amount <= 0) return null;
  const driver = await User.findById(driverId);
  if (!driver) return null;
  const applied = Math.min(Math.round(amount * 100) / 100, driver.cashDue);
  if (applied <= 0) return null;
  driver.cashDue = Math.round((driver.cashDue - applied) * 100) / 100;
  driver.cashDeposited = Math.round((driver.cashDeposited + applied) * 100) / 100;
  if (driver.cashDue < 0.005) {
    driver.cashDue = 0;
    driver.cashPendingSince = null;
  }
  await driver.save();

  let ledger = await CashLedger.findOne({ driver: driverId });
  if (!ledger) ledger = new CashLedger({ driver: driverId, entries: [], totalCollected: 0, totalSettled: 0 });
  ledger.entries.push({
    type: source === 'auto_deduct' ? 'auto_deduct' : 'deposit',
    rideId: rideId || null,
    amount: applied,
    note: note || (source === 'auto_deduct' ? 'Auto-deducted from digital earnings' : 'Deposit via UPI'),
  });
  ledger.totalSettled = Math.round((ledger.totalSettled + applied) * 100) / 100;
  await ledger.save();
  return { applied, remaining: driver.cashDue };
}

// ─── Overdue policy ────────────────────────────────────────────────────────────

// Fraction of the deadline after which a reminder SMS is (simulatedly) sent.
export const REMINDER_THRESHOLD = 0.5;

export function cashStatus(driver, cfg) {
  const o = cfg?.cashSettlement || { overdueLimit: 500, deadlineHours: 48 };
  const due = Math.round((driver.cashDue || 0) * 100) / 100;
  if (due <= 0) {
    return { due: 0, pending: false, overdue: false, overdueByHours: 0, limit: o.overdueLimit };
  }
  let hoursHeld = 0;
  if (driver.cashPendingSince) {
    hoursHeld = (Date.now() - new Date(driver.cashPendingSince).getTime()) / 3600000;
  }
  const overdue = due > o.overdueLimit && hoursHeld > o.deadlineHours;
  const deadlineProgressPct = Math.round(Math.min(100, (hoursHeld / (o.deadlineHours || 1)) * 100));
  const hoursLeft = Math.max(0, Math.round((o.deadlineHours - hoursHeld) * 10) / 10);
  return {
    due,
    pending: true,
    overdue,
    overdueByHours: Math.round(hoursHeld * 10) / 10,
    limit: o.overdueLimit,
    deadlineHours: o.deadlineHours,
    deadlineProgressPct,
    hoursLeft,
    reminderSent: !!driver.cashReminderSentAt,
    reminderSentAt: driver.cashReminderSentAt || null,
    smsPreview: `Super Toto Local: deposit ₹${due.toLocaleString('en-IN')} of cash settlements (held ${Math.round(hoursHeld)}h). Deposit via UPI or it will be auto-deducted/blocked. Helpline 9811997286.`,
  };
}

// Simulated SMS gateway: record that a reminder has been sent once the driver has
// held a cash balance past the threshold. Idempotent — only ever "sends" once.
export async function maybeSendCashReminder(driverId, cfg) {
  const driver = await User.findById(driverId);
  if (!driver || (driver.cashDue || 0) <= 0 || driver.cashReminderSentAt) {
    return { sent: false, status: cashStatus(driver || {}, cfg) };
  }
  const status = cashStatus(driver, cfg);
  if (status.deadlineProgressPct < REMINDER_THRESHOLD * 100) {
    return { sent: false, status };
  }
  driver.cashReminderSentAt = new Date();
  await driver.save();
  return { sent: true, sentAt: driver.cashReminderSentAt, smsPreview: status.smsPreview, status: { ...status, reminderSent: true, reminderSentAt: driver.cashReminderSentAt } };
}

// Fetch driver docs with their cash due (used by admin + driver endpoints).
export function toCashDTO(driver, cfg) {
  const status = cashStatus(driver, cfg);
  return {
    driver: driver.id,
    name: driver.name,
    phone: driver.phone,
    vehicleNumber: driver.vehicleNumber,
    cashDue: status.due,
    cashDeposited: Math.round((driver.cashDeposited || 0) * 100) / 100,
    pending: status.pending,
    overdue: status.overdue,
    overdueByHours: status.overdueByHours,
    limit: status.limit,
    deadlineHours: status.deadlineHours,
    deadlineProgressPct: status.deadlineProgressPct,
    hoursLeft: status.hoursLeft,
    reminderSent: status.reminderSent,
    reminderSentAt: status.reminderSentAt,
    cashPendingSince: driver.cashPendingSince || null,
  };
}