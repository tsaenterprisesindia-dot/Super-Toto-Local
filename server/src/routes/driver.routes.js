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
import { CashLedger } from '../models/CashLedger.js';
import { addCashCollection, settleCashDue, cashStatus, platformShareOf } from '../services/cashSettlement.js';

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
          const creatorOcc = ride.occupants.find((o) => String(o.rider) === String(ride.rider));
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
      const acceptCompliance = await getComplianceConfig();
      const acceptCash = cashStatus(req.userDoc, acceptCompliance);
      if (acceptCash.overdue) {
        return res.status(403).json({ message: `Cash settlement overdue (₹${acceptCash.due} for ${acceptCash.overdueByHours} hrs). Deposit via UPI before accepting rides.` });
      }

      applyAssignment(ride);

      // Retry once on a Mongoose optimistic-concurrency conflict: the concurrent
      // background dispatch (socket.js) may have just bumped the ride's __v.
      try {
        await ride.save();
      } catch (err) {
        if (err && err.name === 'VersionError') {
          ride = await Ride.findById(req.params.id);
          if (!ride) return res.status(404).json({ message: 'Ride not found' });
          applyAssignment(ride);
          await ride.save();
        } else {
          throw err;
        }
      }

      await User.findByIdAndUpdate(req.user.id, { currentRide: ride._id, isOnline: true });

      const dto = await toRideDTO(ride._id);
      emitRideUpdate(io, ride._id);
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

  router.post('/start/:id', requireApproved, assignedRide, async (req, res, next) => {
    try {
      if (!['assigned', 'driver_arrived'].includes(req.ride.status)) {
        return res.status(400).json({ message: `Ride is ${req.ride.status}` });
      }
      req.ride.status = 'in_progress';
      req.ride.startedAt = new Date();
      await req.ride.save();
      emitRideUpdate(io, req.ride._id);
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

      await User.findByIdAndUpdate(req.user.id, {
        currentRide: null,
        isOnline: true,
        $inc: {
          totalRides: 1,
          earnings: req.ride.fareBreakup.driverEarnings || 0,
        },
      });
      emitRideUpdate(io, req.ride._id);
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

      res.json({
        completed,
        totals: totals[0] || { revenue: 0, count: 0 },
        online,
        cash,
      });
    } catch (err) {
      next(err);
    }
  });

  // --- Vehicle details -------------------------------------------------------
  const VEHICLE_FIELDS = ['brand', 'model', 'year', 'color', 'seats', 'luggageCapacityKg', 'hasStep', 'hasCanopy', 'hasStorage', 'fuelType', 'insuranceUpto', 'permitUpto', 'engineCc', 'hasPillionSeat', 'helmetCount', 'hasTopBox'];
  const VEHICLE_TYPE_MAP = { 'toto (e-rickshaw)': 'toto', 'auto rickshaw': 'auto', 'taxi': 'taxi', 'bike taxi': 'bike', 'cab': 'taxi', 'other': 'other' };

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

  // --- Cash settlement -------------------------------------------------------

  // Driver's cash ledger: how much of the platform's cash share they still owe
  // and a history of every collection / deposit / auto-deduction.
  router.get('/cash', async (req, res, next) => {
    try {
      const compliance = await getComplianceConfig();
      const user = await User.findById(req.user.id);
      const ledger = await CashLedger.findOne({ driver: req.user.id });
      res.json({
        cashDue: user.cashDue || 0,
        cashDeposited: user.cashDeposited || 0,
        cashPendingSince: user.cashPendingSince || null,
        ...cashStatus(user, compliance),
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
        note: `UPI deposit · ref ${upiRef}`,
      });
      const full = await User.findById(req.user.id);
      res.json({ message: `Deposit of ₹${applied} recorded. Outstanding cash due: ₹${full.cashDue}.`, ...result, cashDue: full.cashDue, cashDeposited: full.cashDeposited });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
