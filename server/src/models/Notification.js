import mongoose from 'mongoose';

// In-app notifications delivered in real-time via the user:{id} socket room and
// persisted so a user can catch up on anything they missed while offline.
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'ride',
        'payment',
        'earnings',
        'wallet',
        'account',
        'document',
        'warning',
        'suspension',
        'safety',
        'feedback',
        'promo',
        'compliance',
        'system',
      ],
      default: 'system',
    },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    // Client-side route the notification links to when tapped, e.g. /ride or /history
    link: { type: String, default: '' },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;