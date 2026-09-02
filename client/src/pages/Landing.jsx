import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import logo from '../assets/super-toto-logo.png';

export default function Landing() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const start = user ? (user.role === 'driver' ? '/driver' : user.role === 'admin' ? '/admin' : '/ride') : '/register';

  return (
    <div className="landing">
      <div className="hero">
        <img src={logo} alt="Super Toto Local logo" className="hero-logo" />
        <span className="chip chip-active" style={{ fontSize: 15, padding: '8px 16px' }}>
          {t('landing.heroChip')}
        </span>
        <h1>
          {t('landing.heroTitle1')} <span className="accent">toto</span>,<br />
          {t('landing.heroTitle2')}
        </h1>
        <p>{t('landing.heroSub')}</p>
        <p className="muted" style={{ marginTop: '-6px', marginBottom: '22px' }}>
          {t('common.appUnit')}
        </p>
        <div className="hero-btns">
          <Link to={start} className="btn btn-primary btn-lg">
            {user ? t('landing.openApp') : t('landing.getStarted')}
          </Link>
          {!user && (
            <>
              <Link to="/login" className="btn btn-ghost btn-lg">
                {t('landing.login')}
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="card demo-card">
        <h3>{t('landing.demoTitle')}</h3>
        <div className="demo-accounts">
          <div className="demo-account">
            <b>{t('landing.demoRider')}</b>
            <div className="small muted">rider@supertoto.local</div>
            <div className="small muted">{t('landing.demoPwRider')}</div>
          </div>
          <div className="demo-account">
            <b>{t('landing.demoDriver')}</b>
            <div className="small muted">driver@supertoto.local</div>
            <div className="small muted">{t('landing.demoPwDriver')}</div>
          </div>
        </div>
        <p className="small muted mt">{t('landing.demoTip')}</p>
      </div>

      <div className="features">
        <div className="feature">
          <div className="icon">📱</div>
          <h4>{t('landing.featureBookTitle')}</h4>
          <p>{t('landing.featureBookSub')}</p>
        </div>
        <div className="feature">
          <div className="icon">🛰️</div>
          <h4>{t('landing.featureTrackTitle')}</h4>
          <p>{t('landing.featureTrackSub')}</p>
        </div>
        <div className="feature">
          <div className="icon">🛺</div>
          <h4>{t('landing.featureDriverTitle')}</h4>
          <p>{t('landing.featureDriverSub')}</p>
        </div>
        <div className="feature">
          <div className="icon">📊</div>
          <h4>{t('landing.featureAdminTitle')}</h4>
          <p>{t('landing.featureAdminSub')}</p>
        </div>
        <div className="feature">
          <div className="icon">💳</div>
          <h4>{t('landing.featurePayTitle')}</h4>
          <p>{t('landing.featurePaySub')}</p>
        </div>
        <div className="feature">
          <div className="icon">⭐</div>
          <h4>{t('landing.featureRateTitle')}</h4>
          <p>{t('landing.featureRateSub')}</p>
        </div>
      </div>

      <div className="demo-card" style={{ textAlign: 'center', borderTop: '1px solid var(--border)', padding: '16px 12px' }}>
        <div className="small muted">
          Legal: <Link to="/legal/privacy">Privacy Policy (DPDP)</Link> ·{' '}
          <Link to="/legal/disclosures">Disclosures</Link> ·{' '}
          <Link to="/legal/disclosures">Grievance Officer</Link>
        </div>
        <div className="small muted mt" style={{ marginTop: 4 }}>© {new Date().getFullYear()} TSA Enterprises · Operated under the Motor Vehicle Aggregator Guidelines, Ministry of Road Transport &amp; Highways, GoI</div>
      </div>
    </div>
  );
}
