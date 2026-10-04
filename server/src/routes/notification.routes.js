import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import Notification from '../models/Notification.js';

export default function notificationRoutes() {
  const router = Router();

  router.use(requireAuth);

  // Recent notifications, newest first
  router.get('/', async (req, res, next) => {
    try {
      const list = await Notification.find({ user: req.user.id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
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

  return router;
}