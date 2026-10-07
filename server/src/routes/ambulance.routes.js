import { Router } from 'express';
import AmbulanceCompliance from '../models/AmbulanceCompliance.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getAmbulanceConfig, isAmbulanceEnabledForState, INDIA_STATES } from '../services/settings.js';
import { ambulanceComplianceDTO, normalizeAmbulanceComplianceInput, isValidAmbulanceState, AMBULANCE_DOC_KEYS } from '../services/ambulance.js';
import { VEHICLE_TYPES } from '../utils/pricing.js';

export default function ambulanceRoutes() {
  const router = Router();

  // Public: is ambulance service available in a state? Also advertises the
  // ambulance vehicle types so the rider app only shows them when enabled.
  router.get('/availability', async (req, res, next) => {
    try {
      const cfg = await getAmbulanceConfig();
      const stateCode = String(req.query.state || '').trim().toUpperCase();
      const inState = await isAmbulanceEnabledForState(stateCode);
      res.json({
        enabled: cfg.enabled,
        enabledStates: cfg.enabledStates || [],
        states: INDIA_STATES.map((s) => ({ code: s.code, name: s.name })),
        stateCode: stateCode || null,
        availableInState: inState,
        requirePatientConsent: cfg.requirePatientConsent,
        note: cfg.note,
        vehicleTypes: VEHICLE_TYPES.filter((v) => v.category === 'ambulance').map((v) => ({
          id: v.id,
          label: v.label,
          ambulanceType: v.ambulanceType,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // Driver-only registration / compliance management.
  const driverRouter = Router();
  driverRouter.use(requireAuth, requireRole('driver'));

  driverRouter.get('/compliance', async (req, res, next) => {
    try {
      const records = await AmbulanceCompliance.find({ driver: req.user.id })
        .populate('driver', 'name phone email')
        .sort({ createdAt: -1 })
        .lean();
      res.json({ records: records.map(ambulanceComplianceDTO) });
    } catch (err) {
      next(err);
    }
  });

  driverRouter.post('/compliance', async (req, res, next) => {
    try {
      const stateCode = String(req.body.stateCode || '').trim().toUpperCase();
      const ambulanceType = String(req.body.ambulanceType || '').trim().toUpperCase();
      const vehicleNumber = String(req.body.vehicleNumber || '').trim().toUpperCase();
      if (!isValidAmbulanceState(stateCode)) {
        return res.status(400).json({ message: 'Invalid state code' });
      }
      if (!['BLS', 'ALS'].includes(ambulanceType)) {
        return res.status(400).json({ message: 'ambulanceType must be BLS or ALS' });
      }
      if (!vehicleNumber) {
        return res.status(400).json({ message: 'Vehicle number is required' });
      }
      const docs = normalizeAmbulanceComplianceInput(req.body);
      const rec = await AmbulanceCompliance.create({
        driver: req.user.id,
        stateCode,
        ambulanceType,
        vehicleNumber,
        ...docs,
        equipmentList: typeof req.body.equipmentList === 'string' ? req.body.equipmentList.trim() : '',
        notes: typeof req.body.notes === 'string' ? req.body.notes.trim() : '',
        status: 'pending',
      });
      res.status(201).json({ record: ambulanceComplianceDTO(await rec.populate('driver', 'name phone email').then((r) => r.toObject())) });
    } catch (err) {
      if (err && err.code === 11000) {
        return res.status(409).json({ message: 'You already registered this ambulance type for this state' });
      }
      next(err);
    }
  });

  driverRouter.put('/compliance/:id', async (req, res, next) => {
    try {
      const rec = await AmbulanceCompliance.findOne({ _id: req.params.id, driver: req.user.id });
      if (!rec) return res.status(404).json({ message: 'Compliance record not found' });

      if (req.body.stateCode) {
        const stateCode = String(req.body.stateCode).trim().toUpperCase();
        if (!isValidAmbulanceState(stateCode)) return res.status(400).json({ message: 'Invalid state code' });
        rec.stateCode = stateCode;
      }
      if (req.body.ambulanceType) {
        const ambulanceType = String(req.body.ambulanceType).trim().toUpperCase();
        if (!['BLS', 'ALS'].includes(ambulanceType)) return res.status(400).json({ message: 'ambulanceType must be BLS or ALS' });
        rec.ambulanceType = ambulanceType;
      }
      if (req.body.vehicleNumber) rec.vehicleNumber = String(req.body.vehicleNumber).trim().toUpperCase();
      const docs = normalizeAmbulanceComplianceInput(req.body);
      for (const key of AMBULANCE_DOC_KEYS) {
        if (docs[key]) rec[key] = docs[key];
      }
      if (typeof req.body.equipmentList === 'string') rec.equipmentList = req.body.equipmentList.trim();
      if (typeof req.body.notes === 'string') rec.notes = req.body.notes.trim();

      // Any substantive change after admin review returns the record to pending
      // so the updated documents are re-verified before dispatch resumes.
      rec.status = 'pending';
      rec.rejectionReason = '';
      rec.reviewedAt = null;
      rec.reviewedBy = null;
      await rec.save();

      const out = await AmbulanceCompliance.findById(rec._id).populate('driver', 'name phone email').lean();
      res.json({ record: ambulanceComplianceDTO(out), message: 'Compliance record updated — pending admin review' });
    } catch (err) {
      if (err && err.code === 11000) {
        return res.status(409).json({ message: 'You already registered this ambulance type for this state' });
      }
      next(err);
    }
  });

  driverRouter.delete('/compliance/:id', async (req, res, next) => {
    try {
      const rec = await AmbulanceCompliance.findOneAndDelete({ _id: req.params.id, driver: req.user.id });
      if (!rec) return res.status(404).json({ message: 'Compliance record not found' });
      res.json({ message: 'Compliance record removed' });
    } catch (err) {
      next(err);
    }
  });

  router.use(driverRouter);
  return router;
}