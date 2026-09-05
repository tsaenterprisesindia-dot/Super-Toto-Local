import mongoose from 'mongoose';

const savedPlaceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, default: '' }, // Home / Work / custom label
    name: { type: String, required: true }, // short display name of the place
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { timestamps: true }
);

export const SavedPlace = mongoose.model('SavedPlace', savedPlaceSchema);