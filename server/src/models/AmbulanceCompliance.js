import mongoose from 'mongoose';

// State-level ambulance onboarding record. An operator/driver registers an
// ambulance with the platform under the aggregator model — the vehicle is
// dispatched only when it holds a current, admin-verified compliance record for
// the trip's state (Sikkim STA / Bihar Transport Dept permits etc.).
//
// lifecycle: pending → active → (expired/suspended). Expiry is enforced by the
// sweep service: any active record with a document expiring in the past is
// auto-suspended and the driver + admins are notified.
const docSchema = (required) => ({
  number: { type: String, default: '' }, // permit / fitness / insurance / licence number
  issuer: { type: String, default: '' }, // e.g. 'Motor Vehicles Dept, Govt of Sikkim'
  validUpto: required ? { type: Date, default: null } : { type: Date, default: null },
});

const ambulanceComplianceSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    stateCode: { type: String, required: true, uppercase: true, trim: true }, // e.g. 'SK', 'BR'
    ambulanceType: { type: String, enum: ['BLS', 'ALS'], required: true }, // MoHFW Type B / Type C
    vehicleNumber: { type: String, required: true, uppercase: true, trim: true },

    // Permit to operate as a transport passenger (ambulance) vehicle in the state,
    // e.g. Sikkim STA stage-carriage/taxi permit, Bihar Transport Dept commercial permit.
    permit: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Vehicle compliance documents.
    fitness: { type: mongoose.Schema.Types.Mixed, default: {} }, // valid fitness certificate (CMVR 62)
    insurance: { type: mongoose.Schema.Types.Mixed, default: {} }, // third-party + patient cover (MV Act)
    roadTax: { type: mongoose.Schema.Types.Mixed, default: {} }, // state road tax paid
    puc: { type: mongoose.Schema.Types.Mixed, default: {} }, // pollution under control

    // Crew / medical equipment compliance (National Ambulance Code).
    drivingLicense: { type: mongoose.Schema.Types.Mixed, default: {} }, // driver's licence with right class
    emtCert: { type: mongoose.Schema.Types.Mixed, default: {} }, // Emergency Medical Technician certification
    equipmentList: { type: String, default: '' }, // stretcher/cot, oxygen, defibrillator, etc.

    status: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'pending',
    },
    rejectionReason: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// One active record per driver per state per service level.
ambulanceComplianceSchema.index({ driver: 1, stateCode: 1, ambulanceType: 1 }, { unique: true });
ambulanceComplianceSchema.index({ status: 1, stateCode: 1 });

// The dates everything hinges on. Used by the sweep + dispatch completeness check.
export function complianceExpiryDates(record = {}) {
  const items = ['permit', 'fitness', 'insurance', 'roadTax', 'puc', 'drivingLicense', 'emtCert'];
  const dates = [];
  for (const key of items) {
    const d = record[key]?.validUpto;
    if (d) {
      const ts = new Date(d).getTime();
      if (Number.isFinite(ts)) dates.push({ key, validUpto: new Date(ts) });
    }
  }
  return dates;
}

// A record is complete when every required document has a future expiry date.
export function isComplianceComplete(record = {}) {
  if (!record.ambulanceType || !record.vehicleNumber) return false;
  return complianceExpiryDates(record).every(({ validUpto }) => validUpto.getTime() > Date.now());
}

// True only for records that are admin-approved AND fully valid right now.
export function isComplianceActive(record = {}) {
  return record.status === 'active' && isComplianceComplete(record);
}

const AmbulanceCompliance = mongoose.model('AmbulanceCompliance', ambulanceComplianceSchema);
export default AmbulanceCompliance;