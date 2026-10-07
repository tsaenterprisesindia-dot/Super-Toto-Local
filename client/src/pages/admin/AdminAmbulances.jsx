import { useEffect, useState } from 'react';
import client from '../../api/client.js';

const STATUS_CONFIG = {
  pending: { label: 'Pending Review', cls: 'badge-amber' },
  active: { label: 'Active', cls: 'badge-green' },
  suspended: { label: 'Suspended', cls: 'badge-red' },
};

export default function AdminAmbulances() {
  const [records, setRecords] = useState([]);
  const [states, setStates] = useState([]);
  const [summary, setSummary] = useState(null);
  const [cfg, setCfg] = useState({ enabled: true, enabledStates: [], requirePatientConsent: true, maxRideDistanceKm: 150, note: '' });
  const [savingCfg, setSavingCfg] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [sweepBusy, setSweepBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const load = () => {
    client
      .get('/admin/ambulances')
      .then(({ data }) => {
        setRecords(data.records || []);
        setStates(data.states || []);
        setCfg(data.ambulanceConfig || {});
      })
      .catch((e) => setErr(e.response?.data?.message || 'Failed to load ambulance records'));
    client
      .get('/admin/ambulances/summary')
      .then(({ data }) => setSummary(data.summary))
      .catch(() => {});
  };

  useEffect(load, []);

  const toggleState = (code) =>
    setCfg((c) => ({
      ...c,
      enabledStates: (c.enabledStates || []).includes(code) ? c.enabledStates.filter((s) => s !== code) : [...(c.enabledStates || []), code],
    }));

  const saveCfg = async () => {
    setSavingCfg(true);
    setMsg('');
    setErr('');
    try {
      const { data } = await client.put('/admin/ambulance-config', cfg);
      setCfg(data.ambulanceConfig);
      setMsg('Ambulance config saved ✓');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to save config');
    } finally {
      setSavingCfg(false);
    }
  };

  const actOn = async (rec, status) => {
    if (!window.confirm(`Set this record to "${status}"?`)) return;
    setBusyId(rec.id);
    setErr('');
    setMsg('');
    try {
      await client.patch(`/admin/ambulances/${rec.id}`, { status });
      setMsg(`Record set to ${status}`);
      load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const runSweep = async () => {
    setSweepBusy(true);
    setErr('');
    setMsg('');
    try {
      const { data } = await client.post('/admin/ambulances/expire-sweep');
      setMsg(data.message || `Sweep complete — ${data.suspended} suspended`);
      load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Sweep failed');
    } finally {
      setSweepBusy(false);
    }
  };

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
  const stateName = (code) => states.find((s) => s.code === code)?.name || code || '—';
  const firstExpiry = (r) => {
    const items = r.expiryItems || [];
    if (items.length === 0) return null;
    return items
      .map((i) => ({ ...i, ts: i.validUpto ? new Date(i.validUpto).getTime() : Infinity }))
      .sort((a, b) => a.ts - b.ts)[0];
  };

  const tiles = [
    { label: 'Total', value: summary?.total || 0, cls: '' },
    { label: 'Pending', value: summary?.pending || 0, cls: 'badge-amber' },
    { label: 'Active', value: summary?.active || 0, cls: 'badge-green' },
    { label: 'Suspended', value: summary?.suspended || 0, cls: 'badge-red' },
    { label: 'Expiring ≤30d', value: summary?.expiring30 || 0, cls: 'badge-blue' },
  ];

  return (
    <div>
      <div className="spread">
        <h2 style={{ marginTop: 0 }}>🚑 Ambulance Aggregator</h2>
        <button className="btn btn-ghost" onClick={runSweep} disabled={sweepBusy}>
          {sweepBusy ? 'Running sweep…' : '🔁 Run expiry sweep'}
        </button>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="err-box">{err}</div>}

      <div className="card">
        <h3 style={{ margin: 0 }}>Live-on-state</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          {tiles.map((t) => (
            <div key={t.label} className="card" style={{ padding: '10px 16px', boxShadow: 'none', border: '1px solid var(--line)' }}>
              <div className="small muted">{t.label}</div>
              <span className={`badge ${t.cls}`} style={{ fontSize: 16, marginTop: 4 }}>
                {t.value}
              </span>
            </div>
          ))}
          {summary?.byState && (
            <div className="card" style={{ padding: '10px 16px', boxShadow: 'none', border: '1px solid var(--line)' }}>
              <div className="small muted">By state</div>
              {Object.keys(summary.byState).length === 0 ? (
                <div className="badge badge-gray">—</div>
              ) : (
                Object.entries(summary.byState).map(([s, c]) => (
                  <span key={s} className="badge badge-gray" style={{ marginRight: 4, marginTop: 4 }}>
                    {s} × {c}
                  </span>
                ))
              )}
            </div>
          )}
          {summary?.byType && (
            <div className="card" style={{ padding: '10px 16px', boxShadow: 'none', border: '1px solid var(--line)' }}>
              <div className="small muted">By type</div>
              {Object.keys(summary.byType).length === 0 ? (
                <div className="badge badge-gray">—</div>
              ) : (
                Object.entries(summary.byType).map(([t, c]) => (
                  <span key={t} className="badge badge-gray" style={{ marginRight: 4, marginTop: 4 }}>
                    {t} × {c}
                  </span>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: 0 }}>Service config</h3>
        <div className="row mt" style={{ gap: 10, flexWrap: 'wrap' }}>
          <label className="row" style={{ gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg((c) => ({ ...c, enabled: e.target.checked }))} />
            Enabled
          </label>
          <label className="row" style={{ gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={cfg.requirePatientConsent !== false}
              onChange={(e) => setCfg((c) => ({ ...c, requirePatientConsent: e.target.checked }))}
            />
            Require patient consent
          </label>
          <label className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span className="small muted">Max ride km</span>
            <input
              type="number"
              className="input"
              style={{ width: 90 }}
              value={cfg.maxRideDistanceKm}
              onChange={(e) => setCfg((c) => ({ ...c, maxRideDistanceKm: Number(e.target.value) }))}
            />
          </label>
        </div>
        <div className="small muted mt" style={{ fontWeight: 600 }}>
          Enable ambulance in states
        </div>
        <div className="row mt" style={{ gap: 8, flexWrap: 'wrap' }}>
          {states.map((s) => (
            <label key={s.code} className="row" style={{ gap: 4, alignItems: 'center' }}>
              <input type="checkbox" checked={(cfg.enabledStates || []).includes(s.code)} onChange={() => toggleState(s.code)} />
              <span className="small">{s.name}</span>
            </label>
          ))}
        </div>
        <input
          className="input mt"
          value={cfg.note || ''}
          onChange={(e) => setCfg((c) => ({ ...c, note: e.target.value }))}
          placeholder="Availability note shown to riders"
        />
        <button className="btn btn-primary mt" onClick={saveCfg} disabled={savingCfg}>
          {savingCfg ? 'Saving…' : 'Save config'}
        </button>
      </div>

      <div className="card">
        <h3 style={{ margin: 0 }}>Compliance register ({records.length})</h3>
        {records.length === 0 ? (
          <div className="small muted mt">No ambulance registrations yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {records.map((r) => {
              const exp = firstExpiry(r);
              const expSoon = exp && exp.validUpto && new Date(exp.validUpto).getTime() - Date.now() < 30 * 86400000;
              return (
                <div key={r.id} className="card" style={{ padding: 12, boxShadow: 'none', border: '1px solid var(--line)' }}>
                  <div className="spread">
                    <div>
                      <b>
                        🚑 {r.ambulanceType} · {r.stateCode} · {r.vehicleNumber || '—'}
                      </b>
                      {r.active && <span className="badge badge-green" style={{ marginLeft: 6 }}>eligible</span>}
                    </div>
                    <span className={`badge ${STATUS_CONFIG[r.status]?.cls || 'badge-gray'}`}>
                      {STATUS_CONFIG[r.status]?.label || r.status}
                    </span>
                  </div>
                  <div className="small muted mt">
                    {r.driver?.name || '—'} · {r.driver?.phone || '—'}
                  </div>
                  <div className="small muted mt">
                    {r.expiryItems.length > 0 ? (
                      <>
                        {exp && <span style={{ color: expSoon ? 'var(--danger)' : 'var(--text)', fontWeight: 600 }}>Earliest expiry: {fmtDate(exp.validUpto)}</span>}
                        <button className="btn btn-ghost small" style={{ marginLeft: 8 }} onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                          {expandedId === r.id ? 'Hide docs' : 'Docs'}
                        </button>
                      </>
                    ) : (
                      'No document expiry dates submitted'
                    )}
                  </div>
                  {expandedId === r.id && (
                    <div className="small muted mt" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {r.expiryItems.map((it) => (
                        <span key={it.key}>
                          <b>{it.label.replace(' Upto', '')}:</b> {fmtDate(it.validUpto)}
                        </span>
                      ))}
                      <span>
                        <b>Equipment:</b> {r.equipmentList || '—'}
                      </span>
                    </div>
                  )}
                  {r.rejectionReason && (
                    <div className="small" style={{ marginTop: 6, color: 'var(--danger)' }}>
                      ⚠ {r.rejectionReason}
                    </div>
                  )}
                  {r.notes && (
                    <div className="small muted" style={{ marginTop: 4 }}>
                      {r.notes}
                    </div>
                  )}
                  <div className="row mt" style={{ gap: 8 }}>
                    {r.status !== 'active' && (
                      <button className="btn btn-primary small" disabled={busyId === r.id} onClick={() => actOn(r, 'active')}>
                        Approve
                      </button>
                    )}
                    {r.status !== 'suspended' && (
                      <button className="btn btn-danger small" disabled={busyId === r.id} onClick={() => actOn(r, 'suspended')}>
                        Suspend
                      </button>
                    )}
                    {r.status !== 'pending' && (
                      <button className="btn btn-ghost small" disabled={busyId === r.id} onClick={() => actOn(r, 'pending')}>
                        Request re-review
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}