import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client.js';
import PasswordInput from '../components/PasswordInput.jsx';
import OtpInput from '../components/OtpInput.jsx';
import OtpTimer from '../components/OtpTimer.jsx';
import logo from '../assets/super-toto-logo.png';

const ROLES = [
  { key: 'rider' },
  { key: 'driver' },
  { key: 'admin' },
];

const ROLE_T = {
  rider: 'login.roleRider',
  driver: 'login.roleDriver',
  admin: 'login.roleAdmin',
};

export default function Login() {
  const { login, otpLogin, sendOtp } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState('password'); // password | otp
  const [role, setRole] = useState(searchParams.get('role') === 'admin' ? 'admin' : 'rider');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpPhone, setOtpPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);

  const pickRole = (r) => {
    setRole(r);
    setError('');
  };

  const goHome = (user) => navigate(user.role === 'driver' ? '/driver' : user.role === 'admin' ? '/admin' : '/ride');

  const submitPassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { user } = await login(email, password);
      goHome(user);
    } catch (err) {
      setError(err.response?.data?.message || (err.code === 'ERR_NETWORK' ? t('login.errNetwork') : t('login.errLogin')));
    } finally {
      setBusy(false);
    }
  };

  const requestOtp = async () => {
    setError('');
    setDemoOtp('');
    setOtpBusy(true);
    try {
      const data = await sendOtp(otpPhone, 'login');
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
      const { user } = await otpLogin(otpPhone, otp);
      goHome(user);
    } catch (err) {
      setError(err.response?.data?.message || (err.code === 'ERR_NETWORK' ? t('login.errNetwork') : t('login.errOtpLogin')));
      setOtp('');
    } finally {
      setBusy(false);
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

        <div className="seg-row mb">
          <button type="button" className={`seg${mode === 'password' ? ' active' : ''}`} onClick={() => setMode('password')}>
            {t('login.tabPassword')}
          </button>
          <button type="button" className={`seg${mode === 'otp' ? ' active' : ''}`} onClick={() => setMode('otp')}>
            {t('login.tabOtp')}
          </button>
        </div>

        <div className="seg-row mb">
          {ROLES.map((r) => (
            <button
              type="button"
              key={r.key}
              className={`seg${role === r.key ? ' active' : ''}`}
              onClick={() => pickRole(r.key)}
            >
              {t(ROLE_T[r.key])}
            </button>
          ))}
        </div>

        {mode === 'password' ? (
          <form onSubmit={submitPassword}>
            <div className="field">
              <label>{t('login.emailLabel')}</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('login.emailPlaceholder')} />
            </div>
            <div className="field">
              <label>{t('login.passwordLabel')}</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
              {busy ? t('login.loggingIn') : t('login.submit')}
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp}>
            <div className="field">
              <label>{t('login.mobileLabel')}</label>
              <div className="row">
                <input
                  className="input"
                  value={otpPhone}
                  onChange={(e) => {
                    setOtpPhone(e.target.value);
                    setExpiresAt(0);
                    setExpired(false);
                    setDemoOtp('');
                    setOtp('');
                  }}
                  placeholder={t('login.mobilePlaceholder')}
                  inputMode="tel"
                />
                <button type="button" className="btn btn-ghost" onClick={requestOtp} disabled={otpBusy || !otpPhone}>
                  {otpBusy ? t('login.sending') : otpPhone && (expiresAt || demoOtp) ? t('login.resend') : t('login.sendOtp')}
                </button>
              </div>
            </div>

            {demoOtp && (
              <div className="alert alert-info mb">
                <b>{t('login.demoSmsLabel')}:</b> {t('login.demoSmsBody', { otp: demoOtp })}
              </div>
            )}

            {expiresAt > 0 && (
              <div className="field otp-container otp-active">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <label style={{ marginBottom: 0 }}>{t('login.otpLabel')}</label>
                  {expired ? <span className="otp-expired">{t('login.otpExpired')}</span> : <OtpTimer expiresAt={expiresAt} onExpire={() => setExpired(true)} />}
                </div>
                <OtpInput value={otp} onChange={setOtp} length={6} disabled={expired} />
                {expired && <div className="small muted mt">{t('login.otpExpiredHint')}</div>}
              </div>
            )}

            <button className="btn btn-primary btn-block btn-lg" disabled={busy || !otp || expired || otp.length < 6}>
              {busy ? t('login.verifying') : t('login.loginWithOtp')}
            </button>
          </form>
        )}

        <div className="small mt" style={{ textAlign: 'center' }}>
          <Link to="/face-login">{t('login.faceLogin')}</Link>
        </div>

        <div className="small muted mt" style={{ textAlign: 'center' }}>
          <Link to="/forgot-password">{t('login.forgot')}</Link>
        </div>

        <div className="small muted mt" style={{ textAlign: 'center' }}>
          {t('login.noAccount')} <Link to="/register">{t('login.createOne')}</Link>
        </div>
      </div>
    </div>
  );
}
