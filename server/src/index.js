import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { connectDB, stopDB } from './config/db.js';
import routes from './routes/index.js';
import { setupSocket } from './socket.js';
import { notFound, errorHandler } from './middleware/error.js';
import { seedIfEmpty } from './seed.js';
import { seedStateFareDefaults } from './services/settings.js';
import { runAmbulanceExpirySweep } from './services/ambulance.js';
import { runTripPhotoSweep } from './services/photoRetention.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
// NOTE: uploaded documents (Aadhaar, RC, license, etc.) are deliberately NOT served
// as public static files. They are streamed only through authenticated endpoints
// (/admin/drivers/:id/documents/:docId/download, /driver/documents/:docId/download,
// /rider/documents/:docId/download) so personal documents can't be fetched by URL.
app.use('/api', routes(io));

// In production the backend also serves the built React app, so the whole app
// lives on one host (same-origin /api + /socket.io). Dev (Vite on :5173) is
// unaffected because NODE_ENV is unset locally.
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (
      req.method === 'GET' &&
      !req.path.startsWith('/api') &&
      !req.path.startsWith('/socket.io') &&
      !req.path.startsWith('/uploads')
    ) {
      return res.sendFile(path.join(clientDist, 'index.html'));
    }
    return next();
  });
}

app.use(notFound);
app.use(errorHandler);

setupSocket(io);

// Super Toto Local listens on 5001 by default so it can run side-by-side with
// TriVista GST ERP (which uses 5000) on the same machine. Override with PORT.
const PORT = process.env.PORT || 5001;

// Security gate: never allow a production start with the default JWT secret, or
// anyone could forge auth tokens. Local dev keeps the fallback with a warning.
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[security] REFUSING TO START: set JWT_SECRET (a long random value) before running in production.');
    process.exit(1);
  }
  console.warn('[security] WARNING: no JWT_SECRET set — using the dev-only fallback secret. Set JWT_SECRET in server/.env for any non-local run.');
}

async function start() {
  const mongo = await connectDB();
  await seedIfEmpty(mongo);
  const stateCount = await seedStateFareDefaults();
  console.log(`[seed] state fare defaults ensured for ${stateCount} states/UTs`);
  server.listen(PORT, () => {
    console.log(`[server] Super Toto Local API running at http://localhost:${PORT}`);
  });
  // Ambulance compliance expiry sweep: run once at boot, then daily. Keeps
  // expired registrations out of dispatch without admin intervention.
  try {
    const boot = await runAmbulanceExpirySweep({ io });
    console.log(`[ambulance] boot expiry sweep — checked ${boot.checked}, suspended ${boot.suspended}`);
  } catch (err) {
    console.error('[ambulance] boot expiry sweep failed:', err.message);
  }
  const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
  // Pickup safety photos are kept only for their retention window; purge any
  // that have expired once at boot, then daily alongside the other sweeps.
  try {
    const photos = await runTripPhotoSweep();
    console.log(`[photos] boot retention sweep — checked ${photos.checked}, removed ${photos.removed}`);
  } catch (err) {
    console.error('[photos] boot retention sweep failed:', err.message);
  }
  const dailyTimer = setInterval(async () => {
    try {
      const result = await runAmbulanceExpirySweep({ io });
      console.log(`[ambulance] daily expiry sweep — checked ${result.checked}, suspended ${result.suspended}`);
    } catch (err) {
      console.error('[ambulance] daily expiry sweep failed:', err.message);
    }
    try {
      const photos = await runTripPhotoSweep();
      if (photos.removed > 0) console.log(`[photos] retention sweep — removed ${photos.removed}`);
    } catch (err) {
      console.error('[photos] retention sweep failed:', err.message);
    }
  }, SWEEP_INTERVAL_MS);
  dailyTimer.unref();
}

// Graceful shutdown so the bundled MongoDB flushes to disk cleanly before the
// process exits (important now that data is stored on disk).
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[server] ${signal} received, shutting down...`);
  try { io.close(); } catch {}
  server.close();
  try {
    await stopDB();
  } catch (err) {
    console.error('[server] shutdown error:', err.message);
  }
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});

