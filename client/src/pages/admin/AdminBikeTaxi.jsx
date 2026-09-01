import { useState, useEffect } from 'react';
import client from '../../api/client.js';

export default function AdminBikeTaxi() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    client.get('/admin/bike-taxi').then(({ data }) => setCfg(data.bikeTaxiConfig || {}));
  }, []);

  const update = (patch) => setCfg(p => ({ ...p, ...patch }));

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const { data } = await client.put('/admin/bike-taxi', cfg);
      setCfg(data.bikeTaxiConfig);
      setMsg('Saved!');
    } catch { setMsg('Save failed'); }
    setSaving(false);
  };

  if (!cfg) return <div className="container"><p>Loading…</p></div>;

  return (
    <div className="container">
      <h2>🏍️ Bike Taxi Settings</h2>

      <div className="card">
        <h3>General</h3>
        <label className="toggle-row">
          <input type="checkbox" checked={cfg.enabled} onChange={e => update({ enabled: e.target.checked })} />
          <span>Enable bike taxi in the app</span>
        </label>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Safety Rules</h3>
        <label className="toggle-row">
          <input type="checkbox" checked={cfg.helmetRequired} onChange={e => update({ helmetRequired: e.target.checked })} />
          <span>Helmet required for rider</span>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={cfg.pillionAllowed} onChange={e => update({ pillionAllowed: e.target.checked })} />
          <span>Pillion rider allowed</span>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={cfg.riderSafetyAck} onChange={e => update({ riderSafetyAck: e.target.checked })} />
          <span>Require rider safety acknowledgement before booking</span>
        </label>

        <div className="field" style={{ marginTop: 12 }}>
          <label>Max passengers per ride</label>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <button type="button" className="btn btn-ghost small" onClick={() => update({ maxPassengers: Math.max(1, cfg.maxPassengers - 1) })}>−</button>
            <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{cfg.maxPassengers}</span>
            <button type="button" className="btn btn-ghost small" onClick={() => update({ maxPassengers: Math.min(3, cfg.maxPassengers + 1) })}>+</button>
          </div>
        </div>

        <div className="field">
          <label>Max ride distance (km)</label>
          <input className="input" type="number" min={5} max={50} value={cfg.maxRideDistanceKm} onChange={e => update({ maxRideDistanceKm: Number(e.target.value) })} />
        </div>

        <div className="field">
          <label>Minimum driver age</label>
          <input className="input" type="number" min={18} max={65} value={cfg.minDriverAge} onChange={e => update({ minDriverAge: Number(e.target.value) })} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Driver Documents</h3>
        <label className="toggle-row">
          <input type="checkbox" checked={cfg.requireInsurance} onChange={e => update({ requireInsurance: e.target.checked })} />
          <span>Require insurance document for bike taxi drivers</span>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={cfg.requirePuc} onChange={e => update({ requirePuc: e.target.checked })} />
          <span>Require PUC certificate for bike taxi drivers</span>
        </label>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Rider Safety Message</h3>
        <div className="field">
          <label>Message shown to riders when they select bike taxi</label>
          <textarea className="input" rows={3} value={cfg.safetyMessage} onChange={e => update({ safetyMessage: e.target.value })} />
        </div>
      </div>

      {msg && <div className={`alert ${msg.includes('fail') ? 'alert-warn' : 'alert-green'}`} style={{ marginTop: 12 }}>{msg}</div>}

      <button className="btn btn-primary btn-lg" style={{ marginTop: 16 }} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save All Changes'}
      </button>
    </div>
  );
}
