import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    role: { type: String, enum: ['rider', 'driver', 'admin'], default: 'rider' },
    type: { type: String, enum: ['complaint', 'suggestion'], required: true },
    category: {
      type: String,
      enum: [
        'ride',
        'driver',
        'fare',
        'payment',
        'app',
        'safety',
        'vehicle',
        'other',
      ],
      default: 'other',
    },
    subject: { type: String, trim: true, maxlength: 120, default: '' },
    message: { type: String, trim: true, maxlength: 2000, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', default: null },
    status: {
      type: String,
      enum: ['open', 'under-review', 'resolved', 'closed'],
      default: 'open',
    },
    adminNote: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);

feedbackSchema.index({ user: 1, createdAt: -1 });
feedbackSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Feedback', feedbackSchema);