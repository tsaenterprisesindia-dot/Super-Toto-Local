import { useEffect, useState } from 'react';
import client from '../api/client.js';

export default function SafetyTips({ role = 'rider' }) {
  const [tips, setTips] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    client.get('/safety-tips').then(({ data }) => {
      const cfg = data.safetyTips || {};
      if (role === 'driver') {
        setEnabled(cfg.driverEnabled !== false);
        setTips((cfg.driverTips || []).filter(t => t.enabled));
      } else {
        setEnabled(cfg.riderEnabled !== false);
        setTips((cfg.riderTips || []).filter(t => t.enabled));
      }
    }).catch(() => {});
  }, [role]);

  if (!enabled || !tips.length) return null;

  return (
    <div className="safety-tips-section">
      <div className="safety-tips-header" onClick={() => setExpanded(expanded ? null : 'all')}>
        <span className="safety-tips-icon">🛡️</span>
        <span className="safety-tips-title">Safety Tips</span>
        <span className="safety-tips-toggle">{expanded ? '−' : '+'}</span>
      </div>
      {expanded && (
        <div className="safety-tips-grid">
          {tips.map((tip) => (
            <div key={tip.id} className="safety-tip-card" style={{ animationDelay: `${tips.indexOf(tip) * 0.05}s` }}>
              <span className="safety-tip-emoji">{tip.icon}</span>
              <div className="safety-tip-content">
                <strong className="safety-tip-title">{tip.title}</strong>
                <p className="safety-tip-text">{tip.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
