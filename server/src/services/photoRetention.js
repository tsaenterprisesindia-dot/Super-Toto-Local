import Ride from '../models/Ride.js';
import { deleteTripPhotoFile } from '../utils/tripPhoto.js';

// Deletes pickup safety photos once their retention window (set when the driver
// captured them) has passed. Runs at boot and daily from src/index.js.
export async function runTripPhotoSweep() {
  const now = new Date();
  const rides = await Ride.find({
    'tripPhoto.filename': { $nin: ['', null] },
    'tripPhoto.expiresAt': { $lte: now },
  }).select('tripPhoto');
  let removed = 0;
  for (const ride of rides) {
    await deleteTripPhotoFile(ride.tripPhoto?.filename);
    ride.tripPhoto = { filename: '', originalName: '', mimeType: '', size: 0, capturedAt: null, expiresAt: null };
    await ride.save();
    removed += 1;
  }
  return { checked: rides.length, removed };
}
