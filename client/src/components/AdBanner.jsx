import { useEffect, useState } from 'react';
import client from '../api/client.js';

export default function AdBanner({ position = 'bottom' }) {
  const [ad, setAd] = useState(null);

  useEffect(() => {
    let active = true;
    client.get('/ads-config').then(({ data }) => {
      if (!active) return;
      const cfg = data.adsConfig || {};
      if (!cfg.enabled || !cfg.bannerEnabled) return;
      const enabled = (cfg.ads || []).filter(a => a.enabled && a.image);
      if (!enabled.length) return;
      const pick = enabled[Math.floor(Math.random() * enabled.length)];
      setAd(pick);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  if (!ad) return null;

  const banner = (
    <div className={`ad-banner ad-banner-${position}`}>
      <a
        href={ad.link || '#'}
        target={ad.link ? '_blank' : undefined}
        rel="noopener noreferrer"
        className="ad-banner-inner"
      >
        <img src={ad.image} alt={ad.title} className="ad-banner-img" />
        <div className="ad-banner-text">
          <span className="ad-banner-title">{ad.title}</span>
          {ad.subtitle && <span className="ad-banner-sub">{ad.subtitle}</span>}
        </div>
        <span className="ad-banner-label">AD</span>
      </a>
      <button className="ad-banner-close" onClick={() => setAd(null)} aria-label="Close ad">×</button>
    </div>
  );

  return banner;
}
