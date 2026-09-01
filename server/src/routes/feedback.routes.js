import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import Feedback from '../models/Feedback.js';

const CATEGORIES = ['ride', 'driver', 'fare', 'payment', 'app', 'safety', 'vehicle', 'other'];
const TYPES = ['complaint', 'suggestion'];
const STATUSES = ['open', 'under-review', 'resolved', 'closed'];

export default function feedbackRoutes() {
  const router = Router();
  const adminOnly = [requireAuth, requireRole('admin')];

  // Submit a complaint or suggestion (rider/driver/admin).
  router.post('/', requireAuth, async (req, res, next) => {
    try {
      const { type, category, subject, message, priority, rideId } = req.body || {};
      if (!TYPES.includes(type)) {
        return res.status(400).json({ message: 'type must be complaint or suggestion' });
      }
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ message: 'Please write a message' });
      }
      const cat = CATEGORIES.includes(category) ? category : 'other';
      const doc = await Feedback.create({
        user: req.user.id,
        name: req.userDoc?.name || '',
        phone: req.userDoc?.phone || '',
        role: req.user?.role || 'rider',
        type,
        category: cat,
        subject: String(subject || '').slice(0, 120),
        message: message.trim().slice(0, 2000),
        priority: priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'medium',
        rideId: rideId && mongoose.isValidObjectId(rideId) ? rideId : null,
      });
      // Set high priority automatically for complaints about safety/driver/fare.
      if (doc.type === 'complaint' && ['safety', 'driver', 'fare'].includes(cat) && doc.priority === 'medium') {
        doc.priority = 'high';
        await doc.save();
      }
      return res.status(201).json({ feedback: doc });
    } catch (err) {
      return next(err);
    }
  });

  // My own complaints/suggestions with status.
  router.get('/mine', requireAuth, async (req, res, next) => {
    try {
      const items = await Feedback.find({ user: req.user.id })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      return res.json({ feedback: items });
    } catch (err) {
      return next(err);
    }
  });

  // Admin: list all feedback with filters.
  router.get('/', adminOnly, async (req, res, next) => {
    try {
      const { type, status, category, q } = req.query;
      const filter = {};
      if (TYPES.includes(type)) filter.type = type;
      if (STATUSES.includes(status)) filter.status = status;
      if (CATEGORIES.includes(category)) filter.category = category;
      if (q && typeof q === 'string') {
        filter.$or = [
          { subject: { $regex: q.trim(), $options: 'i' } },
          { message: { $regex: q.trim(), $options: 'i' } },
          { name: { $regex: q.trim(), $options: 'i' } },
          { phone: { $regex: q.trim(), $options: 'i' } },
        ];
      }
      const items = await Feedback.find(filter).sort({ createdAt: -1 }).limit(500).lean();
      return res.json({ feedback: items });
    } catch (err) {
      return next(err);
    }
  });

  // Admin: detail.
  router.get('/:id', adminOnly, async (req, res, next) => {
    try {
      const doc = await Feedback.findById(req.params.id).lean();
      if (!doc) return res.status(404).json({ message: 'Feedback not found' });
      return res.json({ feedback: doc });
    } catch (err) {
      return next(err);
    }
  });

  // Admin: update status + admin note.
  router.post('/:id/status', adminOnly, async (req, res, next) => {
    try {
      const doc = await Feedback.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: 'Feedback not found' });
      const { status, adminNote } = req.body || {};
      if (STATUSES.includes(status)) doc.status = status;
      if (typeof adminNote === 'string') doc.adminNote = adminNote.trim().slice(0, 1000);
      await doc.save();
      return res.json({ feedback: doc });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}