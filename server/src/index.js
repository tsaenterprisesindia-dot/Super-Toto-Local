import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { connectDB } from './config/db.js';
import routes from './routes/index.js';
import { setupSocket } from './socket.js';
import { notFound, errorHandler } from './middleware/error.js';
import { seedIfEmpty } from './seed.js';
import { seedStateFareDefaults } from './services/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/api', routes(io));
app.use(notFound);
app.use(errorHandler);

setupSocket(io);

const PORT = process.env.PORT || 5000;

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
}

start().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
