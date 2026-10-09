import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema(
  {
    fleetOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vehicleType: { type: String, default: 'toto' },
    vehicleNumber: { type: String, required: true, trim: true, uppercase: true },
    status: { type: String, enum: ['idle', 'assigned', 'maintenance', 'inactive'], default: 'idle' },
    assignedDriverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    vehicleDetails: {
      brand: { type: String, default: '' },
      model: { type: String, default: '' },
      seats: { type: Number, default: 4 },
      color: { type: String, default: '' },
      year: { type: Number, default: 0 },
      luggageCapacityKg: { type: Number, default: 10 },
      hasStep: { type: Boolean, default: false },
      hasCanopy: { type: Boolean, default: false },
      hasStorage: { type: Boolean, default: false },
      fuelType: { type: String, default: '' },
      engineCc: { type: Number, default: 0 },
      hasPillionSeat: { type: Boolean, default: false },
      helmetCount: { type: Number, default: 2 },
      hasTopBox: { type: Boolean, default: false },
      insuranceUpto: { type: String, default: '' },
      permitUpto: { type: String, default: '' },
    },
    isActive: { type: Boolean, default: true },
    documents: [
      {
        type: { type: String, enum: ['rc', 'insurance', 'permit', 'fitness', 'puc'], required: true },
        filename: { type: String, required: true },
        originalName: { type: String, default: '' },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        rejectionReason: { type: String, default: '' },
        uploadedAt: { type: Date, default: Date.now },
        reviewedAt: { type: Date, default: null },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

vehicleSchema.index({ fleetOwnerId: 1, vehicleNumber: 1 }, { unique: true });

const Vehicle = mongoose.model('Vehicle', vehicleSchema);
export default Vehicle;
