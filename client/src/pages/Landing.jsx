import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client.js';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import logo from '../assets/super-toto-logo.png';

const DEFAULT_HELPLINE = '+919811997286';

export default function Landing() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [contact, setContact] = useState({ helplinePhone: DEFAULT_HELPLINE, helplineLabel: '', showHelpline: true });

  useEffect(() => {
    client
      .get('/contact-config')
      .then(({ data }) => setContact((prev) => ({ ...prev, ...(data.contactConfig || {}) })))
      .catch(() => {});
  }, []);

  const start = user ? (user.role === 'driver' ? '/driver' : user.role === 'admin' ? '/admin' : user.role === 'fleet_owner' ? '/fleet' : '/ride') : '/login';
  const bookRide = user?.role === 'rider' ? '/ride' : start;
  const helplinePhone = contact.helplinePhone || DEFAULT_HELPLINE;
  const helplineLabel = contact.helplineLabel || t('nav.helpline');
  const showHelpline = contact.showHelpline !== false && !!helplinePhone;

  const features = [
    { to: bookRide, icon: '📱', title: t('landing.featureBookTitle'), sub: t('landing.featureBookSub') },
    { to: bookRide, icon: '🛰️', title: t('landing.featureTrackTitle'), sub: t('landing.featureTrackSub') },
    { to: bookRide, icon: '💳', title: t('landing.featurePayTitle'), sub: t('landing.featurePaySub') },
    { to: bookRide, icon: '⭐', title: t('landing.featureRateTitle'), sub: t('landing.featureRateSub') },
    { to: '/register?role=driver', icon: '🛺', title: t('landing.featureDriverTitle'), sub: t('landing.featureDriverSub') },
    { to: '/login?role=admin', icon: '📊', title: t('landing.featureAdminTitle'), sub: t('landing.featureAdminSub') },
  ];

  const steps = [
    { n: 1, title: t('landing.step1Title'), sub: t('landing.step1Sub') },
    { n: 2, title: t('landing.step2Title'), sub: t('landing.step2Sub') },
    { n: 3, title: t('landing.step3Title'), sub: t('landing.step3Sub') },
  ];

  const trustBand = [
    { icon: '🛡️', title: t('landing.trustBandVerifiedTitle'), sub: t('landing.trustBandVerifiedSub') },
    { icon: '🩺', title: t('landing.trustBandInsuranceTitle'), sub: t('landing.trustBandInsuranceSub') },
    { icon: '📜', title: t('landing.trustBandComplianceTitle'), sub: t('landing.trustBandComplianceSub') },
    { icon: '🕐', title: t('landing.trustBandSupportTitle'), sub: t('landing.trustBandSupportSub') },
  ];

  return (
    <div className="landing">
      <header className="landing-top">
        <Link to="/" className="landing-brand">
          <img src={logo} alt="Super Toto Local logo" />
          <span>
            <span className="lb-name">{t('common.appName')}</span>
            <span className="lb-unit">{t('common.appUnit')}</span>
          </span>
        </Link>
        <div className="landing-top-actions">
          {showHelpline && (
            <a
              className="helpline-btn"
              href={`tel:${helplinePhone}`}
              title={t('nav.helplineTitle', { label: helplineLabel, phone: helplinePhone })}
            >
              <span className="helpline-icon">🆘</span>
              <span className="helpline-text">{helplineLabel}</span>
            </a>
          )}
          <LanguageSwitcher />
        </div>
      </header>

      <section className="hero">
        <span className="chip chip-active hero-chip">{t('landing.heroChip')}</span>

        <h1>
          {t('landing.heroTitle1')}
          <span className="accent">,</span>
          <br />
          {t('landing.heroTitle2')}
        </h1>
        <p>{t('landing.heroSub')}</p>

        <div className="hero-btns" data-tt="landing-cta">
          {user ? (
            <Link to={start} className="btn btn-primary btn-lg">
              {t('landing.openApp')}
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-primary btn-lg">
                {t('landing.ctaRide')}
              </Link>
              <Link to="/register" className="btn btn-ghost btn-lg">
                {t('landing.signupFree')}
              </Link>
            </>
          )}
        </div>

        <div className="emergency-strip" data-tt="landing-ambulance">
          <div className="emergency-icon" aria-hidden="true">
            🚑
          </div>
          <div className="emergency-copy">
            <b>{t('landing.ambulanceTitle')}</b>
            <p>{t('landing.ambulanceSub')}</p>
            <span className="small">{t('landing.emergencyNote')}</span>
          </div>
          <div className="emergency-actions">
            <Link to={bookRide} className="btn btn-danger">
              {t('landing.ambulanceCta')}
            </Link>
            <a href="tel:108" className="btn btn-ghost">
              📞 {t('landing.call108')}
            </a>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="section-head">
          <h2>{t('landing.featuresTitle')}</h2>
          <p>{t('landing.featuresSub')}</p>
        </div>
        <div className="features" data-tt="landing-features">
          {features.map((f) => (
            <Link to={f.to} className="feature" key={f.title}>
              <div className="icon">{f.icon}</div>
              <h4>{f.title}</h4>
              <p>{f.sub}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="section-head">
          <h2>{t('landing.howItWorks')}</h2>
        </div>
        <div className="lsteps">
          {steps.map((s) => (
            <div className="lstep" key={s.n}>
              <span className="lstep-num">{s.n}</span>
              <b>{s.title}</b>
              <p>{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="trust-band">
          {trustBand.map((item) => (
            <div className="trust-band-item" key={item.title}>
              <span className="tb-icon" aria-hidden="true">
                {item.icon}
              </span>
              <b>{item.title}</b>
              <span className="tb-sub">{item.sub}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-legal">
        <div className="small muted">
          Legal: <Link to="/legal/privacy">Privacy Policy (DPDP)</Link> ·{' '}
          <Link to="/legal/disclosures">Disclosures</Link> ·{' '}
          <Link to="/legal/disclosures">Grievance Officer</Link> ·{' '}
          <Link to="/legal/ambulance-rider-terms">Ambulance Terms</Link>
        </div>
        <div className="small muted mt" style={{ marginTop: 6 }}>
          {t('landing.langsNote')}
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>
          © {new Date().getFullYear()} TSA Enterprises · Operated under the Motor Vehicle Aggregator Guidelines,
          Ministry of Road Transport &amp; Highways, GoI
        </div>
      </footer>
    </div>
  );
}