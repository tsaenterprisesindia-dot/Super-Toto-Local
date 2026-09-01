import { useState, useEffect } from 'react';
import client from '../../api/client.js';

export default function AdminAds() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [newAd, setNewAd] = useState({ title: '', subtitle: '', image: '', link: '' });

  useEffect(() => {
    client.get('/admin/ads-config').then(({ data }) => setCfg(data.adsConfig || {}));
  }, []);

  const update = (patch) => setCfg(p => ({ ...p, ...patch }));

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const { data } = await client.put('/admin/ads-config', cfg);
      setCfg(data.adsConfig);
      setMsg('Saved!');
    } catch { setMsg('Save failed'); }
    setSaving(false);
  };

  const addAd = () => {
    if (!newAd.title || !newAd.image) return;
    update({ ads: [...(cfg.ads || []), { ...newAd, id: Date.now().toString(), enabled: true, priority: 0 }] });
    setNewAd({ title: '', subtitle: '', image: '', link: '' });
  };

  const removeAd = (id) => {
    update({ ads: (cfg.ads || []).filter(a => a.id !== id) });
  };

  const toggleAd = (id) => {
    update({ ads: (cfg.ads || []).map(a => a.id === id ? { ...a, enabled: !a.enabled } : a) });
  };

  if (!cfg) return <div className="container"><p>Loading…</p></div>;

  return (
    <div className="container">
      <h2>Ad Manager</h2>

      <div className="card">
        <h3>General Settings</h3>
        <label className="toggle-row">
          <input type="checkbox" checked={cfg.enabled} onChange={e => update({ enabled: e.target.checked })} />
          <span>Enable ads globally</span>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={cfg.bannerEnabled} onChange={e => update({ bannerEnabled: e.target.checked })} />
          <span>Enable banner ads (bottom of screen)</span>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={cfg.interstitialEnabled} onChange={e => update({ interstitialEnabled: e.target.checked })} />
          <span>Enable interstitial ads (full screen popups)</span>
        </label>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Show interstitial every N rides</label>
          <input
            className="input"
            type="number"
            min={1}
            value={cfg.interstitialFrequency}
            onChange={e => update({ interstitialFrequency: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Add New Ad</h3>
        <div className="field">
          <label>Ad Title *</label>
          <input className="input" value={newAd.title} onChange={e => setNewAd(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Super Toto Premium" />
        </div>
        <div className="field">
          <label>Subtitle</label>
          <input className="input" value={newAd.subtitle} onChange={e => setNewAd(p => ({ ...p, subtitle: e.target.value }))} placeholder="Optional subtitle" />
        </div>
        <div className="field">
          <label>Image URL *</label>
          <input className="input" value={newAd.image} onChange={e => setNewAd(p => ({ ...p, image: e.target.value }))} placeholder="https://example.com/ad-image.jpg" />
        </div>
        <div className="field">
          <label>Click URL</label>
          <input className="input" value={newAd.link} onChange={e => setNewAd(p => ({ ...p, link: e.target.value }))} placeholder="https://example.com (opens on click)" />
        </div>
        <button className="btn btn-primary" onClick={addAd} disabled={!newAd.title || !newAd.image}>
          + Add Ad
        </button>
      </div>

      {(cfg.ads || []).length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Your Ads ({(cfg.ads || []).length})</h3>
          <div className="admin-ads-list">
            {(cfg.ads || []).map(ad => (
              <div key={ad.id} className="admin-ad-item">
                <img src={ad.image} alt={ad.title} className="admin-ad-thumb" />
                <div className="admin-ad-info">
                  <strong>{ad.title}</strong>
                  {ad.subtitle && <span className="small muted">{ad.subtitle}</span>}
                  {ad.link && <a href={ad.link} target="_blank" rel="noopener noreferrer" className="small">{ad.link}</a>}
                </div>
                <div className="admin-ad-actions">
                  <label className="toggle-row" style={{ margin: 0 }}>
                    <input type="checkbox" checked={ad.enabled} onChange={() => toggleAd(ad.id)} />
                    <span>{ad.enabled ? 'On' : 'Off'}</span>
                  </label>
                  <button className="btn btn-amber btn-sm" onClick={() => removeAd(ad.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {msg && <div className={`alert ${msg.includes('fail') ? 'alert-warn' : 'alert-green'}`} style={{ marginTop: 12 }}>{msg}</div>}

      <button className="btn btn-primary btn-lg" style={{ marginTop: 16 }} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save All Changes'}
      </button>
    </div>
  );
}
