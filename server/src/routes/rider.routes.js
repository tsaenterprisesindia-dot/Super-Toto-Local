import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import User from '../models/User.js';
import { SavedPlace } from '../models/SavedPlace.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIMES = {
  aadhaar: ['application/pdf'],
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    cb(null, `rider-${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'aadhaar') {
      if (file.mimetype !== 'application/pdf') {
        return cb(new Error('Aadhaar card must be a PDF file'));
      }
    }
    cb(null, true);
  },
});

const REQUIRED_RIDER_DOCS = ['aadhaar'];

export default function riderRoutes() {
  const router = Router();
  router.use(requireAuth, requireRole('rider'));

  // Upload rider documents
  router.post('/documents', (req, res, next) => {
    upload.fields([{ name: 'aadhaar', maxCount: 1 }])(req, res, (err) => {
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5 MB)' : err.message;
        return res.status(400).json({ message: msg });
      }
      next();
    });
  }, async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const uploaded = [];
      for (const [docType, files] of Object.entries(req.files || {})) {
        if (!files || !files.length) continue;
        const file = files[0];
        user.documents = user.documents.filter((d) => d.type !== docType);
        user.documents.push({
          type: docType,
          filename: file.filename,
          originalName: file.originalname,
          status: 'pending',
          uploadedAt: new Date(),
        });
        uploaded.push(docType);
      }

      if (uploaded.length === 0) {
        return res.status(400).json({ message: 'No files uploaded. Use field name: aadhaar' });
      }

      await user.save();
      res.json({ message: `${uploaded.length} document(s) uploaded`, documents: user.documents });
    } catch (err) {
      next(err);
    }
  });

  // View own document status
  router.get('/documents', async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id).select('documents aadhaarNumber phoneVerified aadhaarVerified');
      if (!user) return res.status(404).json({ message: 'User not found' });
      const uploaded = (user.documents || []).map((d) => d.type);
      const missing = REQUIRED_RIDER_DOCS.filter((t) => !uploaded.includes(t));
      res.json({
        documents: user.documents || [],
        missing,
        required: REQUIRED_RIDER_DOCS,
        aadhaarNumber: user.aadhaarNumber || '',
        phoneVerified: user.phoneVerified || false,
        aadhaarVerified: user.aadhaarVerified || false,
      });
    } catch (err) {
      next(err);
    }
  });

  // Rider wallet — prepaid balance used to pay for trips
  router.get('/wallet', async (req, res, next) => {
    try {
      const user = req.userDoc;
      res.json({
        balance: Math.round((user.wallet?.balance || 0) * 100) / 100,
        transactions: (user.wallet?.transactions || []).slice().reverse(),
      });
    } catch (err) {
      next(err);
    }
  });

  // Mock top-up: in production this would go through a payment gateway.
  router.post('/wallet/recharge', async (req, res, next) => {
    try {
      const amount = Math.round(Number(req.body.amount));
      if (!amount || amount <= 0) return res.status(400).json({ message: 'Enter a valid top-up amount' });
      if (amount > 100000) return res.status(400).json({ message: 'Maximum single top-up is ₹1,00,000' });

      const user = req.userDoc;
      user.wallet = user.wallet || { balance: 0, transactions: [] };
      user.wallet.balance = Math.round((user.wallet.balance + amount) * 100) / 100;
      user.wallet.transactions.push({
        type: 'recharge',
        amount,
        note: 'UPI top-up (demo)',
        at: new Date(),
      });
      await user.save();
      res.json({
        message: `₹${amount.toLocaleString('en-IN')} added to your wallet`,
        balance: Math.round(user.wallet.balance * 100) / 100,
        transactions: user.wallet.transactions.slice().reverse(),
      });
    } catch (err) {
      next(err);
    }
  });

  // Saved places — rider's frequently used pickup/drop locations
  router.get('/places', async (req, res, next) => {
    try {
      const places = await SavedPlace.find({ user: req.user.id }).sort('-createdAt').lean();
      res.json({ places });
    } catch (err) {
      next(err);
    }
  });

  router.post('/places', async (req, res, next) => {
    try {
      const { label, name, lat, lng } = req.body;
      if (lat == null || lng == null || !String(name || '').trim()) {
        return res.status(400).json({ message: 'name, lat and lng are required' });
      }
      const count = await SavedPlace.countDocuments({ user: req.user.id });
      if (count >= 20) {
        return res.status(400).json({ message: 'You can save up to 20 places' });
      }
      const place = await SavedPlace.create({
        user: req.user.id,
        label: String(label || '').trim(),
        name: String(name).trim(),
        lat: Number(lat),
        lng: Number(lng),
      });
      res.status(201).json({ place });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/places/:id', async (req, res, next) => {
    try {
      const place = await SavedPlace.findOneAndDelete({
        _id: req.params.id,
        user: req.user.id,
      });
      if (!place) return res.status(404).json({ message: 'Place not found' });
      res.json({ message: 'Place removed' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
