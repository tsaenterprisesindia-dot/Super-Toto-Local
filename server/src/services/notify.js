import Notification from '../models/Notification.js';
import User from '../models/User.js';

// Persist a notification and, when a live socket.io server is available, push it
// to the target user's {user:id} room in real time. All callers fire-and-forget:
// a hinted/failed notify must never break the ride, payment or admin flow that
// triggered it.
export async function notifyUser({ io, userId, type = 'system', title, message = '', link = '' }) {
  if (!userId) return null;
  try {
    const notif = await Notification.create({ user: userId, type, title, message, link });
    try {
      io?.to(`user:${String(userId)}`).emit('notification:new', {
        id: String(notif._id),
        type: notif.type,
        title: notif.title,
        message: notif.message,
        link: notif.link,
        read: false,
        createdAt: notif.createdAt,
      });
    } catch { /* socket relay is best-effort */ }
    return notif;
  } catch {
    return null;
  }
}

// Notify every admin account (they join the shared "admins" room on connect).
export async function notifyAdmins({ io, type = 'system', title, message = '', link = '' }) {
  try {
    const adminIds = await User.find({ role: 'admin', isHidden: { $ne: true } }).select('_id');
    const ids = adminIds.map((a) => a._id);
    if (!ids.length) return null;
    if (io) {
      // Broadcast immediately so N socket client sessions each get one copy.
      io.to('admins').emit('notification:new', {
        type,
        title,
        message,
        link,
        read: false,
        createdAt: new Date(),
        adminTarget: true,
      });
    }
    // Persist one notification per admin so the panel shows previous alerts.
    const docs = ids.map((id) => ({ user: id, type, title, message, link }));
    return ids.length ? Notification.insertMany(docs) : null;
  } catch {
    return null;
  }
}