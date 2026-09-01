import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken, requireAuth, requireRole } from '../middleware/auth.js';
import { createCaptcha, verifyCaptcha } from '../utils/captcha.js';
import { normalizePhone } from '../utils/phone.js';
import { createOtp, verifyOtp } from '../utils/otp.js';
import { validateAadhaar } from '../utils/aadhaar.js';

// Resolve an account by an email address or an Indian mobile number.
// 'identifier' may be either; returns the matching User (or null).
async function findByIdentifier(identifier = '', select) {
  const value = String(identifier).trim();
  if (!value) return null;
  if (value.includes('@')) {
    return User.findOne({ email: value.toLowerCase() }).select(select);
  }
  const phone = normalizePhone(value);
  return phone ? User.findOne({ phone }).select(select) : null;
}

export default function authRoutes() {
  const router = Router();

  // Math captcha for the admin login (works offline in app + web).
  router.get('/captcha', (_req, res) => {
    const { id, question } = createCaptcha();
    res.json({ captchaId: id, question });
  });

  router.post('/register', async (req, res, next) => {
    try {
      const { name, email, phone: rawPhone, password, role, vehicleType, vehicleNumber, aadhaarNumber, otp, privacyConsent } = req.body;
      if (!name || !password) {
        return res.status(400).json({ message: 'Name and password are required' });
      }
      const phone = normalizePhone(rawPhone);
      if (!phone) {
        return res.status(400).json({ message: 'A valid 10-digit mobile number is required' });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      const emailValue = email ? String(email).trim().toLowerCase() : '';
      if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
        return res.status(400).json({ message: 'Enter a valid email address' });
      }
      // Mobile number must be verified with an OTP before creating the account.
      if (!(await verifyOtp(phone, 'register', otp))) {
        return res.status(400).json({ message: 'Invalid or expired mobile OTP. Please request a new one.' });
      }

      const exists = await User.findOne({
        $or: [{ phone }, ...(emailValue ? [{ email: emailValue }] : [])],
      });
      if (exists) {
        return res.status(409).json({ message: 'An account with this email or mobile number already exists' });
      }

      const userRole = ['rider', 'driver'].includes(role) ? role : 'rider';

      // DPDP 2023: capture explicit consent (required for non-admin accounts)
      if (userRole !== 'admin' && privacyConsent !== true && String(privacyConsent) !== 'true') {
        return res.status(400).json({ message: 'You must consent to the Privacy Policy to create an account' });
      }

      // Both riders and drivers must provide a valid 12-digit Aadhaar number (Verhoeff checksum verified)
      let aadhaar = '';
      {
        aadhaar = String(aadhaarNumber || '').replace(/[\s\-]/g, '');
        if (!aadhaar || aadhaar.length !== 12 || !/^\d{12}$/.test(aadhaar)) {
          return res.status(400).json({ message: 'A valid 12-digit Aadhaar number is required' });
        }
        if (!validateAadhaar(aadhaar)) {
          return res.status(400).json({ message: 'Invalid Aadhaar number. Please check and re-enter.' });
        }
        const dup = await User.findOne({ aadhaarNumber: aadhaar });
        if (dup) {
          return res.status(409).json({ message: 'This Aadhaar number is already registered' });
        }
      }

      const hashed = await bcrypt.hash(password, 10);

      const user = await User.create({
        name,
        email: emailValue || undefined,
        phone,
        password: hashed,
        role: userRole,
        aadhaarNumber: aadhaar || undefined,
        phoneVerified: true, // OTP was verified above
        aadhaarVerified: true, // Aadhaar validated via Verhough checksum at registration
        termsAcceptedAt: new Date(), // T&C accepted inline during registration
        termsVersion: '1.0',
        privacyConsentAt: new Date(),
        privacyConsentVersion: '1.0',
        vehicleType: userRole === 'driver' ? vehicleType || 'Toto (E-Rickshaw)' : undefined,
        vehicleNumber: userRole === 'driver' ? vehicleNumber || '' : undefined,
        driverStatus: userRole === 'driver' ? 'pending' : undefined,
      });

      const token = signToken(user);
      res.status(201).json({ token, user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  // Send a one-time password to a mobile number for login or registration.
  router.post('/send-otp', async (req, res, next) => {
    try {
      const { phone: rawPhone, purpose } = req.body;
      const phone = normalizePhone(rawPhone);
      if (!phone) {
        return res.status(400).json({ message: 'A valid 10-digit mobile number is required' });
      }
      if (!['login', 'register'].includes(purpose)) {
        return res.status(400).json({ message: 'Purpose must be login or register' });
      }

      if (purpose === 'register') {
        const taken = await User.findOne({ phone });
        if (taken) {
          return res.status(409).json({ message: 'An account with this mobile number already exists. Log in instead.' });
        }
      } else if (purpose === 'login') {
        const user = await User.findOne({ phone });
        if (!user) {
          return res.status(404).json({ message: 'No account found with this mobile number. Create an account first.' });
        }
        if (user.role === 'admin') {
          return res.status(403).json({ message: 'Admins must log in with password and security check.' });
        }
        if (user.isHidden) {
          return res.status(403).json({ message: 'This account has been deactivated. Contact the admin.' });
        }
        if (user.suspension?.active && (!user.suspension.until || user.suspension.until > new Date())) {
          return res.status(403).json({ message: 'This account is currently suspended. Contact the admin.' });
        }
      }

      const demoOtp = await createOtp(phone, purpose);
      res.json({
        message: 'OTP sent to your mobile (demo: shown below). Valid for 5 minutes.',
        demoOtp,
        expiresInMinutes: 5,
      });
    } catch (err) {
      next(err);
    }
  });

  // Mobile OTP login — no password needed.
  router.post('/otp-login', async (req, res, next) => {
    try {
      const { phone: rawPhone, otp } = req.body;
      const phone = normalizePhone(rawPhone);
      if (!phone || !(await verifyOtp(phone, 'login', otp))) {
        return res.status(400).json({ message: 'Invalid or expired OTP. Please request a new one.' });
      }
      const user = await User.findOne({ phone }).select('+password');
      if (!user) {
        return res.status(404).json({ message: 'No account found with this mobile number' });
      }
      if (user.isHidden) {
        return res.status(403).json({ message: 'This account has been deactivated. Contact the admin.' });
      }
      if (user.suspension?.active) {
        if (user.suspension.until && user.suspension.until <= new Date()) {
          user.suspension.active = false; await user.save();
        } else {
          const until = user.suspension.until;
          return res.status(403).json({
            message: until
              ? `Service suspended until ${until.toLocaleDateString('en-IN')}: ${user.suspension.reason || 'violations of terms'}`
              : `Service permanently suspended: ${user.suspension.reason || 'violations of terms'}`,
          });
        }
      }
      const token = signToken(user);
      res.json({ token, user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const { identifier, email, password, captchaId, captchaAnswer } = req.body;
      const user = await findByIdentifier(identifier || email || '', '+password');
      if (!user || !(await bcrypt.compare(password || '', user.password))) {
        return res.status(401).json({ message: 'Invalid email/mobile or password' });
      }
      if (user.isHidden) {
        return res.status(403).json({ message: 'This account has been deactivated. Contact the admin.' });
      }
      if (user.suspension?.active) {
        if (user.suspension.until && user.suspension.until <= new Date()) {
          user.suspension.active = false; await user.save();
        } else {
          const until = user.suspension.until;
          return res.status(403).json({
            message: until
              ? `Service suspended until ${until.toLocaleDateString('en-IN')}: ${user.suspension.reason || 'violations of terms'}`
              : `Service permanently suspended: ${user.suspension.reason || 'violations of terms'}`,
          });
        }
      }

      const token = signToken(user);
      res.json({ token, user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  // Face recognition login for riders/drivers (admins use password only).
  router.post('/face-login', async (req, res, next) => {
    try {
      const { email, descriptor } = req.body;
      if (!email || !Array.isArray(descriptor)) {
        return res.status(400).json({ message: 'Email and descriptor are required' });
      }
      const user = await User.findOne({ email: (email || '').toLowerCase() });
      if (!user) return res.status(401).json({ message: 'No account for this email' });
      if (user.isHidden) {
        return res.status(403).json({ message: 'This account has been deactivated. Contact the admin.' });
      }
      if (user.role === 'admin') {
        return res.status(403).json({ message: 'Admin must log in with password' });
      }
      if (!user.faceRegistered || !user.faceDescriptor.length) {
        return res.status(403).json({ message: 'No face enrolled. Log in with password and register your face first.' });
      }

      const { faceMatch } = await import('../utils/pricing.js');
      const { distance, matched } = faceMatch(user.faceDescriptor, descriptor);
      if (!matched) return res.status(401).json({ message: 'Face did not match', distance });

      const token = signToken(user);
      res.json({ token, user: user.toSafeJSON(), distance });
    } catch (err) {
      next(err);
    }
  });

  // Forgot password: issue a 6-digit reset code.
  // No mail service in this demo app, so the code is returned in the response
  // as a stand-in for an email ("demo email"). In production, send it via email instead.
  router.post('/forgot-password', async (req, res, next) => {
    try {
      const { identifier, email } = req.body;
      if (!identifier && !email) {
        return res.status(400).json({ message: 'Email or mobile number is required' });
      }
      const user = await findByIdentifier(identifier || email || '');
      if (!user) {
        return res.status(404).json({ message: 'No account found with this email or mobile number' });
      }
      if (user.isHidden) {
        return res.status(403).json({ message: 'This account has been deactivated. Contact the admin.' });
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      user.resetCode = await bcrypt.hash(code, 10);
      user.resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await user.save();

      res.json({
        message: 'Password reset code generated. Check your email (demo: shown below).',
        demoCode: code,
        expiresInMinutes: 15,
      });
    } catch (err) {
      next(err);
    }
  });

  // Reset password using the code from forgot-password.
  router.post('/reset-password', async (req, res, next) => {
    try {
      const { identifier, email, code, newPassword } = req.body;
      if ((!identifier && !email) || !code || !newPassword) {
        return res.status(400).json({ message: 'Email/mobile, code and new password are required' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
      }

      const user = await findByIdentifier(identifier || email || '', '+password');
      if (!user) return res.status(404).json({ message: 'No account found with this email or mobile number' });
      if (!user.resetCode || !user.resetExpires || user.resetExpires < new Date()) {
        return res.status(400).json({ message: 'Reset code is missing or has expired. Request a new one.' });
      }
      if (!(await bcrypt.compare(String(code).trim(), user.resetCode))) {
        return res.status(400).json({ message: 'Invalid reset code' });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      user.resetCode = null;
      user.resetExpires = null;
      await user.save();

      res.json({ message: 'Password updated. You can now log in with your new password.' });
    } catch (err) {
      next(err);
    }
  });

  // Accept Terms & Conditions (requires auth, sets termsAcceptedAt on the user).
  router.post('/accept-terms', requireAuth, async (req, res) => {
    try {
      const { version } = req.body || {};
      if (!version) return res.status(400).json({ message: 'Terms version is required' });
      const user = req.userDoc;
      user.termsAcceptedAt = new Date();
      user.termsVersion = String(version);
      await user.save();
      res.json({ message: 'Terms accepted', user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  // Privacy consent (DPDP 2023) - any role can record/renew consent.
  router.post('/consent', requireAuth, async (req, res) => {
    try {
      const { version } = req.body || {};
      if (!version) return res.status(400).json({ message: 'Privacy policy version is required' });
      const user = req.userDoc;
      user.privacyConsentAt = new Date();
      user.privacyConsentVersion = String(version);
      await user.save();
      res.json({ message: 'Privacy consent recorded', user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  // Motor Vehicle Aggregator Agreement (MGAA) acceptance - drivers only.
  router.post('/accept-agreement', requireAuth, requireRole('driver'), async (req, res) => {
    try {
      const { version } = req.body || {};
      if (!version) return res.status(400).json({ message: 'Agreement version is required' });
      const user = req.userDoc;
      user.aggregatorAgreementAcceptedAt = new Date();
      user.aggregatorAgreementVersion = String(version);
      await user.save();
      res.json({ message: 'Aggregator agreement accepted', user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.userDoc.toSafeJSON() });
  });

  return router;
}
