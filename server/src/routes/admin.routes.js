import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import User from '../models/User.js';
import Ride from '../models/Ride.js';
import { CashLedger } from '../models/CashLedger.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { toCashDTO } from '../services/cashSettlement.js';
import { getPricingConfig, savePricingConfig, getVehicleRatesConfig, saveVehicleRatesConfig, getFeedbackConfig, saveFeedbackConfig, getAdsConfig, saveAdsConfig, getSafetyTipsConfig, saveSafetyTipsConfig, getBikeTaxiConfig, saveBikeTaxiConfig, getUpiConfig, saveUpiConfig, getContactConfig, saveContactConfig, getChatbotConfig, saveChatbotConfig, getSeatBookingConfig, saveSeatBookingConfig, getComplianceConfig, saveComplianceConfig, getTrainingConfig, saveTrainingConfig, INDIA_STATES, getStateFares, getStateFarePolicy, saveStateFarePolicy } from '../services/settings.js';
import { PRICING, VEHICLE_TYPES } from '../utils/pricing.js';

export default function adminRoutes() {
  const router = Router();
  router.use(requireAuth, requireRole('admin'));

  router.get('/stats', async (_req, res, next) => {
    try {
      const [riders, drivers, hiddenRiders, hiddenDrivers, suspendedRiders, suspendedDrivers, rides, online, completed, cancelled, methods, collected] =
        await Promise.all([
          User.countDocuments({ role: 'rider' }),
          User.countDocuments({ role: 'driver' }),
          User.countDocuments({ role: 'rider', isHidden: true }),
          User.countDocuments({ role: 'driver', isHidden: true }),
          User.countDocuments({ role: 'rider', 'suspension.active': true }),
          User.countDocuments({ role: 'driver', 'suspension.active': true }),
          Ride.countDocuments(),
          User.countDocuments({ role: 'driver', isOnline: true, driverStatus: 'approved', isHidden: false, 'suspension.active': false }),
          Ride.aggregate([
            { $match: { status: 'completed' } },
            {
              $group: {
                _id: null,
                revenue: { $sum: '$fare' },
                paid: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, '$fare', 0] } },
                avgFare: { $avg: '$fare' },
                commission: { $sum: '$fareBreakup.commission' },
                gst: { $sum: '$fareBreakup.gst' },
                driverEarnings: { $sum: '$fareBreakup.driverEarnings' },
              },
            },
          ]),
          Ride.aggregate([
            { $match: { status: 'cancelled_by_rider' } },
            {
              $group: {
                _id: null,
                fees: { $sum: '$cancellationFee' },
                paidFees: {
                  $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, '$cancellationFee', 0] },
                },
              },
            },
          ]),
          Ride.aggregate([
            { $match: { status: 'completed' } },
            {
              $group: {
                _id: '$payment.method',
                rides: { $sum: 1 },
                amount: { $sum: '$fare' },
              },
            },
          ]),
          Ride.aggregate([
            {
              $match: {
                status: { $in: ['completed', 'cancelled_by_rider'] },
                payment: { $ne: null },
              },
            },
            {
              $group: {
                _id: null,
                outstanding: {
                  $sum: {
                    $cond: [
                      { $in: ['$payment.status', ['pending', 'cash_pending']] },
                      '$payment.amount',
                      0,
                    ],
                  },
                },
                pendingCount: {
                  $sum: {
                    $cond: [{ $in: ['$payment.status', ['pending', 'cash_pending']] }, 1, 0],
                  },
                },
              },
            },
          ]),
        ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ridesToday = await Ride.countDocuments({ createdAt: { $gte: today } });

      const methodBreakdown = {
        UPI: methods.find((m) => m._id === 'UPI') || { rides: 0, amount: 0 },
        Cash: methods.find((m) => m._id === 'Cash') || { rides: 0, amount: 0 },
        Card: methods.find((m) => m._id === 'Card') || { rides: 0, amount: 0 },
      };

      res.json({
        stats: {
          riders,
          drivers,
          hiddenRiders,
          hiddenDrivers,
          suspendedRiders,
          suspendedDrivers,
          rides,
          ridesToday,
          online,
          revenue: completed[0]?.revenue || 0,
          paid: completed[0]?.paid || 0,
          avgFare: Math.round(completed[0]?.avgFare || 0),
          commission: completed[0]?.commission || 0,
          gst: completed[0]?.gst || 0,
          driverEarnings: completed[0]?.driverEarnings || 0,
          cancellationFees: cancelled[0]?.fees || 0,
          cancellationFeesPaid: cancelled[0]?.paidFees || 0,
          platformRevenue:
            (completed[0]?.commission || 0) +
            (completed[0]?.gst || 0) +
            (cancelled[0]?.paidFees || 0),
          outstanding: collected[0]?.outstanding || 0,
          pendingCount: collected[0]?.pendingCount || 0,
          methods: methodBreakdown,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/drivers', async (_req, res, next) => {
    try {
      const drivers = await User.find({ role: 'driver' })
        .select('-password -resetCode -resetExpires -faceDescriptor')
        .sort({ createdAt: -1 })
        .lean();

      const counts = await Ride.aggregate([
        { $match: { driver: { $ne: null } } },
        { $group: { _id: '$driver', total: { $sum: 1 } } },
      ]);
      const map = Object.fromEntries(counts.map((c) => [String(c._id), c.total]));

      res.json({ drivers: drivers.map((d) => ({ ...d, rideCount: map[String(d._id)] || 0 })) });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/drivers/:id', async (req, res, next) => {
    try {
      const { action } = req.body; // approve | block | unblock | hide | unhide
      const driver = await User.findById(req.params.id);
      if (!driver || driver.role !== 'driver') {
        return res.status(404).json({ message: 'Driver not found' });
      }
      if (action === 'approve') driver.driverStatus = 'approved';
      else if (action === 'block') driver.driverStatus = 'blocked';
      else if (action === 'unblock') driver.driverStatus = 'approved';
      else if (action === 'hide') driver.isHidden = true;
      else if (action === 'unhide') driver.isHidden = false;
      else if (action === 'reinstate') {
        driver.isHidden = false;
        driver.suspension = { active: false, until: null, reason: '', issuedBy: null, issuedAt: null };
        driver.driverStatus = 'approved';
      }
      else return res.status(400).json({ message: 'Unknown action' });

      if (driver.driverStatus !== 'approved') driver.isOnline = false;
      if (driver.isHidden) driver.isOnline = false;
      await driver.save();
      res.json({ driver: driver.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  // --- Enforcement: warn, suspend, reinstate, clear-warnings ----------------

  // Warn a user (rider or driver). The warning is visible to the user as an
  // in-app banner. Multiple warnings are cumulative and may lead to suspension.
  router.post('/warn/:id', async (req, res, next) => {
    try {
      const { message } = req.body || {};
      if (!message || !message.trim()) return res.status(400).json({ message: 'Warning message is required' });
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      user.warnings.push({ message: message.trim(), issuedAt: new Date(), issuedBy: req.userDoc._id });
      await user.save();
      res.json({ user: user.toSafeJSON(), message: 'Warning issued' });
    } catch (err) { next(err); }
  });

  // Suspend (ban) a user for a specific period or permanently.
  //   until: ISO date string  → temporary suspension (auto-expires)
  //   until: null / omitted   → permanent suspension until admin reinstates
  //   settlementConfirmed: true → required when the user has outstanding financials
  router.post('/suspend/:id', async (req, res, next) => {
    try {
      const { reason, until, settlementConfirmed } = req.body || {};
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (user.role === 'admin') return res.status(400).json({ message: 'Admin accounts cannot be suspended' });

      // --- Financial settlement gate ---
      // For permanent suspensions (or any suspension of a user with outstanding
      // financials), require explicit settlement confirmation from the admin.
      const isPermanent = !until;
      let outstandingAmount = 0;
      if (user.role === 'rider') {
        const outstanding = await Ride.aggregate([
          { $match: { rider: user._id, status: { $in: ['completed', 'cancelled_by_rider'] }, payment: { $ne: null }, 'payment.status': { $in: ['pending', 'cash_pending'] } } },
          { $group: { _id: null, total: { $sum: '$payment.amount' }, count: { $sum: 1 } } },
        ]);
        outstandingAmount = outstanding[0]?.total || 0;
      } else if (user.role === 'driver') {
        outstandingAmount = user.earnings || 0; // pending payout
      }

      if (outstandingAmount > 0 && !settlementConfirmed) {
        return res.status(409).json({
          message: `This user has ₹${outstandingAmount.toLocaleString('en-IN')} in outstanding financials. Confirm settlement before suspending.`,
          outstandingAmount,
          requiresSettlement: true,
        });
      }

      user.suspension = {
        active: true,
        until: until ? new Date(until) : null,
        reason: (reason || '').trim() || 'Violations of terms of service',
        issuedBy: req.userDoc._id,
        issuedAt: new Date(),
      };
      user.isOnline = false; // force offline on suspension
      await user.save();
      res.json({ user: user.toSafeJSON(), message: 'User suspended' });
    } catch (err) { next(err); }
  });

  // Reinstate a suspended / hidden user.
  // Clears suspension, isHidden, and (for drivers) resets to approved.
  router.post('/reinstate/:id', async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      user.suspension = { active: false, until: null, reason: '', issuedBy: null, issuedAt: null };
      user.isHidden = false;
      if (user.role === 'driver') user.driverStatus = 'approved';
      await user.save();
      res.json({ user: user.toSafeJSON(), message: 'User reinstated' });
    } catch (err) { next(err); }
  });

  // Remove a specific warning from a user's record.
  router.delete('/warnings/:userId/:warningId', async (req, res, next) => {
    try {
      const user = await User.findById(req.params.userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      const idx = user.warnings.findIndex((w) => String(w._id) === req.params.warningId);
      if (idx === -1) return res.status(404).json({ message: 'Warning not found' });
      user.warnings.splice(idx, 1);
      await user.save();
      res.json({ user: user.toSafeJSON(), message: 'Warning removed' });
    } catch (err) { next(err); }
  });

  // Clear all warnings for a user.
  router.delete('/warnings/:userId', async (req, res, next) => {
    try {
      const user = await User.findById(req.params.userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      user.warnings = [];
      await user.save();
      res.json({ user: user.toSafeJSON(), message: 'All warnings cleared' });
    } catch (err) { next(err); }
  });

  // --- End enforcement -----------------------------------------------------

  // Financial summary for a user: outstanding dues for riders, pending payout
  // for drivers. Used by the admin to verify settlement before suspension.
  router.get('/financial-summary/:id', async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      if (user.role === 'rider') {
        // Outstanding ride payments: paid via digital method but still pending, or cash not yet collected.
        const outstanding = await Ride.aggregate([
          {
            $match: {
              rider: user._id,
              status: { $in: ['completed', 'cancelled_by_rider'] },
              payment: { $ne: null },
              'payment.status': { $in: ['pending', 'cash_pending'] },
            },
          },
          {
            $group: {
              _id: null,
              totalOutstanding: { $sum: '$payment.amount' },
              rideCount: { $sum: 1 },
              rides: { $push: { _id: '$_id', fare: '$fare', status: '$status', paymentStatus: '$payment.status', method: '$payment.method' } },
            },
          },
        ]);

        const totalSpent = await Ride.aggregate([
          { $match: { rider: user._id, status: 'completed', 'payment.status': 'paid' } },
          { $group: { _id: null, total: { $sum: '$fare' } } },
        ]);

        res.json({
          role: 'rider',
          totalOutstanding: outstanding[0]?.totalOutstanding || 0,
          outstandingRides: outstanding[0]?.rideCount || 0,
          outstandingDetails: outstanding[0]?.rides || [],
          totalSpent: totalSpent[0]?.total || 0,
        });
      } else if (user.role === 'driver') {
        // Driver earnings: total earned from completed rides.
        const earnings = await Ride.aggregate([
          { $match: { driver: user._id, status: 'completed' } },
          {
            $group: {
              _id: null,
              totalEarned: { $sum: '$fareBreakup.driverEarnings' },
              totalCommission: { $sum: '$fareBreakup.commission' },
              totalGst: { $sum: '$fareBreakup.gst' },
              rideCount: { $sum: 1 },
            },
          },
        ]);

        // Wallet balance = earnings recorded on user minus what has been paid out.
        const walletBalance = user.earnings || 0;

        res.json({
          role: 'driver',
          totalEarned: earnings[0]?.totalEarned || 0,
          totalCommission: earnings[0]?.totalCommission || 0,
          totalGst: earnings[0]?.totalGst || 0,
          completedRides: earnings[0]?.rideCount || 0,
          walletBalance,
          // pending payout = wallet balance (what the driver should receive)
          pendingPayout: walletBalance,
        });
      } else {
        res.json({ role: 'admin', totalOutstanding: 0, pendingPayout: 0 });
      }
    } catch (err) { next(err); }
  });

  // --- End financial settlement --------------------------------------------

  // --- Driver document management -------------------------------------------

  router.get('/drivers/:id/documents', async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id).select('name documents driverStatus vehicleType vehicleNumber aadhaarNumber');
      if (!user || user.role !== 'driver') return res.status(404).json({ message: 'Driver not found' });
      res.json({ driver: { name: user.name, driverStatus: user.driverStatus, vehicleType: user.vehicleType, vehicleNumber: user.vehicleNumber, aadhaarNumber: user.aadhaarNumber || '' }, documents: user.documents || [] });
    } catch (err) { next(err); }
  });

  router.patch('/drivers/:id/documents/:docId', async (req, res, next) => {
    try {
      const { action, rejectionReason } = req.body;
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ message: 'Action must be "approve" or "reject"' });
      }
      const user = await User.findById(req.params.id);
      if (!user || user.role !== 'driver') return res.status(404).json({ message: 'Driver not found' });

      const doc = user.documents.id(req.params.docId);
      if (!doc) return res.status(404).json({ message: 'Document not found' });

      doc.status = action === 'approve' ? 'approved' : 'rejected';
      doc.reviewedAt = new Date();
      doc.reviewedBy = req.userDoc._id;
      if (action === 'reject') doc.rejectionReason = (rejectionReason || '').trim() || 'Does not meet requirements';

      await user.save();
      res.json({ document: doc, message: `Document ${action === 'approve' ? 'approved' : 'rejected'}` });
    } catch (err) { next(err); }
  });

  router.get('/drivers/:id/documents/:docId/download', async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id).select('documents');
      if (!user) return res.status(404).json({ message: 'Driver not found' });
      const doc = user.documents.id(req.params.docId);
      if (!doc) return res.status(404).json({ message: 'Document not found' });

      const filePath = path.join(process.cwd(), 'uploads', doc.filename);
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found on disk' });

      const ext = path.extname(doc.filename).toLowerCase();
      const mimeTypes = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${doc.originalName || doc.filename}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (err) { next(err); }
  });

  // --- End driver document management ---------------------------------------

  // --- Rider document management --------------------------------------------

  router.get('/riders/:id/documents', async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id).select('name documents aadhaarNumber phoneVerified aadhaarVerified');
      if (!user || user.role !== 'rider') return res.status(404).json({ message: 'Rider not found' });
      res.json({ rider: { name: user.name, aadhaarNumber: user.aadhaarNumber, phoneVerified: user.phoneVerified, aadhaarVerified: user.aadhaarVerified }, documents: user.documents || [] });
    } catch (err) { next(err); }
  });

  router.patch('/riders/:id/documents/:docId', async (req, res, next) => {
    try {
      const { action, rejectionReason } = req.body;
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ message: 'Action must be "approve" or "reject"' });
      }
      const user = await User.findById(req.params.id);
      if (!user || user.role !== 'rider') return res.status(404).json({ message: 'Rider not found' });

      const doc = user.documents.id(req.params.docId);
      if (!doc) return res.status(404).json({ message: 'Document not found' });

      doc.status = action === 'approve' ? 'approved' : 'rejected';
      doc.reviewedAt = new Date();
      doc.reviewedBy = req.userDoc._id;
      if (action === 'reject') doc.rejectionReason = (rejectionReason || '').trim() || 'Does not meet requirements';

      if (doc.type === 'aadhaar' && action === 'approve') {
        user.aadhaarVerified = true;
      }

      await user.save();
      res.json({ document: doc, message: `Document ${action === 'approve' ? 'approved' : 'rejected'}` });
    } catch (err) { next(err); }
  });

  router.get('/riders/:id/documents/:docId/download', async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id).select('documents');
      if (!user) return res.status(404).json({ message: 'Rider not found' });
      const doc = user.documents.id(req.params.docId);
      if (!doc) return res.status(404).json({ message: 'Document not found' });

      const filePath = path.join(process.cwd(), 'uploads', doc.filename);
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found on disk' });

      const ext = path.extname(doc.filename).toLowerCase();
      const mimeTypes = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${doc.originalName || doc.filename}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (err) { next(err); }
  });

  // --- End rider document management ----------------------------------------

  router.get('/riders', async (_req, res, next) => {
    try {
      const riders = await User.find({ role: 'rider' })
        .select('-password -resetCode -resetExpires -faceDescriptor')
        .sort({ createdAt: -1 });
      res.json({ riders });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/riders/:id', async (req, res, next) => {
    try {
      const { action } = req.body; // hide | unhide | reinstate
      const rider = await User.findById(req.params.id);
      if (!rider || rider.role !== 'rider') {
        return res.status(404).json({ message: 'Rider not found' });
      }
      if (action === 'hide') rider.isHidden = true;
      else if (action === 'unhide') rider.isHidden = false;
      else if (action === 'reinstate') {
        rider.isHidden = false;
        rider.suspension = { active: false, until: null, reason: '', issuedBy: null, issuedAt: null };
      }
      else return res.status(400).json({ message: 'Unknown action' });

      await rider.save();
      res.json({ rider: rider.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.get('/rides', async (_req, res, next) => {
    try {
      const rides = await Ride.find()
        .sort({ createdAt: -1 })
        .limit(100)
        .populate('rider', 'name email')
        .populate('driver', 'name vehicleNumber');
      res.json({ rides });
    } catch (err) {
      next(err);
    }
  });

  // --- Vehicle rate chart (admin only) ---
  router.get('/vehicle-rates', async (_req, res, next) => {
    try {
      const rates = await getVehicleRatesConfig();
      res.json({ vehicleTypes: VEHICLE_TYPES, rates });
    } catch (err) { next(err); }
  });

  router.put('/vehicle-rates', async (req, res, next) => {
    try {
      const rates = await saveVehicleRatesConfig(req.body);
      res.json({ rates, message: 'Vehicle rates updated' });
    } catch (err) { next(err); }
  });

  // Admin-editable pricing configuration (admin only, enforced by the router guard).
  router.get('/settings', async (_req, res, next) => {
    try {
      res.json({ settings: await getPricingConfig(), defaults: { ...PRICING } });
    } catch (err) {
      next(err);
    }
  });

  router.put('/settings', async (req, res, next) => {
    try {
      const settings = await savePricingConfig(req.body);
      res.json({ settings, message: 'Pricing settings updated' });
    } catch (err) {
      next(err);
    }
  });

  // --- Feedback / Review configuration (admin only) ---
  router.get('/feedback-config', async (_req, res, next) => {
    try {
      res.json({ feedbackConfig: await getFeedbackConfig() });
    } catch (err) { next(err); }
  });

  router.put('/feedback-config', async (req, res, next) => {
    try {
      const feedbackConfig = await saveFeedbackConfig(req.body);
      res.json({ feedbackConfig, message: 'Feedback config updated' });
    } catch (err) { next(err); }
  });

  // --- Ads configuration (admin only) ---
  router.get('/ads-config', async (_req, res, next) => {
    try {
      res.json({ adsConfig: await getAdsConfig() });
    } catch (err) { next(err); }
  });

  router.put('/ads-config', async (req, res, next) => {
    try {
      const adsConfig = await saveAdsConfig(req.body);
      res.json({ adsConfig, message: 'Ads config updated' });
    } catch (err) { next(err); }
  });

  // --- Safety Tips configuration (admin only) ---
  router.get('/safety-tips', async (_req, res, next) => {
    try {
      res.json({ safetyTips: await getSafetyTipsConfig() });
    } catch (err) { next(err); }
  });

  router.put('/safety-tips', async (req, res, next) => {
    try {
      const safetyTips = await saveSafetyTipsConfig(req.body);
      res.json({ safetyTips, message: 'Safety tips config updated' });
    } catch (err) { next(err); }
  });

  // --- Bike Taxi configuration (admin only) ---
  router.get('/bike-taxi', async (_req, res, next) => {
    try {
      res.json({ bikeTaxiConfig: await getBikeTaxiConfig() });
    } catch (err) { next(err); }
  });

  router.put('/bike-taxi', async (req, res, next) => {
    try {
      const bikeTaxiConfig = await saveBikeTaxiConfig(req.body);
      res.json({ bikeTaxiConfig, message: 'Bike taxi config updated' });
    } catch (err) { next(err); }
  });

  // --- CSV export of all user verification data ---
  router.get('/export/users', async (_req, res, next) => {
    try {
      const users = await User.find({})
        .select('-password -resetCode -resetExpires -faceDescriptor')
        .sort({ createdAt: -1 })
        .lean();

      const DOC_LABELS = { aadhaar: 'Aadhaar', rc: 'Vehicle RC', license: 'Driving License', bank: 'Bank Details', photo: 'Photo', pcc: 'Police Clearance', insurance: 'Insurance', puc: 'PUC' };

      const header = [
        'Name', 'Email', 'Phone', 'Role',
        'Aadhaar Number', 'Phone Verified', 'Aadhaar Verified',
        'Vehicle Type', 'Vehicle Number', 'Driver Status',
        'Terms Accepted', 'Privacy Consent', 'Aggregator Agreement', 'Training Ack', 'Account Status',
        'Aadhaar Doc', 'RC Doc', 'License Doc', 'Bank Doc', 'Photo Doc', 'PCC Doc',
        'Total Rides', 'Earnings', 'Rating',
        'Registered At',
      ];

      const escapeCsv = (val) => {
        const s = String(val == null ? '' : val);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };

      const rows = users.map((u) => {
        const docStatus = {};
        (u.documents || []).forEach((d) => { docStatus[d.type] = d.status; });

        let accountStatus = 'Active';
        if (u.isHidden) accountStatus = 'Hidden';
        else if (u.suspension?.active) accountStatus = 'Suspended';

        return [
          u.name, u.email || '', u.phone || '', u.role,
          u.aadhaarNumber || '', u.phoneVerified ? 'Yes' : 'No', u.aadhaarVerified ? 'Yes' : 'No',
          u.vehicleType || '', u.vehicleNumber || '', u.driverStatus || '',
          u.termsAcceptedAt ? new Date(u.termsAcceptedAt).toLocaleDateString('en-IN') : 'No',
          u.privacyConsentAt ? new Date(u.privacyConsentAt).toLocaleDateString('en-IN') : 'No',
          u.aggregatorAgreementAcceptedAt ? new Date(u.aggregatorAgreementAcceptedAt).toLocaleDateString('en-IN') : 'No',
          u.trainingAcknowledgedAt ? new Date(u.trainingAcknowledgedAt).toLocaleDateString('en-IN') : 'No',
          accountStatus,
          docStatus.aadhaar || '—', docStatus.rc || '—', docStatus.license || '—', docStatus.bank || '—', docStatus.photo || '—', docStatus.pcc || '—',
          u.totalRides || 0, u.earnings || 0, u.rating || 5,
          u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '',
        ];
      });

      const csv = [header.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="supertoto_users_export_${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  });

  // --- UPI Payment Configuration (admin only) ---
  router.get('/upi-config', async (_req, res, next) => {
    try {
      res.json({ upiConfig: await getUpiConfig() });
    } catch (err) { next(err); }
  });

  router.put('/upi-config', async (req, res, next) => {
    try {
      const upiConfig = await saveUpiConfig(req.body);
      res.json({ upiConfig, message: 'UPI settings updated' });
    } catch (err) { next(err); }
  });

  // --- Contact / Helpline Configuration (admin only) ---
  router.get('/contact-config', async (_req, res, next) => {
    try {
      res.json({ contactConfig: await getContactConfig() });
    } catch (err) { next(err); }
  });

  router.put('/contact-config', async (req, res, next) => {
    try {
      const contactConfig = await saveContactConfig(req.body);
      res.json({ contactConfig, message: 'Contact settings updated' });
    } catch (err) { next(err); }
  });

  // --- Chatbot Configuration (admin only) ---
  router.get('/chatbot-config', async (_req, res, next) => {
    try {
      res.json({ chatbotConfig: await getChatbotConfig() });
    } catch (err) { next(err); }
  });

  router.put('/chatbot-config', async (req, res, next) => {
    try {
      const chatbotConfig = await saveChatbotConfig(req.body);
      res.json({ chatbotConfig, message: 'Chatbot settings updated' });
    } catch (err) { next(err); }
  });

  // --- Seat Booking Configuration (admin only) ---
  router.get('/seat-booking', async (_req, res, next) => {
    try {
      res.json({ seatBookingConfig: await getSeatBookingConfig() });
    } catch (err) { next(err); }
  });

  router.put('/seat-booking', async (req, res, next) => {
    try {
      const seatBookingConfig = await saveSeatBookingConfig(req.body);
      res.json({ seatBookingConfig, message: 'Seat booking settings updated' });
    } catch (err) { next(err); }
  });

  // --- Compliance Configuration (GoI) (admin only) ---
  router.get('/compliance', async (_req, res, next) => {
    try {
      res.json({ compliance: await getComplianceConfig() });
    } catch (err) { next(err); }
  });

  router.put('/compliance', async (req, res, next) => {
    try {
      const compliance = await saveComplianceConfig(req.body || {});
      res.json({ compliance, message: 'Compliance settings updated' });
    } catch (err) { next(err); }
  });

  // --- Driver Training Configuration (admin only) ---
  router.get('/training', async (_req, res, next) => {
    try {
      res.json({ training: await getTrainingConfig() });
    } catch (err) { next(err); }
  });

  router.put('/training', async (req, res, next) => {
    try {
      const training = await saveTrainingConfig(req.body || {});
      res.json({ training, message: 'Training modules updated' });
    } catch (err) { next(err); }
  });

  // --- State-wise Fare Policies (admin only) ---
  router.get('/state-fares', async (_req, res, next) => {
    try {
      const fares = await getStateFares();
      const states = INDIA_STATES.map((s) => ({ ...s, policy: fares[s.code] || null }));
      res.json({ states, vehicleTypes: await getVehicleRatesConfig() });
    } catch (err) { next(err); }
  });

  router.get('/state-fares/:stateCode', async (req, res, next) => {
    try {
      const policy = await getStateFarePolicy(req.params.stateCode, { activeOnly: false });
      res.json({ policy });
    } catch (err) { next(err); }
  });

  router.put('/state-fares/:stateCode', async (req, res, next) => {
    try {
      const policy = await saveStateFarePolicy(req.params.stateCode, req.body || {}, req.user?.email || 'admin');
      res.json({ policy, message: 'Fare policy saved' });
    } catch (err) { next(err); }
  });

  // --- Government data-sharing feed (Aggregator Guidelines 2020) ---
  // CSV of every trip: shared with authorities for safety, statistical & enforcement purposes.
  router.get('/export/trips', async (_req, res, next) => {
    try {
      const from = _req.query.from ? new Date(_req.query.from) : null;
      const to = _req.query.to ? new Date(_req.query.to) : null;
      const q = {};
      if (from || to) {
        q.createdAt = {};
        if (from) q.createdAt.$gte = from;
        if (to) q.createdAt.$lte = to;
      }
      const rides = await Ride.find(q)
        .populate('rider', 'name phone')
        .populate('driver', 'name phone vehicleNumber vehicleType')
        .sort({ createdAt: -1 })
        .lean();

      const header = [
        'Trip ID', 'Requested At', 'Completed At', 'Status',
        'Rider Name', 'Rider Phone', 'Driver Name', 'Driver Phone',
        'Vehicle Number', 'Vehicle Type', 'Pickup', 'Drop',
        'Distance (km)', 'Duration (min)', 'Fare (Rs)', 'GST (Rs)',
        'Surge', 'Payment Status', 'Payment Method',
      ];
      const escapeCsv = (val) => {
        const s = String(val == null ? '' : val);
        if (/(,|"|\n)/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      };
      const rows = rides.map((r) => [
        String(r._id),
        r.requestedAt ? new Date(r.requestedAt).toISOString() : '',
        r.completedAt ? new Date(r.completedAt).toISOString() : '',
        r.status,
        r.rider?.name || '', r.rider?.phone || '',
        r.driver?.name || '', r.driver?.phone || '',
        r.driver?.vehicleNumber || '', r.driver?.vehicleType || '',
        r.pickup?.name || '', r.drop?.name || '',
        r.distanceKm || 0, r.durationMin || 0,
        r.fare || 0, r.fareBreakup?.gst || 0,
        r.fareBreakup?.surge || 1,
        r.payment?.status || '', r.payment?.method || '',
      ]);
      const csv = [header.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="supertoto_trips_export_${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } catch (err) { next(err); }
  });

  // Cash-settlement dashboard: every driver that has collected the platform's
  // cash share and has not yet returned it, plus platform-level totals.
  router.get('/cash', async (_req, res, next) => {
    try {
      const compliance = await getComplianceConfig();
      const drivers = await User.find({ role: 'driver', driverStatus: 'approved' })
        .select('name phone vehicleNumber cashDue cashDeposited cashPendingSince')
        .sort({ cashDue: -1 });
      const rows = drivers
        .filter((d) => (d.cashDue || 0) > 0.005)
        .map((d) => toCashDTO(d, compliance));

      const [totalDueAgg, totalSettledAgg] = await Promise.all([
        User.aggregate([
          { $match: { role: 'driver' } },
          { $group: { _id: null, totalDue: { $sum: '$cashDue' }, totalCollected: { $sum: '$cashDeposited' } } },
        ]),
        CashLedger.aggregate([
          { $unwind: '$entries' },
          {
            $group: {
              _id: null,
              collected: { $sum: { $cond: [{ $eq: ['$entries.type', 'cash_collected'] }, '$entries.amount', 0] } },
              settled: { $sum: { $cond: [{ $in: ['$entries.type', ['deposit', 'auto_deduct']] }, '$entries.amount', 0] } },
            },
          },
        ]),
      ]);
      const agg = totalDueAgg[0] || { totalDue: 0, totalCollected: 0 };
      const ledger = totalSettledAgg[0] || { collected: 0, settled: 0 };
      res.json({
        cashSettlement: compliance.cashSettlement || { overdueLimit: 500, deadlineHours: 48 },
        drivers: rows,
        totals: {
          outstanding: Math.round(agg.totalDue * 100) / 100,
          totalCashCollected: Math.round(ledger.collected * 100) / 100,
          totalCashSettled: Math.round(ledger.settled * 100) / 100,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
