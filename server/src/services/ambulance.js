import AmbulanceCompliance, { isComplianceComplete, isComplianceActive } from '../models/AmbulanceCompliance.js';
import { notifyUser, notifyAdmins } from './notify.js';
import { INDIA_STATES } from './settings.js';

export const AMBULANCE_DOC_KEYS = ['permit', 'fitness', 'insurance', 'roadTax', 'puc', 'drivingLicense', 'emtCert'];

// Normalise the driver-submitted compliance payload into the persisted shape.
// Accepts either a nested `docs` map or the keys at the top level.
export function normalizeAmbulanceComplianceInput(input = {}) {
  const src = input.docs && typeof input.docs === 'object' ? input.docs : input;
  const cleanDoc = (d) => {
    if (!d || typeof d !== 'object') return {};
    const out = {};
    if (typeof d.number === 'string') out.number = d.number.trim();
    if (typeof d.issuer === 'string') out.issuer = d.issuer.trim();
    const upto = new Date(d.validUpto);
    if (d.validUpto && !Number.isNaN(upto.getTime())) out.validUpto = upto;
    return out;
  };
  const docs = {};
  for (const key of AMBULANCE_DOC_KEYS) {
    if (src[key] !== undefined) docs[key] = cleanDoc(src[key]);
  }
  return docs;
}

export function isValidAmbulanceState(stateCode) {
  return INDIA_STATES.some((s) => s.code === String(stateCode || '').trim().toUpperCase());
}

// ─── Daily compliance-expiry sweep ────────────────────────────────────────────
// Any admin-verified ambulance whose permit/fitness/insurance/EMT cert has lapsed
// is auto-suspended so it can never receive a dispatch. Drivers and admins are
// notified; the record stays visible for renewal. Runs on server start and on a
// daily interval, and can be triggered from the admin console.
export async function runAmbulanceExpirySweep({ io } = {}) {
  const active = await AmbulanceCompliance.find({ status: 'active' });
  const suspended = [];
  for (const rec of active) {
    if (isComplianceComplete(rec)) continue;
    rec.status = 'suspended';
    rec.notes = rec.notes
      ? `${rec.notes} Auto-suspended: a compliance document expired.`
      : 'Auto-suspended: a compliance document expired.';
    await rec.save();
    suspended.push(rec);
    await notifyUser({
      io,
      userId: rec.driver,
      type: 'compliance',
      title: 'Ambulance compliance suspended',
      message: `Your ${rec.ambulanceType} ambulance for ${rec.stateCode} was auto-suspended because a document expired. Renew it to resume dispatch.`,
    });
  }
  if (suspended.length) {
    await notifyAdmins({
      io,
      type: 'compliance',
      title: 'Ambulance compliance expired',
      message: `${suspended.length} ambulance registration(s) were auto-suspended for expired documents.`,
    });
  }
  return { checked: active.length, suspended: suspended.length };
}

// The driver set (by _id) eligible to be dispatched to an ambulance request in a
// state at a given service level. ALS-certified units may answer BLS calls (they
// carry at least the same equipment); BLS units cannot answer ALS calls.
export async function ambulanceEligibleDriverIds({ stateCode = '', ambulanceType = 'BLS' }) {
  if (!stateCode) return new Set();
  const serviceLevels = ambulanceType === 'ALS' ? ['ALS'] : ['BLS', 'ALS'];
  const recs = await AmbulanceCompliance.find({
    stateCode: String(stateCode).trim().toUpperCase(),
    ambulanceType: { $in: serviceLevels },
    status: 'active',
  });
  const eligible = new Set();
  for (const r of recs) if (isComplianceActive(r)) eligible.add(String(r.driver));
  return eligible;
}

// Safe DTO for the admin console / driver self-view.
export function ambulanceComplianceDTO(rec) {
  const o = rec.toObject ? rec.toObject() : rec;
  const expiryItems = [];
  for (const key of ['permit', 'fitness', 'insurance', 'roadTax', 'puc', 'drivingLicense', 'emtCert']) {
    const v = o[key];
    if (!v || typeof v !== 'object') continue;
    expiryItems.push({
      key,
      label: v.label || key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim(),
      number: v.number || '',
      issuer: v.issuer || '',
      validUpto: v.validUpto ? new Date(v.validUpto).toISOString() : null,
    });
  }
  return {
    id: String(o._id),
    driver: o.driver ? (o.driver._id ? { id: String(o.driver._id), name: o.driver.name, phone: o.driver.phone, email: o.driver.email } : o.driver) : null,
    stateCode: o.stateCode,
    ambulanceType: o.ambulanceType,
    vehicleNumber: o.vehicleNumber,
    permit: { number: o.permit?.number || '', issuer: o.permit?.issuer || '', validUpto: o.permit?.validUpto ? new Date(o.permit.validUpto).toISOString() : null },
    fitness: { number: o.fitness?.number || '', issuer: o.fitness?.issuer || '', validUpto: o.fitness?.validUpto ? new Date(o.fitness.validUpto).toISOString() : null },
    insurance: { number: o.insurance?.number || '', issuer: o.insurance?.issuer || '', validUpto: o.insurance?.validUpto ? new Date(o.insurance.validUpto).toISOString() : null },
    roadTax: { number: o.roadTax?.number || '', issuer: o.roadTax?.issuer || '', validUpto: o.roadTax?.validUpto ? new Date(o.roadTax.validUpto).toISOString() : null },
    puc: { number: o.puc?.number || '', issuer: o.puc?.issuer || '', validUpto: o.puc?.validUpto ? new Date(o.puc.validUpto).toISOString() : null },
    drivingLicense: { number: o.drivingLicense?.number || '', issuer: o.drivingLicense?.issuer || '', validUpto: o.drivingLicense?.validUpto ? new Date(o.drivingLicense.validUpto).toISOString() : null },
    emtCert: { number: o.emtCert?.number || '', issuer: o.emtCert?.issuer || '', validUpto: o.emtCert?.validUpto ? new Date(o.emtCert.validUpto).toISOString() : null },
    equipmentList: o.equipmentList || '',
    status: o.status,
    rejectionReason: o.rejectionReason || '',
    reviewedAt: o.reviewedAt ? new Date(o.reviewedAt).toISOString() : null,
    reviewedBy: o.reviewedBy || null,
    notes: o.notes || '',
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
    updatedAt: o.updatedAt ? new Date(o.updatedAt).toISOString() : null,
    complete: isComplianceComplete(o),
    active: isComplianceActive(o),
    expiryItems,
  };
}