import fs from 'fs';
import path from 'path';

// Trip safety photos live in their own folder under the uploads dir so they can
// be swept by retention independently of onboarding documents. Not served as
// static files — only through authenticated endpoints.
export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
export const TRIP_PHOTO_DIR = path.join(UPLOADS_DIR, 'trip-photos');

export function ensureTripPhotoDir() {
  if (!fs.existsSync(TRIP_PHOTO_DIR)) fs.mkdirSync(TRIP_PHOTO_DIR, { recursive: true });
  return TRIP_PHOTO_DIR;
}

export function tripPhotoPath(filename) {
  return path.join(TRIP_PHOTO_DIR, filename);
}

export async function deleteTripPhotoFile(filename) {
  if (!filename) return false;
  try {
    await fs.promises.unlink(tripPhotoPath(filename));
    return true;
  } catch {
    return false;
  }
}
