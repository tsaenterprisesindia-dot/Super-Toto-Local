import jwt from 'jsonwebtoken';
import User from './models/User.js';
import Ride from './models/Ride.js';
import { haversineKm, VEHICLE_TYPES } from './utils/pricing.js';
import { getPricingConfig } from './services/settings.js';

const dispatchTimers = new Map();

export async function toRideDTO(rideId) {
  const ride = await Ride.findById(rideId)
    .populate('rider', 'name phone rating ratingsCount')
    .populate('driver', 'name phone vehicleType vehicleNumber vehicleDetails rating ratingsCount location');
  return ride ? ride.toObject() : null;
}

export function emitRideUpdate(io, rideId) {
  if (!io) return;
  void toRideDTO(rideId).then((ride) => {
    if (!ride) return;
    const userIds = new Set();
    if (ride.rider) userIds.add(String(ride.rider._id || ride.rider));
    if (ride.driver) userIds.add(String(ride.driver._id || ride.driver));
    (ride.occupants || []).forEach((o) => {
      if (o.rider) userIds.add(String(o.rider._id || o.rider));
    });
    userIds.forEach((uid) => io.to(`user:${uid}`).emit('ride:updated', ride));
    io.to(`ride:${rideId}`).emit('ride:updated', ride);
  });
}

export function clearDispatchTimer(rideId) {
  const t = dispatchTimers.get(String(rideId));
  if (t) {
    clearTimeout(t);
    dispatchTimers.delete(String(rideId));
  }
}

// Save a ride during dispatch, safely. The rider can accept/cancel/reassign a ride
// at any moment while the background dispatch chain is running, so concurrent
// saves of the same document can otherwise throw a Mongoose VersionError. This
// re-checks the ride is still awaiting a driver right before persisting and backs
// off (instead of erroring) if the document was changed elsewhere.
async function dispatchSave(ride) {
  if (!ride || ride.status !== 'requested') return false;
  try {
    await ride.save();
    return true;
  } catch (err) {
    // Optimistic-concurrency conflict: the ride was modified concurrently
    // (e.g. accepted, cancelled, reassigned). Back off from dispatching.
    if (err && err.name === 'VersionError') return false;
    throw err;
  }
}

export async function dispatchNext(io, rideId) {
  clearDispatchTimer(rideId);
  const ride = await Ride.findById(rideId);
  if (!ride || ride.status !== 'requested') return;

  if (!ride.pendingDrivers.length) {
    ride.status = 'no_driver';
    try {
      await ride.save();
    } catch (err) {
      if (err && err.name !== 'VersionError') throw err;
    }
    emitRideUpdate(io, rideId);
    return;
  }

  const cfg = await getPricingConfig();
  const timeoutMs = (cfg.dispatchTimeoutSec || 25) * 1000;

  const driverId = ride.pendingDrivers.shift();
  if (!(await dispatchSave(ride))) return;

  const dto = await toRideDTO(rideId);
  if (!dto) return;
  io.to(`user:${driverId}`).emit('ride:request', {
    ...dto,
    timeLeftMs: timeoutMs,
  });

  const timer = setTimeout(() => { void dispatchNext(io, rideId); }, timeoutMs);
  dispatchTimers.set(String(rideId), timer);
}

export async function dispatchRideRequest(io, rideId) {
  const ride = await Ride.findById(rideId);
  if (!ride) return;

  const rideVehicleType = ride.vehicleType || 'toto';
  const vehicleLabels = VEHICLE_TYPES.filter((v) => v.id === rideVehicleType).map((v) => v.label);
  const candidates = await User.find({
    role: 'driver',
    driverStatus: 'approved',
    isOnline: true,
    isHidden: false,
    'suspension.active': { $ne: true },
    currentRide: null,
    'location.lat': { $ne: null },
    $or: [
      { vehicleType: { $in: [rideVehicleType, ...vehicleLabels].filter(Boolean) } },
      { vehicleType: { $exists: false } },
      { vehicleType: '' },
    ],
  });

  const cfg = await getPricingConfig();
  const near = candidates
    .map((d) => ({ d, dist: haversineKm(ride.pickup, d.location) }))
    .filter((x) => x.dist <= cfg.searchRadiusKm)
    .sort((a, b) => a.dist - b.dist);

  ride.pendingDrivers = near.map((x) => x.d._id);
  if (!(await dispatchSave(ride))) return;
  await dispatchNext(io, rideId);
}

export function setupSocket(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Not authenticated'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'super-toto-dev-secret');
      const user = await User.findById(payload.id);
      if (!user || user.isHidden) return next(new Error('Account deactivated'));
      socket.user = { id: payload.id, role: payload.role };
      return next();
    } catch {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.user;
    socket.join(`user:${id}`);

    // Driver live-location streaming
    socket.on('driver:location', async (payload) => {
      if (role !== 'driver') return;
      const { lat, lng } = payload || {};
      if (lat == null || lng == null) return;

      const driver = await User.findByIdAndUpdate(
        id,
        { 'location.lat': lat, 'location.lng': lng },
        { new: true }
      );
      if (driver?.currentRide) {
        io.to(`ride:${driver.currentRide}`).emit('ride:driver_location', { lat, lng });
      }
    });

    // Driver joins the active ride room so both sides receive location events
    socket.on('ride:join', async (rideId) => {
      const ride = await Ride.findById(rideId);
      if (!ride) return;
      const isOcc =
        String(ride.rider) === String(id) ||
        String(ride.driver) === String(id) ||
        (ride.occupants || []).some((o) => String(o.rider) === String(id));
      if (isOcc) {
        socket.join(`ride:${rideId}`);
      }
    });

    socket.on('disconnect', () => {});
  });
}
