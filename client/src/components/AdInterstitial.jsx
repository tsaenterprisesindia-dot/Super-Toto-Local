import { useEffect, useState } from 'react';
import client from '../api/client.js';

export default function AdInterstitial({ visible, onClose }) {
  const [ad, setAd] = useState(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!visible) { setAd(null); return; }
    client.get('/ads-config').then(({ data }) => {
      const cfg = data.adsConfig || {};
      if (!cfg.enabled || !cfg.interstitialEnabled) { onClose(); return; }
      const enabled = (cfg.ads || []).filter(a => a.enabled && a.image);
      if (!enabled.length) { onClose(); return; }
      const pick = enabled[Math.floor(Math.random() * enabled.length)];
      setAd(pick);
      setCountdown(5);
    }).catch(() => { onClose(); });
  }, [visible]);

  useEffect(() => {
    if (!visible || !ad || countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [visible, ad, countdown]);

  if (!visible || !ad) return null;

  return (
    <div className="ad-interstitial-overlay" onClick={onClose}>
      <div className="ad-interstitial-card" onClick={e => e.stopPropagation()}>
        <div className="ad-interstitial-label">Sponsored</div>
        <img src={ad.image} alt={ad.title} className="ad-interstitial-img" />
        <div className="ad-interstitial-text">
          <h3>{ad.title}</h3>
          {ad.subtitle && <p>{ad.subtitle}</p>}
        </div>
        {ad.link && (
          <a
            href={ad.link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-block ad-interstitial-cta"
          >
            Learn More
          </a>
        )}
        <button
          className="ad-interstitial-close"
          disabled={countdown > 0}
          onClick={onClose}
        >
          {countdown > 0 ? `Skip in ${countdown}s` : 'Skip Ad ×'}
        </button>
      </div>
    </div>
  );
}
