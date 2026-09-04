import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Ride from '../models/Ride.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  haversineKm,
  estimate,
  computeSharedFare,
  computeSurge,
  computeLuggageCharge,
} from '../utils/pricing.js';
import { getPricingConfig, getVehicleRatesConfig, getFeedbackConfig, getSeatBookingConfig, getComplianceConfig, SEAT_MODES, resolveFarePolicy, stateForCoords } from '../services/settings.js';
import { settleCashDue } from '../services/cashSettlement.js';
import { CashLedger } from '../models/CashLedger.js';
import { buildGstInvoice } from '../utils/invoice.js';
import {
  dispatchRideRequest,
  emitRideUpdate,
  clearDispatchTimer,
  toRideDTO,
} from '../socket.js';

const PAYMENT_METHODS = ['UPI', 'Cash', 'Card'];
const ACTIVE_RIDER_STATUSES = ['requested', 'assigned', 'driver_arrived', 'in_progress'];

async function surgeContext() {
  const [activeRequests, onlineDrivers] = await Promise.all([
    Ride.countDocuments({ status: 'requested' }),
    User.countDocuments({
      role: 'driver',
      driverStatus: 'approved',
      isOnline: true,
      isHidden: false,
      'suspension.active': { $ne: true },
      currentRide: null,
      'location.lat': { $ne: null },
    }),
  ]);
  return { activeRequests, onlineDrivers };
}

// Seat-based trip computation.
// - Shared seats: whole vehicle priced as the normal 1-passenger fare; each seat
//   shares it. A rider pays per seat x seats and others may join remaining seats.
// - Reserved seats: the whole vehicle is reserved by ONE rider, who pays the full
//   trip fare. No other riders can join.
// - Off: whole-trip (1 passenger) billing, no seat booking.
async function computeSharedTrip({ pickup, drop, luggage, seats, vehicleType, stateCode }) {
  const luggageCount = Number(luggage?.count) || 0;
  const luggageHeavyCount = Number(luggage?.heavyCount) || 0;
  const distanceKm = haversineKm(pickup, drop);
  const cfg = await getPricingConfig();
  const vtId = vehicleType || 'toto';
  let vtRates = await getVehicleRatesConfig();
  // State-wise fare policy (AV-active state policy set by admin under State Fares).
  // The state is derived server-side from the pickup coordinates as the source of
  // truth — the rider's pick is only a cross-check/override so a wrong pick cannot
  // apply the wrong fare regime.
  const geoState = stateForCoords(pickup);
  const clientState = String(stateCode || '').trim().toUpperCase();
  const effectiveState = geoState || clientState || '';
  let farePolicy = null;
  if (effectiveState) {
    const sp = await resolveFarePolicy(effectiveState);
    if (sp) {
      farePolicy = { ...sp };
      vtRates = sp.vehicleRates;
    }
  }
  if (vtRates[vtId]) Object.assign(cfg, vtRates[vtId]);
  const seatCfg = await getSeatBookingConfig();
  const seatMode = SEAT_MODES.includes(seatCfg.mode) ? seatCfg.mode : 'shared';
  const reserved = seatMode === 'reserved';
  const seatsEnabled = seatMode !== 'off';
  const nominalSeats = Math.max(1, Math.round(Number(vtRates[vtId]?.seatCount) || Number(cfg.seatCount) || 1));
  const seatCount = seatsEnabled ? nominalSeats : 1;
  const requested = Math.max(1, Math.round(Number(seats) || 1));
  const bookedSeats = !seatsEnabled ? 1 : reserved ? seatCount : Math.min(requested, seatCount);
  const { activeRequests, onlineDrivers } = await surgeContext();
  const { durationMin } = estimate(distanceKm, cfg);
  let surge = computeSurge(activeRequests, onlineDrivers, cfg);
  // State-compliant surge cap: a state's active policy caps surge (some states
  // ban surge entirely, i.e. cap 1.0). Falls back to the global compliance cap.
  const compliance = await getComplianceConfig();
  const surgeCap = farePolicy?.surgeCap ?? compliance.surgeCap;
  if (surgeCap > 0) surge = Math.min(surge, surgeCap);
  if (farePolicy?.cancellationFee != null) cfg.cancellationFee = farePolicy.cancellationFee;
  else if (compliance.cancellationFee != null) cfg.cancellationFee = compliance.cancellationFee;
  // Automatic GST split: compare operator's registered state with the trip state.
  cfg.gstState = compliance.operatingState || '';
  cfg.tripState = effectiveState || stateForCoords(drop) || '';
  const luggageCharge = computeLuggageCharge(luggageCount, luggageHeavyCount, cfg);
  const { tripFare, perSeatFare } = computeSharedFare(distanceKm, durationMin, surge, cfg, luggageCharge, seatCount);
  const riderFare = reserved ? tripFare.total : perSeatFare * bookedSeats;
  return {
    luggageCount,
    luggageHeavyCount,
    distanceKm,
    cfg,
    vtId,
    durationMin,
    surge,
    luggageCharge,
    tripFare,
    perSeatFare,
    seatCount,
    bookedSeats,
    riderFare,
    seatsEnabled,
    seatMode,
    reserved,
    availableSeats: seatsEnabled ? seatCount - bookedSeats : 0,
    requestedSeats: requested,
    activeRequests,
    onlineDrivers,
    farePolicy: farePolicy
      ? {
          stateCode: farePolicy.stateCode,
          stateName: farePolicy.stateName,
          sourceLabel: farePolicy.policy.sourceLabel,
          effectiveFrom: farePolicy.policy.effectiveFrom,
          surgeCap,
          cancellationFee: cfg.cancellationFee,
        }
      : null,
  };
}

// A rider may not be the creator of OR a seat-holder on another active trip.
async function activeRideFor(userId) {
  return Ride.findOne({
    status: { $in: ACTIVE_RIDER_STATUSES },
    $or: [{ rider: userId }, { 'occupants.rider': userId }],
  });
}

export default function rideRoutes(io) {
  const router = Router();
  router.use(requireAuth);

  router.post('/estimate', async (req, res, next) => {
    try {
      const { pickup, drop, luggage, seats, vehicleType, state } = req.body;
      if (!pickup?.lat || !pickup?.lng || !drop?.lat || !drop?.lng) {
        return res.status(400).json({ message: 'Pickup and drop locations are required' });
      }
      const c = await computeSharedTrip({ pickup, drop, luggage, seats, vehicleType, stateCode: state });
      if (c.distanceKm < c.cfg.minRideDistanceKm || c.distanceKm > c.cfg.maxRideDistanceKm) {
        return res.json({
          distanceKm: +c.distanceKm.toFixed(2),
          durationMin: 0,
          fare: null,
          surge: c.surge,
          activeRequests: c.activeRequests,
          onlineDrivers: c.onlineDrivers,
          distanceError: c.distanceKm < c.cfg.minRideDistanceKm
            ? `Minimum ride distance is ${c.cfg.minRideDistanceKm} km`
            : `Maximum ride distance is ${c.cfg.maxRideDistanceKm} km`,
        });
      }
      res.json({
        distanceKm: +c.distanceKm.toFixed(2),
        durationMin: c.durationMin,
        fare: c.tripFare,
        perSeatFare: c.perSeatFare,
        seatCount: c.seatCount,
        seats: c.bookedSeats,
        riderTotal: c.riderFare,
        seatsEnabled: c.seatsEnabled,
        seatMode: c.seatMode,
        reserved: c.reserved,
        availableSeats: c.availableSeats,
        surge: c.surge,
        activeRequests: c.activeRequests,
        onlineDrivers: c.onlineDrivers,
        luggage: { count: c.luggageCount, heavyCount: c.luggageHeavyCount, charge: c.luggageCharge },
        vehicleType: c.vtId,
        cancellationFee: c.cfg.cancellationFee,
        cancellationPolicy: (await getComplianceConfig()).cancellationPolicy,
        farePolicy: c.farePolicy,
      });
    } catch (err) {
      next(err);
    }
  });

  // Rider requests a toto (books seats on a shared trip)
  router.post('/', requireRole('rider'), async (req, res, next) => {
    try {
      const { pickup, drop, luggage, seats, vehicleType, state } = req.body;
      if (!pickup?.lat || !pickup?.lng || !drop?.lat || !drop?.lng) {
        return res.status(400).json({ message: 'Pickup and drop locations are required' });
      }
      const active = await activeRideFor(req.user.id);
      if (active) {
        return res.status(409).json({ message: 'You already have an active ride or a booked seat', rideId: active._id });
      }

      const c = await computeSharedTrip({ pickup, drop, luggage, seats, vehicleType, stateCode: state });
      if (!c.seatsEnabled && c.requestedSeats > 1) {
        return res.status(400).json({ message: 'Seat booking is currently disabled by the operator. Rides are booked for the whole trip (1 passenger).' });
      }
      if (c.distanceKm < c.cfg.minRideDistanceKm) {
        return res.status(400).json({ message: `Minimum ride distance is ${c.cfg.minRideDistanceKm} km` });
      }
      if (c.distanceKm > c.cfg.maxRideDistanceKm) {
        return res.status(400).json({ message: `Maximum ride distance is ${c.cfg.maxRideDistanceKm} km` });
      }

      const ride = await Ride.create({
        rider: req.user.id,
        pickup,
        drop,
        distanceKm: +c.distanceKm.toFixed(2),
        durationMin: c.durationMin,
        vehicleType: c.vtId,
        stateCode: c.farePolicy?.stateCode || state || '',
        farePolicy: {
          stateCode: c.farePolicy?.stateCode || '',
          stateName: c.farePolicy?.stateName || '',
          sourceLabel: c.farePolicy?.sourceLabel || '',
          effectiveFrom: c.farePolicy?.effectiveFrom || '',
        },
        luggage: { count: c.luggageCount, heavyCount: c.luggageHeavyCount, charge: c.luggageCharge },
        passengers: {
          adults: c.bookedSeats,
          children: 0,
          freeChildren: 0,
          paidChildren: 0,
          totalPassengers: c.bookedSeats,
          chargedPassengers: c.bookedSeats,
        },
        fare: c.riderFare,
        fareBreakup: { ...c.tripFare, tripTotal: c.tripFare.total, perSeatFare: c.perSeatFare, seatMode: c.seatMode },
        shared: { enabled: c.seatsEnabled, mode: c.seatMode, seatCount: c.seatCount, reserved: c.reserved, seatsTaken: c.bookedSeats, perSeatFare: c.perSeatFare, availableSeats: c.availableSeats },
        occupants: [
          {
            rider: req.user.id,
            seats: c.bookedSeats,
            fare: c.riderFare,
            payment: { status: 'pending', amount: c.riderFare },
          },
        ],
        status: 'requested',
      });

      void dispatchRideRequest(io, ride._id);
      const dto = await toRideDTO(ride._id);
      res.status(201).json({ ride: dto });
    } catch (err) {
      next(err);
    }
  });

  // Rider reserves seats on a shared trip (no dispatch)
  router.post('/reserve', requireRole('rider'), async (req, res, next) => {
    try {
      const { pickup, drop, luggage, seats, vehicleType, state } = req.body;
      if (!pickup?.lat || !pickup?.lng || !drop?.lat || !drop?.lng) {
        return res.status(400).json({ message: 'Pickup and drop locations are required' });
      }
      const active = await activeRideFor(req.user.id);
      if (active) {
        return res.status(409).json({ message: 'You already have an active ride or a booked seat', rideId: active._id });
      }

      const c = await computeSharedTrip({ pickup, drop, luggage, seats, vehicleType, stateCode: state });
      if (!c.seatsEnabled && c.requestedSeats > 1) {
        return res.status(400).json({ message: 'Seat booking is currently disabled by the operator. Rides are booked for the whole trip (1 passenger).' });
      }
      if (c.distanceKm < c.cfg.minRideDistanceKm) {
        return res.status(400).json({ message: `Minimum ride distance is ${c.cfg.minRideDistanceKm} km` });
      }
      if (c.distanceKm > c.cfg.maxRideDistanceKm) {
        return res.status(400).json({ message: `Maximum ride distance is ${c.cfg.maxRideDistanceKm} km` });
      }

      const ride = await Ride.create({
        rider: req.user.id,
        pickup,
        drop,
        distanceKm: +c.distanceKm.toFixed(2),
        durationMin: c.durationMin,
        vehicleType: c.vtId,
        stateCode: c.farePolicy?.stateCode || state || '',
        farePolicy: {
          stateCode: c.farePolicy?.stateCode || '',
          stateName: c.farePolicy?.stateName || '',
          sourceLabel: c.farePolicy?.sourceLabel || '',
          effectiveFrom: c.farePolicy?.effectiveFrom || '',
        },
        luggage: { count: c.luggageCount, heavyCount: c.luggageHeavyCount, charge: c.luggageCharge },
        passengers: {
          adults: c.bookedSeats,
          children: 0,
          freeChildren: 0,
          paidChildren: 0,
          totalPassengers: c.bookedSeats,
          chargedPassengers: c.bookedSeats,
        },
        fare: c.riderFare,
        fareBreakup: { ...c.tripFare, tripTotal: c.tripFare.total, perSeatFare: c.perSeatFare, seatMode: c.seatMode },
        shared: { enabled: c.seatsEnabled, mode: c.seatMode, seatCount: c.seatCount, reserved: c.reserved, seatsTaken: c.bookedSeats, perSeatFare: c.perSeatFare, availableSeats: c.availableSeats },
        occupants: [
          {
            rider: req.user.id,
            seats: c.bookedSeats,
            fare: c.riderFare,
            payment: { status: 'pending', amount: c.riderFare },
          },
        ],
        status: 'reserved',
        reservedAt: new Date(),
      });

      const dto = await toRideDTO(ride._id);
      res.status(201).json({ ride: dto });
    } catch (err) {
      next(err);
    }
  });

  // Rider unreserves (cancels a reserved ride)
  router.post('/:id/unreserve', requireRole('rider'), async (req, res, next) => {
    try {
      const ride = await Ride.findById(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });
      if (String(ride.rider) !== String(req.user.id)) {
        return res.status(403).json({ message: 'Not your ride' });
      }
      if (ride.status !== 'reserved') {
        return res.status(400).json({ message: 'Ride is not reserved' });
      }

      ride.status = 'cancelled_by_rider';
      ride.cancelledAt = new Date();
      await ride.save();

      emitRideUpdate(io, ride._id);
      res.json({ message: 'Reservation cancelled' });
    } catch (err) {
      next(err);
    }
  });

  // Rider dispatches a reserved ride to drivers
  router.post('/:id/dispatch', requireRole('rider'), async (req, res, next) => {
    try {
      const ride = await Ride.findById(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });
      if (String(ride.rider) !== String(req.user.id)) {
        return res.status(403).json({ message: 'Not your ride' });
      }
      if (ride.status !== 'reserved') {
        return res.status(400).json({ message: 'Ride is not reserved' });
      }

      ride.status = 'requested';
      ride.requestedAt = new Date();
      await ride.save();

      void dispatchRideRequest(io, ride._id);
      const dto = await toRideDTO(ride._id);
      res.json({ ride: dto });
    } catch (err) {
      next(err);
    }
  });

// List shared trips that still have empty seats and can be joined
  router.get('/shared', async (req, res, next) => {
    try {
      const seatCfg = await getSeatBookingConfig();
      const seatMode = SEAT_MODES.includes(seatCfg.mode) ? seatCfg.mode : 'shared';
      if (seatMode === 'off') {
        return res.json({ rides: [], seatsEnabled: false, seatMode: 'off' });
      }
      if (seatMode === 'reserved') {
        // Reserved vehicles are booked whole — nothing to join.
        return res.json({ rides: [], seatsEnabled: true, seatMode: 'reserved', message: seatCfg.message || '' });
      }
      const rides = await Ride.find({
        'shared.enabled': true,
        'shared.mode': { $in: ['shared', null] },
        status: { $in: ['assigned', 'driver_arrived'] },
        driver: { $ne: null },
        $expr: { $lt: ['$shared.seatsTaken', '$shared.seatCount'] },
      })
        .sort({ createdAt: -1 })
        .limit(30)
        .populate('rider', 'name phone rating ratingsCount')
        .populate('driver', 'name phone vehicleNumber vehicleType vehicleDetails rating ratingsCount location');
      const out = rides.map((r) => {
        const o = r.toObject();
        return {
          ...o,
          seatMode: o.shared?.mode || 'shared',
          availableSeats: Math.max(0, (o.shared?.seatCount || 0) - (o.shared?.seatsTaken || 0)),
        };
      });
      res.json({ rides: out, seatsEnabled: true, seatMode: 'shared' });
    } catch (err) {
      next(err);
    }
  });

  // A rider books MORE seats on an existing shared trip that already has a driver
  router.post('/:id/join', requireRole('rider'), async (req, res, next) => {
    try {
      const joinedSeats = Math.max(1, Math.round(Number(req.body?.seats) || 1));
      const ride = await Ride.findById(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });
      const seatCfg = await getSeatBookingConfig();
      const seatMode = SEAT_MODES.includes(seatCfg.mode) ? seatCfg.mode : 'shared';
      if (seatMode === 'off') {
        return res.status(400).json({ message: 'Seat booking is currently disabled by the operator.' });
      }
      if (seatMode === 'reserved' || ride.shared?.mode === 'reserved' || ride.shared?.reserved) {
        return res.status(400).json({ message: 'This is a reserved vehicle — the whole trip has already been booked. Joining is not available.' });
      }
      if (!ride.shared?.enabled) {
        return res.status(400).json({ message: 'This trip does not support seat bookings' });
      }
      if (!['assigned', 'driver_arrived'].includes(ride.status) || !ride.driver) {
        return res.status(400).json({ message: 'This trip is no longer accepting seat bookings' });
      }
      if (String(ride.rider) === String(req.user.id)) {
        return res.status(400).json({ message: 'You already started this trip' });
      }
      if ((ride.occupants || []).some((o) => String(o.rider) === String(req.user.id))) {
        return res.status(400).json({ message: 'You already have a seat on this trip' });
      }

      const active = await activeRideFor(req.user.id);
      if (active) {
        return res.status(409).json({ message: 'You already have an active ride or a booked seat', rideId: active._id });
      }

      const seatCount = ride.shared.seatCount || 1;
      const seatsTaken = ride.shared.seatsTaken || 0;
      const available = Math.max(0, seatCount - seatsTaken);
      if (joinedSeats > available) {
        return res.status(400).json({ message: `Only ${available} seat${available === 1 ? '' : 's'} available on this trip` });
      }

      const perSeatFare = ride.shared.perSeatFare || Math.max(1, Math.round((ride.fareBreakup?.total || 0) / seatCount));
      const occFare = perSeatFare * joinedSeats;
      ride.occupants.push({
        rider: req.user.id,
        seats: joinedSeats,
        fare: occFare,
        payment: { status: 'pending', amount: occFare },
      });
      ride.shared.seatsTaken = seatsTaken + joinedSeats;
      ride.shared.availableSeats = Math.max(0, (ride.shared.seatCount || 1) - ride.shared.seatsTaken);
      await ride.save();

      emitRideUpdate(io, ride._id);
      const dto = await toRideDTO(ride._id);
      res.status(200).json({ ride: dto, message: `You booked ${joinedSeats} seat${joinedSeats === 1 ? '' : 's'} for ${occFare}` });
    } catch (err) {
      next(err);
    }
  });

  router.get('/mine', async (req, res, next) => {
    try {
      const isDriver = req.user.role === 'driver';
      const query = isDriver
        ? { driver: req.user.id }
        : { $or: [{ rider: req.user.id }, { 'occupants.rider': req.user.id }] };
      const rides = await Ride.find(query)
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('rider', 'name phone rating')
        .populate('driver', 'name phone vehicleNumber vehicleType vehicleDetails rating');
      res.json({ rides });
    } catch (err) {
      next(err);
    }
  });

  // GST invoice for a ride (the rider, a seat-holder, the assigned driver or an admin).
  router.get('/:id/invoice', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(404).json({ message: 'Ride not found' });
      }
      const ride = await Ride.findById(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });
      const isAllowed =
        req.user.role === 'admin' ||
        String(ride.rider) === String(req.user.id) ||
        String(ride.driver || '') === String(req.user.id) ||
        (ride.occupants || []).some((o) => String(o.rider) === String(req.user.id));
      if (!isAllowed) return res.status(403).json({ message: 'Not your ride' });
      const compliance = await getComplianceConfig();
      res.json({ invoice: buildGstInvoice(ride, compliance) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(404).json({ message: 'Ride not found' });
      }
      const ride = await Ride.findById(req.params.id)
        .populate('rider', 'name phone rating ratingsCount')
        .populate('driver', 'name phone vehicleType vehicleNumber vehicleDetails rating ratingsCount location');
      if (!ride) return res.status(404).json({ message: 'Ride not found' });
      const isOcc =
        String(ride.rider) === String(req.user.id) ||
        String(ride.driver) === String(req.user.id) ||
        (ride.occupants || []).some((o) => String(o.rider) === String(req.user.id));
      if (!isOcc && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not your ride' });
      }
      res.json({ ride });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/cancel', requireRole('rider'), async (req, res, next) => {
    try {
      const ride = await Ride.findById(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });
      if (String(ride.rider) !== String(req.user.id)) {
        return res.status(403).json({ message: 'Not your ride' });
      }
      if (!['reserved', 'requested', 'assigned'].includes(ride.status)) {
        return res.status(400).json({ message: `Cannot cancel a ride that is ${ride.status}` });
      }

      clearDispatchTimer(ride._id);
      ride.status = 'cancelled_by_rider';
      ride.cancelledAt = new Date();
      // The rider is charged a cancellation fee only once a driver has accepted.
      if (ride.driver) {
        const cfg = await getPricingConfig();
        const compliance = await getComplianceConfig();
        const fee = compliance.cancellationFee != null ? compliance.cancellationFee : cfg.cancellationFee;
        ride.cancellationFee = fee;
        ride.payment.amount = fee;
        await User.findByIdAndUpdate(ride.driver, { currentRide: null, isOnline: true });
      }
      await ride.save();

      emitRideUpdate(io, ride._id);
      res.json({ message: 'Ride cancelled', cancellationFee: ride.cancellationFee });
    } catch (err) {
      next(err);
    }
  });

  // Payment - a rider pays for THEIR seats on a completed ride (or a cancellation fee)
  router.post('/:id/pay', requireRole('rider'), async (req, res, next) => {
    try {
      const method = req.body.method || 'UPI';
      if (!PAYMENT_METHODS.includes(method)) {
        return res.status(400).json({ message: `Method must be one of: ${PAYMENT_METHODS.join(', ')}` });
      }

      const ride = await Ride.findById(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });
      const isCreator = String(ride.rider) === String(req.user.id);
      const occ = ride.occupants.find((o) => String(o.rider) === String(req.user.id));
      if (!isCreator && !occ) {
        return res.status(403).json({ message: 'You have no seats on this ride' });
      }

      const isFeePayment = ride.status === 'cancelled_by_rider' && ride.cancellationFee > 0;
      if (ride.status !== 'completed' && !isFeePayment) {
        return res.status(400).json({ message: 'Ride is not completed yet' });
      }
      if (occ) {
        if (occ.payment.status === 'paid' || occ.payment.status === 'cash_pending') {
          return res.json({ ride: await toRideDTO(ride._id) });
        }
      } else if (ride.payment.status === 'paid' || ride.payment.status === 'cash_pending') {
        return res.json({ ride: await toRideDTO(ride._id) });
      }

      const amount = occ ? occ.fare : isFeePayment ? ride.cancellationFee : ride.fare;
      const pay = {
        method,
        amount,
        status: method === 'Cash' ? 'cash_pending' : 'paid',
        paidAt: method === 'Cash' ? null : new Date(),
      };
      if (occ) {
        occ.payment = { ...occ.payment, ...pay };
        ride.markModified('occupants');
      }
      // Mirror the primary rider's payment onto the ride for the driver's view
      if (isCreator) {
        ride.payment = { ...ride.payment, ...pay };
      }
      await ride.save();

      // Auto-deduction: when the rider pays digitally, the platform receives the
      // funds. Any cash the driver owes from earlier cash-paid rides is settled
      // first from what the platform would otherwise pay the driver digitally.
      if (method !== 'Cash' && !isFeePayment && ride.driver) {
        const already = await CashLedger.exists({
          driver: ride.driver,
          'entries.rideId': ride._id,
          'entries.type': 'auto_deduct',
        });
        if (!already) {
          const earning = ride.fareBreakup?.driverEarnings || 0;
          if (earning > 0) {
            await settleCashDue({
              driverId: ride.driver,
              amount: Math.min(earning, amount || earning),
              rideId: ride._id,
              source: 'auto_deduct',
              note: `Auto-deducted from digital earnings on ride ${ride._id}`,
            });
          }
        }
      }

      emitRideUpdate(io, ride._id);
      res.json({ ride: await toRideDTO(ride._id) });
    } catch (err) {
      next(err);
    }
  });

  // Rider rates driver OR driver rates rider
  router.post('/:id/rate', async (req, res, next) => {
    try {
      const { rating, ratedRole } = req.body;
      const value = Number(rating);
      if (!value || value < 1 || value > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
      }
      if (!['driver', 'rider'].includes(ratedRole)) {
        return res.status(400).json({ message: 'ratedRole must be driver or rider' });
      }

      const ride = await Ride.findById(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });
      if (ride.status !== 'completed') {
        return res.status(400).json({ message: 'You can only rate after the ride is completed' });
      }

      let target;
      if (ratedRole === 'driver') {
        if (String(ride.rider) !== String(req.user.id)) {
          return res.status(403).json({ message: 'Only the rider can rate the driver' });
        }
        if (ride.riderRating) return res.status(400).json({ message: 'Already rated' });
        ride.riderRating = value;
        target = ride.driver;
      } else {
        if (String(ride.driver) !== String(req.user.id)) {
          return res.status(403).json({ message: 'Only the driver can rate the rider' });
        }
        if (ride.driverRating) return res.status(400).json({ message: 'Already rated' });
        ride.driverRating = value;
        target = ride.rider;
      }
      await ride.save();

      if (target) {
        const t = await User.findById(target);
        const newCount = t.ratingsCount + 1;
        const newRating = (t.rating * t.ratingsCount + value) / newCount;
        t.rating = Math.round(newRating * 10) / 10;
        t.ratingsCount = newCount;
        await t.save();
      }

      emitRideUpdate(io, ride._id);
      res.json({ message: 'Thanks for your feedback' });
    } catch (err) {
      next(err);
    }
  });

  // Rider submits review feedback (driver, distance, time) — discount if all required fields provided
  router.post('/:id/review', requireRole('rider'), async (req, res, next) => {
    try {
      const { driverFeedback, distanceFeedback, timeFeedback } = req.body;
      const ride = await Ride.findById(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });
      if (String(ride.rider) !== String(req.user.id)) {
        return res.status(403).json({ message: 'Not your ride' });
      }
      if (ride.status !== 'completed') {
        return res.status(400).json({ message: 'You can only review after the ride is completed' });
      }
      if (ride.riderReview?.submittedAt) {
        return res.status(400).json({ message: 'Review already submitted' });
      }

      const fbCfg = await getFeedbackConfig();
      if (!fbCfg.enabled) {
        return res.status(400).json({ message: 'Rider review is currently disabled' });
      }

      const df = String(driverFeedback || '').trim();
      const distf = String(distanceFeedback || '').trim();
      const tf = String(timeFeedback || '').trim();

      // Validate required fields based on admin config
      if (fbCfg.requireDriverFeedback && !df) {
        return res.status(400).json({ message: 'Please provide feedback about the driver' });
      }
      if (fbCfg.requireDistanceFeedback && !distf) {
        return res.status(400).json({ message: 'Please provide feedback about travel distance' });
      }
      if (fbCfg.requireTimeFeedback && !tf) {
        return res.status(400).json({ message: 'Please provide feedback about travel time' });
      }

      // Check all required fields are provided
      const allRequired =
        (!fbCfg.requireDriverFeedback || df) &&
        (!fbCfg.requireDistanceFeedback || distf) &&
        (!fbCfg.requireTimeFeedback || tf);
      const feedbackDiscount = allRequired ? (fbCfg.discountAmount || 0) : 0;

      ride.riderReview = {
        driverFeedback: df,
        distanceFeedback: distf,
        timeFeedback: tf,
        feedbackDiscount,
        submittedAt: new Date(),
      };

      // Apply discount to fare and breakup
      if (feedbackDiscount > 0) {
        ride.fareBreakup.feedbackDiscount = feedbackDiscount;
        ride.fareBreakup.total = Math.max(0, ride.fareBreakup.total - feedbackDiscount);
        ride.fare = Math.max(0, ride.fare - feedbackDiscount);
        const creatorOcc = ride.occupants.find((o) => String(o.rider) === String(ride.rider));
        if (creatorOcc) {
          creatorOcc.fare = Math.max(0, creatorOcc.fare - feedbackDiscount);
          if (creatorOcc.payment.status === 'pending') {
            creatorOcc.payment.amount = creatorOcc.fare;
          }
          ride.markModified('occupants');
        }
        if (ride.payment.status === 'pending') {
          ride.payment.amount = ride.fare;
        }
      }

      await ride.save();

      emitRideUpdate(io, ride._id);
      const discountMsg = feedbackDiscount > 0
        ? fbCfg.discountMessage.replace('{amount}', feedbackDiscount)
        : fbCfg.successMessage;
      res.json({
        message: discountMsg,
        ride: await Ride.findById(ride._id).populate('driver', 'name').lean(),
        discount: feedbackDiscount,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
