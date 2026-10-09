import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import Vehicle from '../models/Vehicle.js';
import User from '../models/User.js';

export default function fleetRoutes() {
  const router = Router();

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

  router.get('/drivers', requireAuth, requireRole('fleet_owner'), async (req, res, next) => {
    try {
      const drivers = await User.find({ fleetOwnerId: req.user.id, role: 'driver' })
        .select('-password -resetCode -resetExpires -faceDescriptor')
        .sort({ createdAt: -1 })
        .lean();
      res.json({ drivers });
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

  return router;
}
