import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mongoServer = null;

// Default on-disk location for the bundled MongoDB when no external
// MONGODB_URI is configured. Lives in server/.data/db (git-ignored) so demo
// data survives restarts without installing MongoDB separately.
export const defaultDataDir = path.resolve(__dirname, '..', '..', '.data', 'db');

export async function connectDB() {
  // 1. External MongoDB (Atlas / a local mongod / anything) always wins.
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[db] connected:', process.env.MONGODB_URI);
    return null;
  }

  // 2. Tests (and anyone who opts in) get a throwaway in-memory database so
  //    runs stay isolated and no state leaks between them.
  const inMemory =
    process.env.NODE_ENV === 'test' || process.env.MONGODB_IN_MEMORY === '1';

  if (inMemory) {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    console.log('[db] connected to in-memory MongoDB (data resets on restart)');
    return mongoServer;
  }

  // 3. Otherwise run the bundled mongod against an on-disk dbPath so data
  //    persists across restarts. No separate MongoDB installation required;
  //    the mongod binary is supplied by mongodb-memory-server.
  const dataDir = process.env.MONGODB_DATA_DIR
    ? path.resolve(process.env.MONGODB_DATA_DIR)
    : defaultDataDir;
  fs.mkdirSync(dataDir, { recursive: true });

  mongoServer = await MongoMemoryServer.create({
    instance: {
      dbPath: dataDir,
      storageEngine: 'wiredTiger',
    },
  });
  await mongoose.connect(mongoServer.getUri());
  console.log('[db] connected to persistent MongoDB at', dataDir);
  console.log('[db] data is saved to disk and survives restarts (set MONGODB_URI to use an external database)');
  return mongoServer;
}

export async function stopDB() {
  await mongoose.disconnect();
  if (mongoServer) {
    // Keep the data directory intact on shutdown - this is what makes the
    // local database persistent.
    await mongoServer.stop({ doCleanup: false });
    mongoServer = null;
  }
}
