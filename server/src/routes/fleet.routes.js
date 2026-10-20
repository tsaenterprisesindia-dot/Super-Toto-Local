import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth, requireRole } from '../middleware/auth.js';
import Vehicle from '../models/Vehicle.js';
import User from '../models/User.js';
import AmbulanceCompliance from '../models/AmbulanceCompliance.js';
import Ride from '../models/Ride.js';
import { isAmbulanceVehicle } from '../utils/pricing.js';

// Ambiguous characters (0/O, 1/I) are excluded so codes are easy to read aloud.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateInviteCode(len = 8) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i += 1) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

// Generates a code that is not already used by another fleet owner.
async function uniqueInviteCode() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generateInviteCode();
    const taken = await User.findOne({ fleetInviteCode: code }).select('_id').lean();
    if (!taken) return code;
  }
  throw new Error('Could not generate a unique invite code');
}

export default function fleetRoutes() {
  const router = Router();

  // ── Fleet owner: vehicles ──────────────────────────────────────────────────
  router.get('/vehicles', requireAuth, requireRole('fleet_owner'), async (req, res, next) => {
    try {
      const vehicles = await Vehicle.find({ fleetOwnerId: req.user.id }).sort({ createdAt: -1 }).lean();
      res.json({ vehicles });
    } catch (err) {
      next(err);
    }
  });

  router.post('/vehicles', requireAuth, requireRole('fleet_owner'), async (req, res, next) => {
    try {
      const data = req.body || {};
      const vehicle = await Vehicle.create({ ...data, fleetOwnerId: req.user.id });
      res.status(201).json({ vehicle });
    } catch (err) {
      next(err);
    }
  });

  router.put('/vehicles/:id', requireAuth, requireRole('fleet_owner'), async (req, res, next) => {
    try {
      const vehicle = await Vehicle.findOne({ _id: req.params.id, fleetOwnerId: req.user.id });
      if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
      Object.assign(vehicle, req.body || {});
      await vehicle.save();
      res.json({ vehicle });
    } catch (err) {
      next(err);
    }
  });

  // ── Fleet owner: drivers ───────────────────────────────────────────────────
  router.get('/drivers', requireAuth, requireRole('fleet_owner'), async (req, res, next) => {
    try {
      const drivers = await User.find({ fleetOwnerId: req.user.id, role: 'driver' })
        .select('name phone driverStatus isOnline isHidden suspension assignedVehicleId vehicleType vehicleNumber createdAt')
        .sort({ createdAt: -1 })
        .lean();
      const ids = drivers.map((d) => d._id);
      const comps = await AmbulanceCompliance.find({ driver: { $in: ids } })
        .select('driver stateCode ambulanceType status permit fitness insurance roadTax puc drivingLicense emtCert vehicleNumber')
        .lean();
      const map = {};
      for (const c of comps) {
        const k = String(c.driver);
        if (!map[k]) map[k] = [];
        map[k].push(c);
      }
      res.json({
        drivers: drivers.map((d) => ({
          ...d,
          ambulanceCompliance: map[String(d._id)] || [],
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // ── Fleet owner: invite code (drivers join with it) ────────────────────────
  router.get('/invite-code', requireAuth, requireRole('fleet_owner'), async (req, res, next) => {
    try {
      const owner = await User.findById(req.user.id);
      if (!owner) return res.status(404).json({ message: 'Fleet owner not found' });
      if (!owner.fleetInviteCode) {
        owner.fleetInviteCode = await uniqueInviteCode();
        await owner.save();
      }
      res.json({ code: owner.fleetInviteCode });
    } catch (err) {
      next(err);
    }
  });

  router.post('/invite-code/regenerate', requireAuth, requireRole('fleet_owner'), async (req, res, next) => {
    try {
      const owner = await User.findById(req.user.id);
      if (!owner) return res.status(404).json({ message: 'Fleet owner not found' });
      owner.fleetInviteCode = await uniqueInviteCode();
      await owner.save();
      res.json({ code: owner.fleetInviteCode });
    } catch (err) {
      next(err);
    }
  });

  // ── Driver: join / leave a fleet ───────────────────────────────────────────
  router.get('/my', requireAuth, requireRole('driver'), async (req, res, next) => {
    try {
      const driver = await User.findById(req.user.id).populate('fleetOwnerId', 'name fleetStatus');
      if (!driver?.fleetOwnerId) return res.json({ fleet: null });
      const f = driver.fleetOwnerId;
      res.json({ fleet: { _id: f._id, name: f.name, fleetStatus: f.fleetStatus } });
    } catch (err) {
      next(err);
    }
  });

  router.post('/join', requireAuth, requireRole('driver'), async (req, res, next) => {
    try {
      const code = String(req.body?.code || '').trim().toUpperCase();
      if (!code) return res.status(400).json({ message: 'Enter an invite code' });
      const driver = await User.findById(req.user.id);
      if (!driver) return res.status(404).json({ message: 'Driver not found' });
      if (driver.fleetOwnerId) return res.status(400).json({ message: 'You are already part of a fleet' });
      const owner = await User.findOne({ role: 'fleet_owner', fleetInviteCode: code });
      if (!owner) return res.status(404).json({ message: 'Invalid invite code' });
      if (owner.fleetStatus !== 'approved') {
        return res.status(400).json({ message: 'This fleet is not approved yet' });
      }
      await User.findByIdAndUpdate(req.user.id, { fleetOwnerId: owner._id });
      res.json({ fleet: { _id: owner._id, name: owner.name }, message: `Joined ${owner.name}` });
    } catch (err) {
      next(err);
    }
  });

  router.post('/leave', requireAuth, requireRole('driver'), async (req, res, next) => {
    try {
      const driver = await User.findById(req.user.id);
      if (!driver) return res.status(404).json({ message: 'Driver not found' });
      if (!driver.fleetOwnerId) return res.status(400).json({ message: 'You are not part of a fleet' });
      // Release the fleet vehicle the driver was using, if any.
      if (driver.assignedVehicleId) {
        const vehicle = await Vehicle.findOne({ _id: driver.assignedVehicleId, fleetOwnerId: driver.fleetOwnerId });
        if (vehicle) {
          vehicle.assignedDriverId = null;
          vehicle.status = 'idle';
          await vehicle.save();
        }
      }
      driver.fleetOwnerId = null;
      driver.assignedVehicleId = null;
      await driver.save();
      res.json({ message: 'You have left the fleet' });
    } catch (err) {
      next(err);
    }
  });

  router.post('/assign', requireAuth, requireRole('fleet_owner'), async (req, res, next) => {
    try {
      const { driverId, vehicleId } = req.body || {};
      if (!driverId || !vehicleId) return res.status(400).json({ message: 'driverId and vehicleId required' });
      const vehicle = await Vehicle.findOne({ _id: vehicleId, fleetOwnerId: req.user.id });
      if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
      const driver = await User.findOne({ _id: driverId, fleetOwnerId: req.user.id, role: 'driver' });
      if (!driver) return res.status(404).json({ message: 'Driver not found under fleet' });
      // Ambulance assignment guardrail: require an active, complete compliance
      // record for the driver that matches the vehicle's ambulance type.
      if (isAmbulanceVehicle(vehicle.vehicleType)) {
        const level = String(vehicle.vehicleType).toLowerCase() === 'ambulance-als' ? 'ALS' : 'BLS';
        const comp = await AmbulanceCompliance.findOne({
          driver: driver._id,
          ambulanceType: level,
        }).lean();
        // We can't know the trip state at assignment time, but require at least
        // one active compliance in some allowed state for this service level.
        if (!comp || comp.status !== 'active') {
          return res.status(400).json({ message: `This driver has no active ${level} ambulance compliance. Approve compliance before assigning an ambulance vehicle.` });
        }
      }
      if (vehicle.assignedDriverId && String(vehicle.assignedDriverId) !== String(driver._id)) {
        return res.status(409).json({ message: 'This vehicle is already assigned to another driver' });
      }
      // Move the driver off any previously assigned vehicle first.
      if (driver.assignedVehicleId && String(driver.assignedVehicleId) !== String(vehicle._id)) {
        const prev = await Vehicle.findOne({ _id: driver.assignedVehicleId, fleetOwnerId: req.user.id });
        if (prev) {
          prev.assignedDriverId = null;
          prev.status = 'idle';
          await prev.save();
        }
      }
      vehicle.assignedDriverId = driver._id;
      vehicle.status = 'assigned';
      driver.assignedVehicleId = vehicle._id;
      await Promise.all([vehicle.save(), driver.save()]);
      res.json({ message: 'Driver assigned' });
    } catch (err) {
      next(err);
    }
  });

  router.post('/unassign', requireAuth, requireRole('fleet_owner'), async (req, res, next) => {
    try {
      const { driverId, vehicleId } = req.body || {};
      if (!driverId) return res.status(400).json({ message: 'driverId required' });
      const driver = await User.findOne({ _id: driverId, fleetOwnerId: req.user.id, role: 'driver' });
      if (!driver) return res.status(404).json({ message: 'Driver not found' });
      const vehicle = await Vehicle.findOne({ _id: vehicleId || driver.assignedVehicleId, fleetOwnerId: req.user.id });
      if (vehicle) {
        vehicle.assignedDriverId = null;
        vehicle.status = 'idle';
        await vehicle.save();
      }
      driver.assignedVehicleId = null;
      await driver.save();
      res.json({ message: 'Driver unassigned' });
    } catch (err) {
      next(err);
    }
  });

  // Fleet trip history (for audit/support)
  router.get('/trips', requireAuth, requireRole('fleet_owner'), async (req, res, next) => {
    try {
      const { category, limit = 50 } = req.query || {};
      const q = { fleetOwnerId: req.user.id };
      if (category) q.category = category;
      const trips = await Ride.find(q)
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limit) || 50, 200))
        .populate('driver', 'name phone')
        .populate('rider', 'name phone')
        .lean();
      res.json({
        trips: trips.map((t) => ({
          _id: t._id,
          status: t.status,
          category: t.category || 'taxi',
          ambulanceType: t.ambulanceType || '',
          emergency: !!t.emergency,
          patientConsent: !!t.patientConsent,
          vehicleType: t.vehicleType,
          driver: t.driver ? { name: t.driver.name, phone: t.driver.phone } : null,
          rider: t.rider ? { name: t.rider.name, phone: t.rider.phone } : null,
          pickup: t.pickup?.name,
          drop: t.drop?.name,
          distanceKm: t.distanceKm,
          fare: t.fare,
          fareBreakup: t.fareBreakup,
          payment: t.payment,
          createdAt: t.createdAt,
          completedAt: t.completedAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // Fleet earnings breakdown by category
  router.get('/earnings', requireAuth, requireRole('fleet_owner'), async (req, res, next) => {
    try {
      const rows = await Ride.aggregate([
        { $match: { fleetOwnerId: req.user.id, status: 'completed' } },
        {
          $group: {
            _id: { category: '$category', ambulanceType: '$ambulanceType' },
            count: { $sum: 1 },
            totalFare: { $sum: '$fare' },
            driverEarnings: { $sum: '$fareBreakup.driverEarnings' },
            commission: { $sum: '$fareBreakup.commission' },
            gst: { $sum: '$fareBreakup.gst' },
          },
        },
        { $sort: { count: -1 } },
      ]);
      const total = await Ride.aggregate([
        { $match: { fleetOwnerId: req.user.id, status: 'completed' } },
        { $group: { _id: null, count: { $sum: 1 }, driverEarnings: { $sum: '$fareBreakup.driverEarnings' }, totalFare: { $sum: '$fare' } } },
      ]);
      res.json({
        breakdown: rows.map((r) => ({
          category: r._id.category || 'taxi',
          ambulanceType: r._id.ambulanceType || '',
          count: r.count,
          totalFare: Math.round((r.totalFare || 0) * 100) / 100,
          driverEarnings: Math.round((r.driverEarnings || 0) * 100) / 100,
          commission: Math.round((r.commission || 0) * 100) / 100,
          gst: Math.round((r.gst || 0) * 100) / 100,
        })),
        totals: {
          count: total[0]?.count || 0,
          driverEarnings: Math.round((total[0]?.driverEarnings || 0) * 100) / 100,
          totalFare: Math.round((total[0]?.totalFare || 0) * 100) / 100,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // Ambulance readiness per state for this fleet
  router.get('/ambulance-readiness', requireAuth, requireRole('fleet_owner'), async (req, res, next) => {
    try {
      const drivers = await User.find({ fleetOwnerId: req.user.id, role: 'driver' }).select('_id').lean();
      const ids = drivers.map((d) => d._id);
      const comps = await AmbulanceCompliance.find({ driver: { $in: ids } })
        .select('driver stateCode ambulanceType status vehicleNumber')
        .lean();
      const byState = {};
      for (const c of comps) {
        const s = c.stateCode || '—';
        if (!byState[s]) byState[s] = { stateCode: s, bls: 0, als: 0, active: 0 };
        if (c.ambulanceType === 'BLS') byState[s].bls += 1;
        if (c.ambulanceType === 'ALS') byState[s].als += 1;
        if (c.status === 'active') byState[s].active += 1;
      }
      res.json({ readiness: Object.values(byState) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
