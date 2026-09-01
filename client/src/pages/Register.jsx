import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import OtpInput from '../components/OtpInput.jsx';
import OtpTimer from '../components/OtpTimer.jsx';
import logo from '../assets/super-toto-logo.png';

const TERMS_VERSION = '1.0';

const RIDER_TERMS = [
  { title: '1. Acceptance of Terms', body: 'By using Super Toto Local you agree to these Terms. If you do not agree, do not use the Service.' },
  { title: '2. Description of Service', body: 'Super Toto Local connects riders with local e-rickshaw (toto), auto, and cab drivers for point-to-point transportation.' },
  { title: '3. Eligibility', body: 'You must be at least 18 years old and capable of forming a binding contract to use the Service.' },
  { title: '4. Account Registration', body: 'You must provide accurate and complete registration information. You are responsible for maintaining the confidentiality of your account credentials.' },
  { title: '5. Identity Verification', body: 'Your Aadhaar number is verified at registration via checksum validation. You consent to this automated verification for account security.' },
  { title: '6. Ride Booking & Fare', body: 'Fares are calculated based on distance, time, and applicable surge pricing. The estimated fare is shown before you confirm the ride.' },
  { title: '7. Payment', body: 'Payment is collected after ride completion. Cash and digital payment methods may be supported depending on your area.' },
  { title: '8. Cancellation Policy', body: 'Cancellations after driver acceptance may incur a fee. Repeated cancellations may result in account restrictions.' },
  { title: '9. Rider Conduct', body: 'You must treat drivers with respect. Harassment, damage to vehicle, or threatening behaviour will result in account suspension.' },
  { title: '10. Safety', body: 'Share your ride status with trusted contacts using live tracking. Report any safety concerns immediately through the app.' },
  { title: '11. Privacy', body: 'We collect location data during rides, Aadhaar number for identity verification, and usage analytics to improve the Service. Your data is protected under applicable Indian data protection laws.' },
  { title: '12. Limitation of Liability', body: 'Super Toto Local acts as a platform connecting riders and drivers. We are not liable for the actions of individual drivers or riders.' },
  { title: '13. Changes to Terms', body: 'We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance.' },
  { title: '14. Governing Law', body: 'These Terms are governed by the laws of India. Disputes shall be subject to the jurisdiction of courts in India.' },
  { title: '15. Contact', body: 'TSA Enterprises India\nEmail: support@supertoto.local\nEmail: tsaenterprisesindia@gmail.com\nPhone: +91 9811997286\nWhatsApp: +91 9811997286\nWe aim to respond within 48 business hours.' },
];

const DRIVER_TERMS = [
  { title: '1. Acceptance of Terms', body: 'By using Super Toto Local as a driver you agree to these Terms. If you do not agree, do not use the Service.' },
  { title: '2. Description of Service', body: 'Super Toto Local connects you with riders looking for transportation. You provide the vehicle and driving services.' },
  { title: '3. Driver Eligibility', body: 'You must be at least 18 years old, hold a valid driving licence, and your vehicle must be registered and insured.' },
  { title: '4. Account & Documents', body: 'You must upload valid documents (Aadhaar, RC, licence, bank details, photo) for admin approval before going online.' },
  { title: '5. Driver Conduct', body: 'You must maintain a professional and courteous attitude. Clean vehicle, safe driving, and respecting riders is mandatory.' },
  { title: '6. Ride Acceptance', body: 'You may accept or reject ride requests. Repeated rejections may affect your driver rating and visibility.' },
  { title: '7. Earnings & Payouts', body: 'Your earnings minus platform commission are tracked in the app. Payouts are processed as per the settlement schedule.' },
  { title: '8. Commission', body: 'A platform commission is deducted from each fare as displayed in your earnings dashboard.' },
  { title: '9. Cancellation', body: 'Cancelling after accepting a ride without valid reason may result in warnings or temporary suspension.' },
  { title: '10. Vehicle Standards', body: 'Your vehicle must be roadworthy, clean, and meet local regulations. Failure to maintain standards may result in deactivation.' },
  { title: '11. Safety', body: 'Always follow traffic rules. Wear a seatbelt where applicable. Report any incidents immediately through the app.' },
  { title: '12. Warnings & Suspension', body: 'Violations result in warnings. Repeated violations lead to temporary or permanent suspension. You can view warnings in the app.' },
  { title: '13. Privacy', body: 'Location data is shared with riders during active rides. Your personal information is protected under applicable Indian laws.' },
  { title: '14. Governing Law', body: 'These Terms are governed by the laws of India. Disputes shall be subject to the jurisdiction of courts in India.' },
  { title: '15. Contact', body: 'TSA Enterprises India\nEmail: driver-support@supertoto.local\nEmail: tsaenterprisesindia@gmail.com\nPhone: +91 9811997286\nWhatsApp: +91 9811997286\nWe aim to respond within 24 business hours.' },
];

export default function Register() {
  const { register, sendOtp } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('rider');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    aadhaarNumber: '',
    vehicleType: 'Toto (E-Rickshaw)',
    vehicleNumber: '',
  });
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const phoneAtOtpRef = useRef('');
  const [demoOtp, setDemoOtp] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [expired, setExpired] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [err, setErr] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const termsBoxRef = useRef(null);

  const terms = role === 'driver' ? DRIVER_TERMS : RIDER_TERMS;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const isValidPhone = (raw) => {
    let d = (raw || '').replace(/[\s\-()]/g, '');
    if (d.startsWith('+91')) d = d.slice(3);
    else if (d.startsWith('91') && d.length === 12) d = d.slice(2);
    else if (d.startsWith('0') && d.length === 11) d = d.slice(1);
    return /^[6-9]\d{9}$/.test(d);
  };

  const handleTermsScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 60) setTermsAccepted(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!isValidPhone(form.phone)) {
      setErr('Enter a valid 10-digit mobile number (e.g. 9xxxxxxxxx)');
      return;
    }
    if (!otpSent || !otp) {
      setErr('Verify your mobile number with the OTP first');
      return;
    }
    if (form.password.length < 6) {
      setErr('Password must be at least 6 characters');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setErr('Passwords do not match');
      return;
    }
    if (expired) {
      setErr('The OTP has expired. Please request a new one.');
      return;
    }
    const aadhaar = (form.aadhaarNumber || '').replace(/[\s\-]/g, '');
    if (!aadhaar || aadhaar.length !== 12 || !/^\d{12}$/.test(aadhaar)) {
      setErr('A valid 12-digit Aadhaar number is required');
      return;
    }
    if (!termsAccepted) {
      setErr('Please read and accept the Terms & Conditions');
      setShowTerms(true);
      return;
    }
    if (!privacyConsent) {
      setErr('Please consent to the Privacy Policy to create an account');
      return;
    }
    try {
      const { user } = await register({ ...form, role, otp, privacyConsent: true });
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'driver') navigate('/driver/documents');
      else navigate('/ride');
    } catch (err) {
      setErr(err.response?.data?.message || (err.code === 'ERR_NETWORK' ? 'Cannot reach server. Make sure the server is running.' : 'Registration failed'));
    }
  };

  const sendCode = async () => {
    setErr('');
    setDemoOtp('');
    if (!isValidPhone(form.phone)) {
      setErr('Enter a valid 10-digit mobile number (e.g. 9xxxxxxxxx)');
      return;
    }
    setOtpBusy(true);
    try {
      const data = await sendOtp(form.phone, 'register');
      setOtpSent(true);
      setDemoOtp(data.demoOtp || '');
      setOtp('');
      phoneAtOtpRef.current = form.phone;
      setExpiresAt(Date.now() + (data.expiresInMinutes || 5) * 60 * 1000);
      setExpired(false);
    } catch (e) {
      setErr(e.response?.data?.message || (e.code === 'ERR_NETWORK' ? 'Cannot reach server. Make sure the server is running.' : 'Could not send OTP'));
    } finally {
      setOtpBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card fade-in">
        <div className="auth-title">
          <img src={logo} alt="Super Toto Local logo" className="auth-logo" /> Create account
        </div>
        <p className="muted">Join Super Toto Local</p>

        {err && <div className="err-box">{err}</div>}

        <div className="tab-row">
          <button className={`tab${role === 'rider' ? ' active' : ''}`} onClick={() => { setRole('rider'); setTermsAccepted(false); }}>I ride</button>
          <button className={`tab${role === 'driver' ? ' active' : ''}`} onClick={() => { setRole('driver'); setTermsAccepted(false); }}>I drive a toto</button>
        </div>

        {role === 'driver' && (
          <p className="hint">Driver accounts need admin approval to go online: upload documents (incl. Police Clearance), sign the Aggregator Agreement, and complete training on the Driver page. (The seeded driver already works.)</p>
        )}

        <form onSubmit={submit}>
          <div className="field">
            <label>Full name</label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="Your name" required />
          </div>
          <div className="field">
            <label>Email (optional)</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />
          </div>

          <div className="field">
            <label>Aadhaar Number *</label>
            <input
              className="input"
              value={form.aadhaarNumber}
              onChange={(e) => {
                let v = e.target.value.replace(/[^0-9]/g, '').slice(0, 12);
                setForm((f) => ({ ...f, aadhaarNumber: v }));
              }}
              placeholder="12-digit Aadhaar number"
              required
              inputMode="numeric"
              maxLength={12}
            />
            <div className="small muted">12-digit number from your Aadhaar card. Verified with checksum to prevent fake entries.</div>
          </div>

          <div className="field">
            <label>Mobile number</label>
            <div className="row">
              <input
                className="input"
                value={form.phone}
                onChange={(e) => {
                  const newPhone = e.target.value;
                  setForm((f) => ({ ...f, phone: newPhone }));
                  if (newPhone !== phoneAtOtpRef.current) {
                    setOtpSent(false);
                    setDemoOtp('');
                    setOtp('');
                    setExpiresAt(0);
                    setExpired(false);
                  }
                }}
                placeholder="+91 9xxxx xxxxx"
                required
                inputMode="numeric"
              />
              <button type="button" className="btn btn-ghost" onClick={sendCode} disabled={otpBusy || !form.phone}>
                {otpBusy ? 'Sending…' : otpSent ? 'Resend' : 'Send OTP'}
              </button>
            </div>
            <div className="small muted">Used to log in. We'll verify it with a one-time password.</div>
          </div>

          <div className={`field otp-container${otpSent ? ' otp-active' : ''}`}>
            {!otpSent && <div className="small muted" style={{ textAlign: 'center', margin: 0 }}>Tap "Send OTP" above to receive a verification code here.</div>}
            {otpSent && (
              <>
                {demoOtp && (
                  <div className="alert alert-info mb">
                    <b>Demo SMS:</b> your OTP is <b>{demoOtp}</b>. In production this would be sent to your phone.
                  </div>
                )}
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <label style={{ marginBottom: 0 }}>One-time password</label>
                  {expired ? <span className="otp-expired">OTP expired</span> : <OtpTimer expiresAt={expiresAt} onExpire={() => setExpired(true)} />}
                </div>
                <OtpInput value={otp} onChange={setOtp} length={6} disabled={expired} />
                {expired && <div className="small muted mt">The OTP has expired. Tap Resend to get a new code.</div>}
              </>
            )}
          </div>
          <div className="field">
            <label>Password</label>
            <PasswordInput value={form.password} onChange={set('password')} placeholder="min 6 characters" required />
          </div>
          <div className="field">
            <label>Confirm password</label>
            <PasswordInput value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="re-enter password" required />
          </div>

          {role === 'driver' && (
            <>
              <div className="field">
                <label>Vehicle type</label>
                <select className="input" value={form.vehicleType} onChange={set('vehicleType')}>
                  <option>Toto (E-Rickshaw)</option>
                  <option>Auto Rickshaw</option>
                  <option>Cab</option>
                </select>
              </div>
              <div className="field">
                <label>Vehicle number</label>
                <input className="input" value={form.vehicleNumber} onChange={set('vehicleNumber')} placeholder="SK-01-T1234" />
              </div>
            </>
          )}

          {/* --- Inline Terms & Conditions --- */}
          <div className="field" style={{ marginTop: 4 }}>
            <label>Terms & Conditions (v{TERMS_VERSION})</label>
            {!showTerms && !termsAccepted && (
              <button type="button" className="btn btn-ghost btn-block" onClick={() => setShowTerms(true)}>
                📄 Read & Accept Terms
              </button>
            )}
            {!showTerms && termsAccepted && (
              <div className="alert alert-green" style={{ margin: 0 }}>
                Terms accepted ✓
              </div>
            )}
            {showTerms && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div
                  ref={termsBoxRef}
                  onScroll={handleTermsScroll}
                  style={{ maxHeight: 240, overflowY: 'auto', padding: 12, fontSize: 12, lineHeight: 1.6, background: 'var(--bg)' }}
                >
                  {terms.map((s, i) => (
                    <section key={i} style={{ marginBottom: 10 }}>
                      <b>{s.title}</b>
                      {s.body.split('\n').map((line, j) => (
                        <p key={j} style={{ margin: '2px 0' }}>{line}</p>
                      ))}
                    </section>
                  ))}
                </div>
                <div style={{ padding: '8px 12px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  {!termsAccepted && (
                    <div className="small muted" style={{ flex: 1 }}>Scroll to the bottom to accept</div>
                  )}
                  {termsAccepted && (
                    <div className="small" style={{ flex: 1, color: 'var(--green)' }}>Terms accepted ✓</div>
                  )}
                  <button type="button" className="btn btn-primary small" disabled={!termsAccepted} onClick={() => setShowTerms(false)}>
                    {termsAccepted ? 'Continue' : 'Scroll down'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* --- DPDP Privacy Consent (required) --- */}
          <div className="field" style={{ marginTop: 4 }}>
            <label className="checkbox-row" style={{ justifyContent: 'flex-start', gap: 10 }}>
              <input type="checkbox" checked={privacyConsent} onChange={(e) => setPrivacyConsent(e.target.checked)} style={{ width: 16, height: 16 }} />
              <span className="small">
                I consent to TSA Enterprises processing my personal data (including Aadhaar for identity verification, phone, location during rides and face login if enabled) as described in the{' '}
                <Link to="/legal/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>. Required by the DPDP Act, 2023.
              </span>
            </label>
          </div>

          <button className="btn btn-primary btn-block btn-lg" type="submit">
            Create account
          </button>
        </form>

        <div className="small muted mt" style={{ textAlign: 'center' }}>
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </div>

    </div>
  );
}
