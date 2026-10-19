import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Ride from '../models/Ride.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { emitRideUpdate, clearDispatchTimer, toRideDTO, dispatchNext } from '../socket.js';
import { getComplianceConfig, getRequiredDriverDocs } from '../services/settings.js';
import { faceMatch, isAmbulanceVehicle } from '../utils/pricing.js';
import { ambulanceEligibleDriverIds } from '../services/ambulance.js';
import { CashLedger } from '../models/CashLedger.js';
import { addCashCollection, settleCashDue, cashStatus, maybeSendCashReminder, platformShareOf } from '../services/cashSettlement.js';
import { notifyUser } from '../services/notify.js';
import Invoice from '../models/Invoice.js';
import { getGstConfig } from '../services/settings.js';
import { ensureTripPhotoDir } from '../utils/tripPhoto.js';

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIMES = {
  aadhaar: ['application/pdf'],
  rc: ['application/pdf'],
  license: ['application/pdf'],
  bank: ['application/pdf'],
  photo: ['image/jpeg', 'image/png', 'image/webp'],
  insurance: ['application/pdf'],
  puc: ['application/pdf', 'image/jpeg', 'image/png'],
  pcc: ['application/pdf', 'image/jpeg', 'image/png'],
};

const DOC_LABELS = { aadhaar: 'Aadhaar Card', rc: 'Vehicle RC', license: 'Driver License', bank: 'Bank Account Details', photo: 'Passport Photo', insurance: 'Insurance Certificate', puc: 'PUC Certificate', pcc: 'Police Clearance Certificate' };

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const docType = file.fieldname;
    const allowed = ALLOWED_MIMES[docType];
    if (!allowed) return cb(new Error(`Unknown document type: ${docType}`));
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error(`${DOC_LABELS[docType]} must be ${docType === 'photo' ? 'an image (JPG/PNG)' : 'a PDF file'}`));
    }
    cb(null, true);
  },
});

// Trip safety photos (driver selfie with the riders, taken before starting the
// ride). Stored separately from onboarding documents; removed by the retention
// sweep after the configured number of days.
const TRIP_PHOTO_DIR = ensureTripPhotoDir();

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TRIP_PHOTO_DIR),
  filename: (_req, file, cb) => {
    const ext = file.mimetype === 'image/png' ? '.png' : file.mimetype === 'image/webp' ? '.webp' : '.jpg';
    cb(null, `trip-${crypto.randomUUID()}${ext}`);
  },
});

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('The trip photo must be an image (JPG/PNG)'));
    }
    cb(null, true);
  },
});

export default function driverRoutes(io) {
  const router = Router();
  router.use(requireAuth, requireRole('driver'));

  const requireApproved = async (req, res, next) => {
    if (req.userDoc.driverStatus !== 'approved') {
      return res.status(403).json({ message: 'Your driver account is not approved yet' });
    }
    const compliance = await getComplianceConfig();
    const REQUIRED_DOCS = Object.entries(getRequiredDriverDocs(compliance))
      .filter(([, req]) => req)
      .map(([t]) => t);
    const docs = req.userDoc.documents || [];
    const missing = REQUIRED_DOCS.filter((t) => {
      const d = docs.find((x) => x.type === t);
      return !d || d.status !== 'approved';
    });
    if (missing.length > 0) {
      return res.status(403).json({ message: `Please upload and get approval for: ${missing.join(', ')}`, missingDocs: missing });
    }
    return next();
  };

  router.post('/online', requireApproved, async (req, res, next) => {
    try {
      const online = !!req.body.online;
      const location = req.body.location || req.userDoc.location;
      if (online) {
        const compliance = await getComplianceConfig();
        const status = cashStatus(req.userDoc, compliance);
        if (status.overdue) {
          return res.status(403).json({
            message: `You owe ₹${status.due} in cash settlements (held for ${status.overdueByHours} hrs). Please deposit the platform's cash share via UPI before going online.`,
            cash: status,
          });
        }
      }
      const driver = await User.findByIdAndUpdate(
        req.user.id,
        { isOnline: online, location },
        { new: true }
      ).select('-password');
      res.json({ user: driver.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/location', requireApproved, async (req, res, next) => {
    try {
      const { lat, lng } = req.body;
      if (lat == null || lng == null) return res.status(400).json({ message: 'lat/lng required' });
      const driver = await User.findByIdAndUpdate(
        req.user.id,
        { 'location.lat': lat, 'location.lng': lng },
        { new: true }
      ).select('-password');
      res.json({ user: driver.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  // Acknowledge the driver training modules (GoI aggregator compliance).
  router.post('/training-ack', requireAuth, async (req, res, next) => {
    try {
      const driver = await User.findByIdAndUpdate(
        req.user.id,
        { trainingAcknowledgedAt: new Date() },
        { new: true }
      ).select('-password');
      res.json({ user: driver.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  const assignedRide = async (req, res, next) => {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (String(ride.driver) !== String(req.user.id)) {
      return res.status(403).json({ message: 'This ride is not assigned to you' });
    }
    req.ride = ride;
    return next();
  };

  router.post('/accept/:id', requireApproved, async (req, res, next) => {
    try {
      // applyAssignment mutates the ride, absorbing the driver's vehicle capacity
      // for shared trips and re-pricing booked seats.
      const applyAssignment = (ride) => {
        clearDispatchTimer(ride._id);
        ride.driver = req.user.id;
        ride.status = 'assigned';
        ride.acceptedAt = new Date();
        ride.pendingDrivers = [];
        // Fleet payout routing: when the accepting driver belongs to a fleet, the
        // platform share is settled with the fleet owner rather than the driver.
        ride.fleetOwnerId = req.userDoc?.fleetOwnerId || null;
        ride.payoutEntity = req.userDoc?.fleetOwnerId ? 'fleet_owner' : 'driver';

        // Seat-based shared trip: the real capacity is the driver's vehicle,
        // so absorb it (never below seats already booked) and re-price per seat.
        // Reserved trips are charged as a whole vehicle — keep the booked fare.
        if (ride.shared?.enabled && ride.shared?.mode !== 'reserved' && !ride.shared?.reserved) {
          const declared = Number(req.userDoc?.vehicleDetails?.seats);
          const capacity = Math.max(
            Number.isFinite(declared) && declared > 0 ? Math.round(declared) : 1,
            ride.shared.seatsTaken || 1,
            (ride.occupants || []).reduce((sum, o) => sum + (o.seats || 1), 0) || 1
          );
          ride.shared.seatCount = capacity;
          ride.shared.availableSeats = Math.max(0, capacity - ride.shared.seatsTaken);
          const tripTotal = ride.fareBreakup?.tripTotal || ride.fareBreakup?.total || ride.fare || 1;
          const perSeat = Math.max(1, Math.round(tripTotal / capacity));
          ride.shared.perSeatFare = perSeat;
          (ride.occupants || []).forEach((o) => {
            o.fare = perSeat * (o.seats || 1);
            if (o.payment?.status === 'pending') o.payment.amount = o.fare;
          });
          // Promo discount stays with the ride creator after re-pricing.
          const promoDisc = ride.fareBreakup?.promoDiscount || 0;
          const creatorOcc = ride.occupants.find((o) => String(o.rider) === String(ride.rider));
          if (creatorOcc && promoDisc > 0) {
            creatorOcc.fare = Math.max(0, creatorOcc.fare - promoDisc);
            if (creatorOcc.payment?.status === 'pending') creatorOcc.payment.amount = creatorOcc.fare;
          }
          ride.fare = creatorOcc ? creatorOcc.fare : ride.fare;
          if (ride.payment.status === 'pending') ride.payment.amount = ride.fare;
          ride.markModified('occupants');
        }
      };

      let ride = await Ride.findById(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });
      if (ride.status !== 'requested') {
        return res.status(400).json({ message: 'This ride is no longer available' });
      }
      if (!req.userDoc.isOnline || req.userDoc.currentRide) {
        return res.status(400).json({ message: 'You must be online with no active ride to accept' });
      }
      // Ambulance calls may only be accepted by a driver whose compliance for the
      // ride's state + service level is active — re-checked at accept time so a
      // unit that lapsed after dispatch can never take the call.
      if (ride.category === 'ambulance' || isAmbulanceVehicle(ride.vehicleType)) {
        const eligible = await ambulanceEligibleDriverIds({
          stateCode: ride.stateCode,
          ambulanceType: ride.ambulanceType || 'BLS',
        });
        if (!eligible.has(String(req.user.id))) {
          return res.status(403).json({ message: 'Your ambulance compliance is not active for this call. Renew your documents before accepting.' });
        }
      }
      const acceptCompliance = await getComplianceConfig();
      const acceptCash = cashStatus(req.userDoc, acceptCompliance);
      if (acceptCash.overdue) {
        return res.status(403).json({ message: `Cash settlement overdue (₹${acceptCash.due} for ${acceptCash.overdueByHours} hrs). Deposit via UPI before accepting rides.` });
      }

      applyAssignment(ride);

      // Retry a few times on a Mongoose optimistic-concurrency conflict: the
      // concurrent background dispatch (socket.js) may have just bumped the
      // ride's __v. Re-fetch each time and bail if it is no longer open.
      let saved = false;
      let lastErr = null;
      for (let attempt = 0; attempt < 4 && !saved; attempt += 1) {
        try {
          await ride.save();
          saved = true;
        } catch (err) {
          lastErr = err;
          if (!err || err.name !== 'VersionError') throw err;
          ride = await Ride.findById(req.params.id);
          if (!ride) return res.status(404).json({ message: 'Ride not found' });
          if (ride.status !== 'requested') {
            return res.status(400).json({ message: 'This ride is no longer available' });
          }
          applyAssignment(ride);
        }
      }
      if (!saved) throw lastErr || new Error('Could not accept ride');

      await User.findByIdAndUpdate(req.user.id, { currentRide: ride._id, isOnline: true });

      const dto = await toRideDTO(ride._id);
      emitRideUpdate(io, ride._id);
      notifyUser({
        io,
        userId: ride.rider,
        type: 'ride',
        title: 'Driver accepted your ride',
        message: `${req.userDoc.name || 'Your driver'} is on their way. Tap to track live.`,
        link: '/ride',
      });
      res.json({ ride: dto });
    } catch (err) {
      next(err);
    }
  });

  router.post('/reject/:id', requireApproved, async (req, res, next) => {
    try {
      const ride = await Ride.findById(req.params.id);
      if (!ride || ride.status !== 'requested') {
        return res.status(200).json({ message: 'ok' });
      }
      if (!ride.pendingDrivers.length) {
        return res.status(200).json({ message: 'ok' });
      }
      // Hand the request to the next nearest driver right away
      await dispatchNext(io, ride._id);
      res.json({ message: 'Rejected' });
    } catch (err) {
      next(err);
    }
  });

  router.post('/arrived/:id', requireApproved, assignedRide, async (req, res, next) => {
    try {
      if (req.ride.status !== 'assigned') {
        return res.status(400).json({ message: `Ride is ${req.ride.status}` });
      }
      req.ride.status = 'driver_arrived';
      req.ride.arrivedAt = new Date();
      await req.ride.save();
      emitRideUpdate(io, req.ride._id);
      res.json({ ride: await toRideDTO(req.ride._id) });
    } catch (err) {
      next(err);
    }
  });

  // Per-trip identity verification: the driver's live selfie must match the
  // face enrolled at registration before they can start the trip.
  router.post('/verify-face/:id', requireApproved, assignedRide, async (req, res, next) => {
    try {
      const { descriptor } = req.body;
      if (!Array.isArray(descriptor) || descriptor.length !== 128) {
        return res.status(400).json({ message: 'A valid 128-dimension face descriptor is required' });
      }
      const user = req.userDoc;
      if (!user.faceRegistered || !user.faceDescriptor?.length) {
        return res.status(409).json({
          message: 'No face enrolled for this account. Enroll your face in Profile to use verified trips.',
        });
      }
      if (!['assigned', 'driver_arrived'].includes(req.ride.status)) {
        return res.status(400).json({ message: `Ride is ${req.ride.status}` });
      }
      const { distance, matched } = faceMatch(user.faceDescriptor, descriptor);
      if (!matched) {
        return res.status(401).json({
          message: 'Face verification failed — selfie does not match the enrolled identity',
          distance,
        });
      }
      req.ride.driverSelfieVerifiedAt = new Date();
      await req.ride.save();
      emitRideUpdate(io, req.ride._id);
      res.json({
        matched: true,
        distance,
        verifiedAt: req.ride.driverSelfieVerifiedAt,
        ride: await toRideDTO(req.ride._id),
      });
    } catch (err) {
      next(err);
    }
  });

  // Pickup safety photo: the driver captures a selfie with the riders before
  // starting the trip. The image is stored on disk (metadata on the ride) and is
  // kept only for the configured retention window. Re-capturing replaces it.
  router.post(
    '/ride-photo/:id',
    requireApproved,
    assignedRide,
    (req, res, next) =>
      photoUpload.single('photo')(req, res, (err) => {
        if (err) {
          const message = err.code === 'LIMIT_FILE_SIZE' ? 'Photo too large (max 6 MB)' : err.message;
          return res.status(400).json({ message });
        }
        return next();
      }),
    async (req, res, next) => {
      try {
        const cleanup = () => {
          if (req.file?.filename) {
            fs.promises.unlink(path.join(TRIP_PHOTO_DIR, req.file.filename)).catch(() => {});
          }
        };
        if (!['assigned', 'driver_arrived'].includes(req.ride.status)) {
          if (req.file) await fs.promises.unlink(path.join(TRIP_PHOTO_DIR, req.file.filename)).catch(() => {});
          return res.status(400).json({ message: `Ride is ${req.ride.status}` });
        }
        if (!req.file) return res.status(400).json({ message: 'No photo uploaded' });

        const compliance = await getComplianceConfig();
        const days = Number(compliance.tripPhotoRetentionDays) > 0 ? Math.floor(Number(compliance.tripPhotoRetentionDays)) : 30;

        // Drop the previous capture, if any, so we don't leak files on retake.
        const prev = req.ride.tripPhoto?.filename;
        if (prev) {
          try {
            await fs.promises.unlink(path.join(TRIP_PHOTO_DIR, prev));
          } catch {
            /* already gone */
          }
        }

        const capturedAt = new Date();
        req.ride.tripPhoto = {
          filename: req.file.filename,
          originalName: req.file.originalname || 'trip-photo.jpg',
          mimeType: req.file.mimetype,
          size: req.file.size,
          capturedAt,
          expiresAt: new Date(capturedAt.getTime() + days * 24 * 60 * 60 * 1000),
        };
        await req.ride.save();
        emitRideUpdate(io, req.ride._id);
        res.json({ ride: await toRideDTO(req.ride._id), retentionDays: days, expiresAt: req.ride.tripPhoto.expiresAt });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post('/start/:id', requireApproved, assignedRide, async (req, res, next) => {
    try {
      if (!['assigned', 'driver_arrived'].includes(req.ride.status)) {
        return res.status(400).json({ message: `Ride is ${req.ride.status}` });
      }
      // Identity check: drivers with an enrolled face must verify with a live
      // selfie before starting each trip.
      const enrolled = req.userDoc?.faceRegistered && req.userDoc?.faceDescriptor?.length;
      if (enrolled && !req.ride.driverSelfieVerifiedAt) {
        return res.status(400).json({
          code: 'FACE_VERIFICATION_REQUIRED',
          message: 'Verify your identity with a selfie before starting this trip',
        });
      }
      // Safety check: capture a photo with the riders before the vehicle moves.
      const compliance = await getComplianceConfig();
      if (compliance.requireTripPhoto !== false && !req.ride.tripPhoto?.filename) {
        return res.status(400).json({
          code: 'TRIP_PHOTO_REQUIRED',
          message: 'Take a photo with your riders before starting the trip',
        });
      }
      req.ride.status = 'in_progress';
      req.ride.startedAt = new Date();
      await req.ride.save();
      emitRideUpdate(io, req.ride._id);
      notifyUser({
        io,
        userId: req.ride.rider,
        type: 'ride',
        title: 'Your ride started',
        message: 'Your driver is on the way to your destination. Enjoy the ride!',
        link: '/ride',
      });
      res.json({ ride: await toRideDTO(req.ride._id) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/complete/:id', requireApproved, assignedRide, async (req, res, next) => {
    try {
      if (req.ride.status !== 'in_progress') {
        return res.status(400).json({ message: `Ride is ${req.ride.status}` });
      }
      req.ride.status = 'completed';
      req.ride.completedAt = new Date();
      await req.ride.save();
      try {
        if (!req.ride.invoiceId) {
          const { generateInvoiceNumber } = await import('../utils/invoice.js');
          const { getGstConfig } = await import('../services/settings.js');
          const gstCfg = await getGstConfig();
          const invoiceNumber = await generateInvoiceNumber(gstCfg.invoicePrefix || 'STL');
          const inv = await Invoice.create({
            invoiceNumber,
            ride: req.ride._id,
            rider: req.ride.rider,
            driver: req.ride.driver,
            fleetOwner: req.ride.fleetOwnerId || null,
            payoutEntity: req.ride.payoutEntity || (req.ride.fleetOwnerId ? 'fleet_owner' : 'driver'),
            invoiceDate: req.ride.completedAt || new Date(),
            supplyDate: req.ride.completedAt || new Date(),
            operatorStateCode: gstCfg.registeredStateCode || '',
            placeOfSupplyStateCode: req.ride.fareBreakup?.placeOfSupplyStateCode || req.ride.stateCode || '',
            sacCode: req.ride.fareBreakup?.sacCode || '996412',
            vehicleType: req.ride.vehicleType || '',
            category: req.ride.category || 'taxi',
            taxableValue: req.ride.fareBreakup?.taxableValue ?? req.ride.fareBreakup?.gross ?? 0,
            cgst: req.ride.fareBreakup?.cgst ?? 0,
            sgst: req.ride.fareBreakup?.sgst ?? 0,
            igst: req.ride.fareBreakup?.igst ?? 0,
            gstTotal: req.ride.fareBreakup?.gst ?? 0,
            gstRatePct: req.ride.fareBreakup?.gstRatePct ?? 5,
            supplyType: req.ride.fareBreakup?.supplyType || 'intra',
            fareTotal: req.ride.fareBreakup?.total ?? req.ride.fare ?? 0,
            status: 'issued',
          });
          req.ride.invoiceId = inv._id;
          req.ride.invoiceNumber = inv.invoiceNumber;
          req.ride.invoiceDate = inv.invoiceDate;
          if (req.ride.payoutEntity == null) req.ride.payoutEntity = inv.payoutEntity;
          await req.ride.save();
        }
      } catch (e) { console.error('invoice gen err', e); }


      const netEarning = req.ride.fareBreakup?.driverEarnings || 0;
      // Fleet payout routing: on a fleet-operated ride the earnings accrue to the
      // fleet owner (who settles with their driver); the driver still gets the
      // completed-ride credit. Otherwise they accrue to the driver.
      const creditToFleet = req.ride.payoutEntity === 'fleet_owner' && req.ride.fleetOwnerId;
      await User.findByIdAndUpdate(req.user.id, {
        currentRide: null,
        isOnline: true,
        $inc: { totalRides: 1, ...(creditToFleet ? {} : { earnings: netEarning }) },
      });
      if (creditToFleet) {
        await User.findByIdAndUpdate(req.ride.fleetOwnerId, { $inc: { earnings: netEarning } });
      }
      emitRideUpdate(io, req.ride._id);
      const total = req.ride.fareBreakup?.total || req.ride.fare || 0;
      notifyUser({
        io,
        userId: req.ride.rider,
        type: 'payment',
        title: 'Ride completed',
        message: `Your trip is complete. Total fare ₹${total.toLocaleString('en-IN')}. Please pay your driver.`,
        link: '/history',
      });
      notifyUser({
        io,
        userId: req.user.id,
        type: 'earnings',
        title: creditToFleet ? 'Ride completed — fleet ride' : 'Ride completed — earnings added',
        message: creditToFleet
          ? `This trip's earnings of ₹${netEarning.toLocaleString('en-IN')} were credited to your fleet owner.`
          : `You earned ₹${netEarning.toLocaleString('en-IN')} for this trip.`,
        link: '/driver',
      });
      if (creditToFleet) {
        notifyUser({
          io,
          userId: req.ride.fleetOwnerId,
          type: 'earnings',
          title: 'Fleet ride completed — earnings added',
          message: `₹${netEarning.toLocaleString('en-IN')} was credited to your fleet from a ride completed by ${req.userDoc?.name || 'your driver'}.`,
          link: '/fleet',
        });
      }
      res.json({ ride: await toRideDTO(req.ride._id) });
    } catch (err) {
      next(err);
    }
  });

  // Driver confirms cash collection for a completed ride paid by cash
  router.post('/settle/:id', requireApproved, assignedRide, async (req, res, next) => {
    try {
      if (req.ride.status !== 'completed') {
        return res.status(400).json({ message: 'Ride is not completed yet' });
      }
      const anyCashPending =
        req.ride.payment.status === 'cash_pending' ||
        (req.ride.occupants || []).some((o) => o.payment?.status === 'cash_pending');
      if (!anyCashPending) {
        return res.status(400).json({ message: 'No cash payment pending on this ride' });
      }
      req.ride.payment.status = 'paid';
      req.ride.payment.paidAt = new Date();
      (req.ride.occupants || []).forEach((o) => {
        if (o.payment?.status === 'cash_pending') {
          o.payment.status = 'paid';
          o.payment.paidAt = new Date();
        }
      });
      req.ride.markModified('occupants');
      await req.ride.save();

      // Cash ledger: the driver has physically collected the rider's cash.
      // They keep their net share; the platform's commission + GST is owed back.
      const share = platformShareOf(req.ride);
      if (share > 0) {
        await addCashCollection({
          driverId: req.user.id,
          rideId: req.ride._id,
          amount: share,
          note: `Cash collected — driver keeps net share, platform share owed (commission + GST)`,
        });
      }

      emitRideUpdate(io, req.ride._id);
      res.json({ ride: await toRideDTO(req.ride._id) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/summary', async (req, res, next) => {
    try {
      const completed = await Ride.find({
        driver: req.user.id,
        status: 'completed',
      }).sort({ createdAt: -1 }).limit(20).select('fare fareBreakup payment createdAt drop pickup distanceKm');

      const totals = await Ride.aggregate([
        { $match: { driver: new mongoose.Types.ObjectId(req.user.id), status: 'completed' } },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$fareBreakup.driverEarnings' },
            count: { $sum: 1 },
          },
        },
      ]);

      const online = await User.find({
        role: 'driver',
        isOnline: true,
        driverStatus: 'approved',
      }).countDocuments();

      const compliance = await getComplianceConfig();
      const cash = cashStatus(req.userDoc, compliance);

      const payable = Math.max(0, Math.round(((req.userDoc.earnings || 0) - (req.userDoc.paidOut || 0)) * 100) / 100);
      res.json({
        completed,
        totals: totals[0] || { revenue: 0, count: 0 },
        online,
        cash,
        lifetimeEarnings: req.userDoc.earnings || 0,
        paidOut: req.userDoc.paidOut || 0,
        payable,
        payouts: (req.userDoc.payouts || [])
          .slice()
          .reverse()
          .slice(0, 10)
          .map((p) => ({ id: String(p._id), amount: p.amount, note: p.note, at: p.at })),
      });
    } catch (err) {
      next(err);
    }
  });

  // --- Vehicle details -------------------------------------------------------
  const VEHICLE_FIELDS = ['brand', 'model', 'year', 'color', 'seats', 'luggageCapacityKg', 'hasStep', 'hasCanopy', 'hasStorage', 'fuelType', 'insuranceUpto', 'permitUpto', 'engineCc', 'hasPillionSeat', 'helmetCount', 'hasTopBox'];
  const VEHICLE_TYPE_MAP = { 'toto (e-rickshaw)': 'toto', 'auto rickshaw': 'auto', 'taxi': 'taxi', 'bike taxi': 'bike', 'cab': 'taxi', 'ambulance (bls)': 'ambulance-bls', 'ambulance (als)': 'ambulance-als', 'other': 'other' };

  router.get('/vehicle', async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id).select('vehicleDetails vehicleNumber vehicleType');
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json({ vehicleDetails: user.vehicleDetails || {}, vehicleNumber: user.vehicleNumber, vehicleType: user.vehicleType });
    } catch (err) {
      next(err);
    }
  });

  router.put('/vehicle', async (req, res, next) => {
    try {
      const updates = {};
      for (const key of VEHICLE_FIELDS) {
        if (req.body[key] !== undefined) {
          updates[`vehicleDetails.${key}`] = req.body[key];
        }
      }
      if (req.body.vehicleNumber !== undefined) updates.vehicleNumber = req.body.vehicleNumber;
      if (req.body.vehicleType !== undefined) {
        const raw = String(req.body.vehicleType).trim();
        updates.vehicleType = VEHICLE_TYPE_MAP[raw.toLowerCase()] || raw.toLowerCase();
      }

      const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true }).select('-password');
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json({ message: 'Vehicle details saved', vehicleDetails: user.vehicleDetails, vehicleNumber: user.vehicleNumber, vehicleType: user.vehicleType });
    } catch (err) {
      next(err);
    }
  });

  // --- Document upload -------------------------------------------------------

  router.post('/documents', (req, res, next) => {
    const fields = [
      { name: 'aadhaar', maxCount: 1 },
      { name: 'rc', maxCount: 1 },
      { name: 'license', maxCount: 1 },
      { name: 'bank', maxCount: 1 },
      { name: 'photo', maxCount: 1 },
    ];
    upload.fields(fields)(req, res, (err) => {
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5 MB)' : err.message;
        return res.status(400).json({ message: msg });
      }
      next();
    });
  }, async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const uploaded = [];
      for (const [docType, files] of Object.entries(req.files || {})) {
        if (!files || !files.length) continue;
        const file = files[0];
        // Remove existing doc of same type
        user.documents = user.documents.filter((d) => d.type !== docType);
        user.documents.push({
          type: docType,
          filename: file.filename,
          originalName: file.originalname,
          status: 'pending',
          uploadedAt: new Date(),
        });
        uploaded.push(docType);
      }

      if (uploaded.length === 0) {
        return res.status(400).json({ message: 'No files uploaded. Use field names: aadhaar, rc, license, bank, photo' });
      }

      await user.save();
      res.json({ message: `${uploaded.length} document(s) uploaded`, documents: user.documents });
    } catch (err) {
      next(err);
    }
  });

  router.get('/documents', async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id).select('documents aadhaarNumber phoneVerified');
      if (!user) return res.status(404).json({ message: 'User not found' });
      const compliance = await getComplianceConfig();
      const requiredMap = getRequiredDriverDocs(compliance);
      const required = Object.entries(requiredMap).filter(([, r]) => r).map(([t]) => t);
      const uploaded = (user.documents || []).map((d) => d.type);
      const missing = required.filter((t) => !uploaded.includes(t));
      res.json({
        documents: user.documents || [],
        missing,
        required,
        requiredMap,
        aadhaarNumber: user.aadhaarNumber || '',
        phoneVerified: user.phoneVerified || false,
      });
    } catch (err) {
      next(err);
    }
  });

  // Stream one of the driver's own uploaded documents (authenticated; the public
  // /uploads static path is disabled so docs can only be read by their owner or an admin).
  router.get('/documents/:docId/download', async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id).select('documents');
      if (!user) return res.status(404).json({ message: 'User not found' });
      const doc = user.documents.id(req.params.docId);
      if (!doc) return res.status(404).json({ message: 'Document not found' });
      const filePath = path.join(uploadsDir, doc.filename);
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found on disk' });
      const ext = path.extname(doc.filename).toLowerCase();
      const mimeTypes = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${doc.originalName || doc.filename}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      next(err);
    }
  });

  // --- Cash settlement -------------------------------------------------------

  // Driver's cash ledger: how much of the platform's cash share they still owe
  // and a history of every collection / deposit / auto-deduction.
  router.get('/cash', async (req, res, next) => {
    try {
      const compliance = await getComplianceConfig();
      const user = await User.findById(req.user.id);
      const ledger = await CashLedger.findOne({ driver: req.user.id });
      // Simulated SMS gateway: fires once when the deadline is half used.
      const reminder = await maybeSendCashReminder(req.user.id, compliance);
      res.json({
        cashDue: user.cashDue || 0,
        cashDeposited: user.cashDeposited || 0,
        cashPendingSince: user.cashPendingSince || null,
        ...reminder.status,
        reminderSentJustNow: reminder.sent,
        entries: (ledger?.entries || [])
          .slice()
          .reverse()
          .slice(0, 50)
          .map((e) => ({
            id: e._id,
            type: e.type,
            amount: e.amount,
            rideId: e.rideId,
            note: e.note,
            createdAt: e.createdAt,
          })),
      });
    } catch (err) {
      next(err);
    }
  });

  // Driver deposits cash owed back to the platform via UPI.
  router.post('/cash/deposit', requireApproved, async (req, res, next) => {
    try {
      const amount = Math.round(Number(req.body.amount) * 100) / 100;
      const upiRef = String(req.body.upiRef || '').trim().slice(0, 60);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Enter a valid deposit amount' });
      }
      const user = await User.findById(req.user.id);
      const applied = Math.min(amount, user.cashDue || 0);
      if (applied <= 0) {
        return res.status(400).json({ message: 'You have no cash settlement pending' });
      }
      if (amount > applied) {
        return res.status(400).json({ message: `Amount exceeds your pending cash due (₹${applied}). Maximum you can deposit now: ₹${applied}.` });
      }
      if (!upiRef) {
        return res.status(400).json({ message: 'Enter the UPI reference (UTR) of your payment' });
      }
      const result = await settleCashDue({
        driverId: req.user.id,
        amount,
        rideId: null,
        source: 'deposit',
        note: upiRef ? `UPI deposit · ref ${upiRef}` : 'UPI deposit',
      });
      if (upiRef) {
        await User.updateOne({ _id: req.user.id, cashDue: { $lte: 0.005 } }, { $set: { cashReminderSentAt: null } });
      }
      const full = await User.findById(req.user.id);
      res.json({ message: `Deposit of ₹${applied} recorded. Outstanding cash due: ₹${full.cashDue}.`, ...result, cashDue: full.cashDue, cashDeposited: full.cashDeposited });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
