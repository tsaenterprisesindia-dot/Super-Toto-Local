import { useState, useEffect } from 'react';
import client from '../../api/client.js';

const TIP_ICONS = ['🔍', '📱', '🪪', '💰', '🚨', '🌙', '🚫', '⭐', '🛡️', '🚗', '💬', '🧭', '🔋', '📞', '🏥', '⏰', '🧾', '📍', '🚪', '🪙'];

export default function AdminSafetyTips() {
  const [cfg, setCfg] = useState(null);
  const [tab, setTab] = useState('rider');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [newTip, setNewTip] = useState({ icon: '📌', title: '', text: '' });

  useEffect(() => {
    client.get('/admin/safety-tips').then(({ data }) => setCfg(data.safetyTips || {}));
  }, []);

  const update = (patch) => setCfg(p => ({ ...p, ...patch }));

  const tipsKey = tab === 'rider' ? 'riderTips' : 'driverTips';
  const tips = cfg?.[tipsKey] || [];

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const { data } = await client.put('/admin/safety-tips', cfg);
      setCfg(data.safetyTips);
      setMsg('Saved!');
    } catch { setMsg('Save failed'); }
    setSaving(false);
  };

  const addTip = () => {
    if (!newTip.title || !newTip.text) return;
    update({ [tipsKey]: [...tips, { ...newTip, id: Date.now().toString(), enabled: true }] });
    setNewTip({ icon: '📌', title: '', text: '' });
  };

  const removeTip = (id) => {
    update({ [tipsKey]: tips.filter(t => t.id !== id) });
  };

  const toggleTip = (id) => {
    update({ [tipsKey]: tips.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t) });
  };

  const moveTip = (id, dir) => {
    const arr = [...tips];
    const idx = arr.findIndex(t => t.id === id);
    if (idx < 0) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    update({ [tipsKey]: arr });
  };

  const updateTip = (id, patch) => {
    update({ [tipsKey]: tips.map(t => t.id === id ? { ...t, ...patch } : t) });
  };

  if (!cfg) return <div className="container"><p>Loading…</p></div>;

  return (
    <div className="container">
      <h2>Safety Tips Manager</h2>

      <div className="card">
        <h3>General</h3>
        <label className="toggle-row">
          <input type="checkbox" checked={cfg.riderEnabled} onChange={e => update({ riderEnabled: e.target.checked })} />
          <span>Show safety tips to riders</span>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={cfg.driverEnabled} onChange={e => update({ driverEnabled: e.target.checked })} />
          <span>Show safety tips to drivers</span>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '16px 0 12px' }}>
        <button className={`btn ${tab === 'rider' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('rider')}>
          🛡️ Rider Tips ({cfg.riderTips?.length || 0})
        </button>
        <button className={`btn ${tab === 'driver' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('driver')}>
          🚗 Driver Tips ({cfg.driverTips?.length || 0})
        </button>
      </div>

      <div className="card">
        <h3>Add New {tab === 'rider' ? 'Rider' : 'Driver'} Tip</h3>
        <div className="field">
          <label>Icon</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {TIP_ICONS.map(icon => (
              <button
                key={icon}
                className={`btn btn-sm ${newTip.icon === icon ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setNewTip(p => ({ ...p, icon }))}
                style={{ fontSize: 18, padding: '4px 8px', minWidth: 36 }}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Title *</label>
          <input className="input" value={newTip.title} onChange={e => setNewTip(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Share Your Trip" />
        </div>
        <div className="field">
          <label>Description *</label>
          <textarea className="input" rows={2} value={newTip.text} onChange={e => setNewTip(p => ({ ...p, text: e.target.value }))} placeholder="Let a friend or family member track your ride in real time." />
        </div>
        <button className="btn btn-primary" onClick={addTip} disabled={!newTip.title || !newTip.text}>
          + Add Tip
        </button>
      </div>

      {tips.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>{tab === 'rider' ? 'Rider' : 'Driver'} Tips ({tips.length})</h3>
          <div className="admin-tips-list">
            {tips.map((tip, idx) => (
              <div key={tip.id} className="admin-tip-item">
                <span className="admin-tip-drag">
                  <button className="btn btn-ghost btn-sm" onClick={() => moveTip(tip.id, -1)} disabled={idx === 0}>↑</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => moveTip(tip.id, 1)} disabled={idx === tips.length - 1}>↓</button>
                </span>
                <span className="admin-tip-icon">{tip.icon}</span>
                <div className="admin-tip-content">
                  <input
                    className="input"
                    value={tip.title}
                    onChange={e => updateTip(tip.id, { title: e.target.value })}
                    style={{ fontWeight: 600, marginBottom: 4 }}
                  />
                  <textarea
                    className="input"
                    rows={2}
                    value={tip.text}
                    onChange={e => updateTip(tip.id, { text: e.target.value })}
                  />
                </div>
                <div className="admin-tip-actions">
                  <label className="toggle-row" style={{ margin: 0 }}>
                    <input type="checkbox" checked={tip.enabled} onChange={() => toggleTip(tip.id)} />
                    <span>{tip.enabled ? 'On' : 'Off'}</span>
                  </label>
                  <button className="btn btn-amber btn-sm" onClick={() => removeTip(tip.id)}>Remove</button>
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
