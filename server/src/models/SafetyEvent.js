import mongoose from 'mongoose';

const safetyEventSchema = new mongoose.Schema(
  {
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    type: { type: String, enum: ['sos'], default: 'sos' },
    status: { type: String, enum: ['active', 'solved'], default: 'active' },

    // Rider's optional note to the monitoring team
    message: { type: String, default: '' },

    // Live location captured at the moment of the alert
    riderCoords: { lat: { type: Number, default: null }, lng: { type: Number, default: null } },
    driverCoords: { lat: { type: Number, default: null }, lng: { type: Number, default: null } },

    incidentAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolutionNote: { type: String, default: '' },
  },
  { timestamps: true }
);

export const SafetyEvent = mongoose.model('SafetyEvent', safetyEventSchema);