import { useState, useEffect } from 'react';
import client from '../../api/client.js';

const FIELDS = [
  { key: 'base', label: 'Base fare (₹)', step: 1 },
  { key: 'perKm', label: 'Per km (₹)', step: 0.5 },
  { key: 'perMin', label: 'Per minute (₹)', step: 0.5 },
  { key: 'minimum', label: 'Minimum fare (₹)', step: 1 },
  { key: 'minutesPerKm', label: '1 km = ? minutes', step: 0.1 },
  { key: 'seatCount', label: 'Seats per trip', step: 1, min: 1 },
];

function formatDuration(minutes) {
  if (minutes < 1) return '<1 min';
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

export default function AdminVehicleRates() {
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [rates, setRates] = useState({});
  const [defaults, setDefaults] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    client
      .get('/admin/vehicle-rates')
      .then(({ data }) => {
        setVehicleTypes(data.vehicleTypes || []);
        setRates(data.rates || {});
        const def = {};
        for (const vt of data.vehicleTypes || []) {
          def[vt.id] = vt.defaultRates;
        }
        setDefaults(def);
      })
      .catch(() => {});
  }, []);

  const setRate = (vtId, key, value) =>
    setRates((prev) => ({
      ...prev,
      [vtId]: { ...prev[vtId], [key]: Number(value) || 0 },
    }));

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      const { data } = await client.put('/admin/vehicle-rates', rates);
      setRates(data.rates);
      setMsg('Vehicle rates saved — applies to new rides immediately.');
    } catch (e) {
      setMsg(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    const def = {};
    for (const vt of vehicleTypes) {
      def[vt.id] = { ...vt.defaultRates };
    }
    setRates(def);
  };

  return (
    <div className="fade-in">
      <h2 style={{ marginTop: 0 }}>🚗 Travel Rate Sheet</h2>
      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        Set fare rates and travel time per vehicle type. Set <b>1 km = ? minutes</b> for each vehicle.
        Speed is auto-calculated. Changes apply immediately to new rides.
      </p>

      {msg && (
        <div className={`alert mb ${msg.includes('fail') ? 'alert-warn' : 'alert-green'}`}>{msg}</div>
      )}

      {/* Summary table */}
      <div className="card" style={{ padding: 16, marginBottom: 20, overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Quick Comparison</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--line)' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Vehicle</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>Base (₹)</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Per km (₹)</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>Per min (₹)</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>Min (₹)</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>1 km time</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>Speed</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>Seats</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>5 km fare</th>
            </tr>
          </thead>
          <tbody>
            {vehicleTypes.map((vt) => {
              const r = rates[vt.id] || {};
              const mpk = r.minutesPerKm || 2;
              const speed = Math.round(60 / mpk);
              const sampleDist = 5;
              const sampleTime = Math.round(sampleDist * mpk);
              const sampleFare = Math.round(
                (r.base || 0) + (r.perKm || 0) * sampleDist + (r.perMin || 0) * sampleTime
              );
              return (
                <tr key={vt.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px', fontWeight: 600 }}>{vt.label}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{r.base || 0}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{r.perKm || 0}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{r.perMin || 0}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{r.minimum || 0}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{mpk} min/km</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{speed} km/h</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{r.seatCount || 0}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>₹{sampleFare}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Editable cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800 }}>
        {vehicleTypes.map((vt) => {
          const r = rates[vt.id] || {};
          const mpk = r.minutesPerKm || 2;
          const speed = Math.round(60 / mpk);
          return (
            <div className="card" key={vt.id} style={{ padding: 20 }}>
              <div className="spread" style={{ marginBottom: 14 }}>
                <h3 style={{ margin: 0 }}>{vt.label}</h3>
                {rates[vt.id]?.base !== defaults[vt.id]?.base && (
                  <span className="badge badge-amber">Modified</span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                {FIELDS.map((f) => (
                  <div className="field" key={f.key} style={{ marginBottom: 0 }}>
                    <label htmlFor={`rate-${vt.id}-${f.key}`}>{f.label}</label>
                    <input
                      id={`rate-${vt.id}-${f.key}`}
                      className="input"
                      type="number"
                      step={f.step}
                      min={f.min || 0}
                      value={rates[vt.id]?.[f.key] ?? ''}
                      onChange={(e) => setRate(vt.id, f.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg, #f8fafc)', borderRadius: 8, border: '1px solid var(--line, #e2e8f0)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Travel Time & Fare Preview</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div>
                    <span className="muted">1 km = </span>
                    <b>{formatDuration(mpk)}</b>
                  </div>
                  <div>
                    <span className="muted">5 km = </span>
                    <b>{formatDuration(5 * mpk)}</b>
                  </div>
                  <div>
                    <span className="muted">10 km = </span>
                    <b>{formatDuration(10 * mpk)}</b>
                  </div>
                </div>
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div>
                    <span className="muted">5 km fare: </span>
                    <b>₹{Math.round((r.base || 0) + (r.perKm || 0) * 5 + (r.perMin || 0) * Math.round(5 * mpk))}</b>
                    {r.seatCount > 1 && (
                      <span className="muted"> · ₹{Math.max(1, Math.round(((r.base || 0) + (r.perKm || 0) * 5 + (r.perMin || 0) * Math.round(5 * mpk)) / r.seatCount))}/seat</span>
                    )}
                  </div>
                  <div>
                    <span className="muted">10 km fare: </span>
                    <b>₹{Math.round((r.base || 0) + (r.perKm || 0) * 10 + (r.perMin || 0) * Math.round(10 * mpk))}</b>
                  </div>
                  <div>
                    <span className="muted">Speed: </span>
                    <b>{speed} km/h</b>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 16, maxWidth: 800 }}>
        <button className="btn btn-primary" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save all rates'}
        </button>
        <button className="btn btn-ghost" disabled={saving} onClick={resetDefaults}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
