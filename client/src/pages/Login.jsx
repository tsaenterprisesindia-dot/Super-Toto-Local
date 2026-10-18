import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client.js';
import PasswordInput from '../components/PasswordInput.jsx';
import OtpInput from '../components/OtpInput.jsx';
import OtpTimer from '../components/OtpTimer.jsx';
import logo from '../assets/super-toto-logo.png';

const ROLE_ORDER = ['rider', 'driver', 'fleet_owner', 'admin'];
const ROLE_LABELS = { rider: 'Riders', driver: 'Drivers', fleet_owner: 'Fleet Owner', admin: 'Admin' };

// Reduce any typed number to a bare 10-digit Indian mobile (or '' if invalid).
function normalizePhoneInput(raw) {
  let d = (raw || '').replace(/[\s\-()]/g, '');
  if (d.startsWith('+91')) d = d.slice(3);
  else if (d.startsWith('91') && d.length === 12) d = d.slice(2);
  else if (d.startsWith('0') && d.length === 11) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : '';
}

export default function Login() {
  const { login, otpLogin, sendOtp, lookupPhone, demoLogin } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');

  const [step, setStep] = useState('phone'); // phone | otp
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [expired, setExpired] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);

  const [showPassword, setShowPassword] = useState(searchParams.get('role') === 'admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showDemo, setShowDemo] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [quickBusy, setQuickBusy] = useState('');

  useEffect(() => {
    client
      .get('/auth/demo-accounts')
      .then(({ data }) => setDemoAccounts(data.accounts || []))
      .catch(() => {});
  }, []);

  const goHome = () => {
    if (next && next.startsWith('/')) return navigate(next, { replace: true });
    navigate('/', { replace: true });
  };

  const roleGroups = ROLE_ORDER.map((role) => {
    const found = demoAccounts.find((a) => a.role === role);
    return found ? { role, label: ROLE_LABELS[role], index: found.index } : null;
  }).filter(Boolean);

  const normalizedPhone = normalizePhoneInput(phone);

  const continueWithPhone = async (e) => {
    e.preventDefault();
    setError('');
    setNotFound(false);
    if (!normalizedPhone) {
      setError(t('login.errPhone'));
      return;
    }
    setOtpBusy(true);
    try {
      const { exists } = await lookupPhone(normalizedPhone);
      if (!exists) {
        setNotFound(true);
        return;
      }
      const data = await sendOtp(normalizedPhone, 'login');
      setDemoOtp(data.demoOtp || '');
      setOtp('');
      setExpiresAt(Date.now() + (data.expiresInMinutes || 5) * 60 * 1000);
      setExpired(false);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || (err.code === 'ERR_NETWORK' ? t('login.errNetwork') : t('login.errOtp')));
    } finally {
      setOtpBusy(false);
    }
  };

  const changeNumber = () => {
    setStep('phone');
    setOtp('');
    setDemoOtp('');
    setExpiresAt(0);
    setExpired(false);
    setError('');
    setNotFound(false);
  };

  const resendOtp = async () => {
    setError('');
    setDemoOtp('');
    setOtpBusy(true);
    try {
      const data = await sendOtp(normalizedPhone, 'login');
      setDemoOtp(data.demoOtp || '');
      setOtp('');
      setExpiresAt(Date.now() + (data.expiresInMinutes || 5) * 60 * 1000);
      setExpired(false);
    } catch (err) {
      setError(err.response?.data?.message || (err.code === 'ERR_NETWORK' ? t('login.errNetwork') : t('login.errOtp')));
    } finally {
      setOtpBusy(false);
    }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await otpLogin(normalizedPhone, otp);
      goHome();
    } catch (err) {
      setError(err.response?.data?.message || (err.code === 'ERR_NETWORK' ? t('login.errNetwork') : t('login.errOtpLogin')));
      setOtp('');
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      goHome();
    } catch (err) {
      setError(err.response?.data?.message || (err.code === 'ERR_NETWORK' ? t('login.errNetwork') : t('login.errLogin')));
    } finally {
      setBusy(false);
    }
  };

  const quickLogin = async (acct) => {
    setQuickBusy(acct.index);
    setError('');
    try {
      await demoLogin(acct.index);
      goHome();
    } catch (err) {
      setError(err.response?.data?.message || t('login.errLogin'));
    } finally {
      setQuickBusy('');
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card fade-in">
        <div className="auth-title">
          <img src={logo} alt="Super Toto Local logo" className="auth-logo" /> {t('common.appName')}
        </div>
        <p className="muted">{t('login.title')}</p>

        {error && <div className="err-box">{error}</div>}

        {step === 'phone' ? (
          <form onSubmit={continueWithPhone}>
            <div className="field">
              <label>{t('login.mobileLabel')}</label>
              <input
                className="input"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setNotFound(false);
                  setError('');
                }}
                placeholder={t('login.mobilePlaceholder')}
                inputMode="tel"
                autoFocus
              />
            </div>
            <p className="small muted" style={{ marginTop: -4, marginBottom: 12 }}>{t('login.phoneHint')}</p>

            {notFound && (
              <div className="alert alert-info mb">
                <b>{t('login.newHere')}</b> {t('login.noAccountFound')}
              </div>
            )}

            {notFound ? (
              <Link to={`/register?phone=${normalizedPhone}`} className="btn btn-primary btn-block btn-lg">
                {t('login.createAccountCta')}
              </Link>
            ) : (
              <button className="btn btn-primary btn-block btn-lg" disabled={otpBusy || !normalizedPhone}>
                {otpBusy ? t('login.checking') : t('login.continuePhone')}
              </button>
            )}
          </form>
        ) : (
          <form onSubmit={submitOtp}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="small muted">{t('login.otpSentTo', { phone: `+91 ${normalizedPhone}` })}</span>
              <button type="button" className="link-btn" onClick={changeNumber}>
                {t('login.changeNumber')}
              </button>
            </div>

            {demoOtp && <div className="alert alert-info mt mb">{t('login.otpSent')} (demo: <b>{demoOtp}</b>)</div>}

            <div className="field otp-container otp-active mt">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <label style={{ marginBottom: 0 }}>{t('login.otpLabel')}</label>
                {expired ? <span className="otp-expired">{t('login.otpExpired')}</span> : <OtpTimer expiresAt={expiresAt} onExpire={() => setExpired(true)} />}
              </div>
              <OtpInput value={otp} onChange={setOtp} length={6} disabled={expired} />
              {expired && <div className="small muted mt">{t('login.otpExpiredHint')}</div>}
            </div>

            <button className="btn btn-primary btn-block btn-lg mt" disabled={busy || !otp || expired || otp.length < 6}>
              {busy ? t('login.verifying') : t('login.loginWithOtp')}
            </button>

            <div className="small mt" style={{ textAlign: 'center' }}>
              <button type="button" className="link-btn" onClick={resendOtp} disabled={otpBusy}>
                {otpBusy ? t('login.sending') : t('login.resend')}
              </button>
            </div>
          </form>
        )}

        <div className="auth-divider" />

        {showPassword ? (
          <form onSubmit={submitPassword}>
            <div className="field">
              <label>{t('login.emailLabel')}</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('login.emailPlaceholder')} />
            </div>
            <div className="field">
              <label>{t('login.passwordLabel')}</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <button className="btn btn-ghost btn-block" disabled={busy}>
              {busy ? t('login.loggingIn') : t('login.submit')}
            </button>
            <div className="small mt" style={{ textAlign: 'center' }}>
              <Link to="/forgot-password">{t('login.forgot')}</Link>
            </div>
          </form>
        ) : (
          <div className="small" style={{ textAlign: 'center' }}>
            <button type="button" className="link-btn" onClick={() => setShowPassword(true)}>
              {t('login.useEmailPassword')}
            </button>
          </div>
        )}

        {roleGroups.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="small muted" style={{ textAlign: 'center' }}>
              <button type="button" className="link-btn" onClick={() => setShowDemo((s) => !s)}>
                {t('login.quickSignIn')} {showDemo ? '▴' : '▾'}
              </button>
            </div>
            {showDemo && (
              <div className="seg-row mt" style={{ flexWrap: 'wrap' }}>
                {roleGroups.map((g) => (
                  <button
                    key={g.role}
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => quickLogin(g)}
                    disabled={!!quickBusy}
                  >
                    {quickBusy === g.index ? t('login.loggingIn') : g.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="small mt" style={{ textAlign: 'center' }}>
          <Link to="/face-login">{t('login.faceLogin')}</Link>
        </div>

        <div className="small muted mt" style={{ textAlign: 'center' }}>
          {t('login.noAccount')} <Link to="/register">{t('login.createOne')}</Link>
        </div>
      </div>
    </div>
  );
}
