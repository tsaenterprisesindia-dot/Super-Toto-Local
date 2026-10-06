import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import Notification from '../models/Notification.js';

export default function notificationRoutes() {
  const router = Router();

  router.use(requireAuth);

  // Recent notifications, newest first. Supports the notification-center panel:
  //   ?unread=true   only unread
  //   ?type=safety   filter by event type
  //   ?limit=&skip=  pagination (default 50, max 200)
  router.get('/', async (req, res, next) => {
    try {
      const { unread, type } = req.query;
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
      const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
      const filter = { user: req.user.id };
      if (unread === 'true') filter.read = false;
      if (type) filter.type = type;
      const list = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();
      const total = await Notification.countDocuments(filter);
      res.json({
        notifications: list.map((n) => ({
          id: String(n._id),
          type: n.type,
          title: n.title,
          message: n.message,
          link: n.link,
          read: n.read,
          createdAt: n.createdAt,
        })),
        total,
        limit,
        skip,
      });
    } catch (err) { next(err); }
  });

  router.get('/unread-count', async (req, res, next) => {
    try {
      const count = await Notification.countDocuments({ user: req.user.id, read: false });
      res.json({ count });
    } catch (err) { next(err); }
  });

  router.post('/read-all', async (req, res, next) => {
    try {
      const r = await Notification.updateMany(
        { user: req.user.id, read: false },
        { $set: { read: true, readAt: new Date() } }
      );
      res.json({ updated: r.modifiedCount });
    } catch (err) { next(err); }
  });

  router.post('/:id/read', async (req, res, next) => {
    try {
      const n = await Notification.findOneAndUpdate(
        { _id: req.params.id, user: req.user.id, read: false },
        { $set: { read: true, readAt: new Date() } },
        { new: true }
      );
      if (!n) return res.status(404).json({ message: 'Notification not found' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // Delete a single notification
  router.post('/:id/remove', async (req, res, next) => {
    try {
      const r = await Notification.deleteOne({ _id: req.params.id, user: req.user.id });
      if (!r.deletedCount) return res.status(404).json({ message: 'Notification not found' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // Clear the whole inbox (optionally only read items)
  router.post('/clear-all', async (req, res, next) => {
    try {
      const filter = { user: req.user.id };
      if (req.body?.readOnly === true) filter.read = true;
      const r = await Notification.deleteMany(filter);
      res.json({ deleted: r.deletedCount });
    } catch (err) { next(err); }
  });

  return router;
}