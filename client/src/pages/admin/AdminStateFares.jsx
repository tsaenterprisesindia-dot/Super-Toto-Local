import { useEffect, useState } from 'react';
import client from '../../api/client.js';

const STATUSES = [
  { value: 'draft', label: 'Draft', cls: 'badge-gray' },
  { value: 'active', label: 'Active', cls: 'badge-green' },
  { value: 'archived', label: 'Archived', cls: 'badge-red' },
];

const RATE_FIELDS = [
  { key: 'base', label: 'Base (₹)' },
  { key: 'perKm', label: 'Per km (₹)' },
  { key: 'perMin', label: 'Per min (₹)' },
  { key: 'minimum', label: 'Minimum (₹)' },
  { key: 'seatCount', label: 'Seats' },
];

const BLANK = { base: '', perKm: '', perMin: '', minimum: '', seatCount: '' };

export default function AdminStateFares() {
  const [states, setStates] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    client.get('/admin/state-fares')
      .then(({ data }) => {
        setStates(data.states || []);
        setVehicleTypes(data.vehicleTypes || []);
      })
      .catch((e) => setErr(e.response?.data?.message || 'Failed to load states'));
  };

  useEffect(load, []);

  const open = (st) => {
    const p = st.policy || {};
    const vehicleRates = {};
    for (const vt of vehicleTypes) {
      vehicleRates[vt.id] = {
        base: p.vehicleRates?.[vt.id]?.base ?? '',
        perKm: p.vehicleRates?.[vt.id]?.perKm ?? '',
        perMin: p.vehicleRates?.[vt.id]?.perMin ?? '',
        minimum: p.vehicleRates?.[vt.id]?.minimum ?? '',
        seatCount: p.vehicleRates?.[vt.id]?.seatCount ?? '',
      };
    }
    setSelected(st);
    setForm({
      status: p.status || 'draft',
      effectiveFrom: p.effectiveFrom || (p.status === 'active' ? new Date().toISOString().slice(0, 10) : ''),
      effectiveUntil: p.effectiveUntil || '',
      sourceLabel: p.sourceLabel || '',
      sourceUrl: p.sourceUrl || '',
      surgeCap: p.surgeCap ?? '',
      cancellationFee: p.cancellationFee ?? '',
      notes: p.notes || '',
      vehicleRates,
    });
    setMsg('');
    setErr('');
  };

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setRate = (vtId, key) => (e) =>
    setForm((f) => ({ ...f, vehicleRates: { ...f.vehicleRates, [vtId]: { ...f.vehicleRates[vtId], [key]: e.target.value } } }));

  const copyDefaults = () => {
    const next = { ...form, vehicleRates: {} };
    for (const vt of vehicleTypes) {
      next.vehicleRates[vt.id] = {
        base: vt.defaultRates?.base ?? '',
        perKm: vt.defaultRates?.perKm ?? '',
        perMin: vt.defaultRates?.perMin ?? '',
        minimum: vt.defaultRates?.minimum ?? '',
        seatCount: vt.defaultRates?.seatCount ?? '',
      };
    }
    setForm(next);
  };

  const clearRates = () => {
    const next = { ...form, vehicleRates: {} };
    for (const vt of vehicleTypes) next.vehicleRates[vt.id] = { ...BLANK };
    setForm(next);
  };

  const save = async () => {
    setSaving(true); setMsg(''); setErr('');
    try {
      const { data } = await client.put(`/admin/state-fares/${selected.code}`, form);
      setMsg(`Saved ${selected.name} — ${data.policy.status}. National defaults apply for any field left blank.`);
      load();
      const st = states.find((s) => s.code === selected.code);
      if (st) open({ ...st, policy: data.policy });
      setSelected((cur) => (cur ? { ...cur, policy: data.policy } : cur));
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  const filtered = states.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.code.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="fade-in">
      <div className="spread">
        <h2 style={{ marginTop: 0 }}>🗺️ State-wise Fare Policies</h2>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Search state…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="muted">
        Each state's transport department (and MoRTH) sets its own fares — per-km, minimum, surge caps and cancellation fees differ by state.
        Add a policy per state, mark it <b>Active</b>, and the fare engine will apply it when riders choose that state. Blank rate fields fall back to the national defaults.
      </p>

      {err && <div className="err-box">{err}</div>}
      {msg && <div className="alert alert-green mb">{msg}</div>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>State</th>
              <th>Status</th>
              <th>Effective from</th>
              <th>Source (fare notification)</th>
              <th>Surge cap</th>
              <th>Cancellation fee</th>
              <th>Updated</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((st) => {
              const p = st.policy;
              const stCfg = STATUSES.find((s) => s.value === p?.status);
              return (
                <tr key={st.code}>
                  <td><b>{st.name}</b> <span className="small muted">({st.code}{st.ut ? ' · UT' : ''})</span></td>
                  <td>
                    <span className={`badge ${p ? stCfg.cls : 'badge-gray'}`}>{p ? p.status : '—'}</span>
                  </td>
                  <td className="small">{p?.effectiveFrom || '—'}</td>
                  <td className="small">{p?.sourceLabel || '—'}</td>
                  <td className="small">{p?.surgeCap ? `×${p.surgeCap}` : 'global'}</td>
                  <td className="small">{p?.cancellationFee != null ? `₹${p.cancellationFee}` : 'global'}</td>
                  <td className="small">{p?.lastUpdatedAt ? new Date(p.lastUpdatedAt).toLocaleDateString('en-IN') : '—'}</td>
                  <td>
                    <button className="btn btn-ghost small" onClick={() => open(st)}>{p ? 'Edit' : 'Add policy'}</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={8} className="muted center">No states found.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && form && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="spread">
            <h3 style={{ margin: 0 }}>{selected.name} ({selected.code})</h3>
            <button className="btn btn-ghost small" onClick={() => setSelected(null)}>✕ Close</button>
          </div>

          <div className="mt" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Status</label>
              <select className="input" value={form.status} onChange={setF('status')}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Effective date (fare notification date)</label>
              <input className="input" type="date" value={form.effectiveFrom} onChange={setF('effectiveFrom')} />
            </div>
            <div className="field">
              <label>Surge cap (max ×; 1 = surge banned)</label>
              <input className="input" type="number" step="0.1" min="1" max="4" placeholder="blank = global cap" value={form.surgeCap} onChange={setF('surgeCap')} />
            </div>
            <div className="field">
              <label>Cancellation fee (₹)</label>
              <input className="input" type="number" min="0" placeholder="blank = global fee" value={form.cancellationFee} onChange={setF('cancellationFee')} />
            </div>
            <div className="field">
              <label>Source label (e.g. "Bihar Transport Dept. tariff dated 01-01-2026")</label>
              <input className="input" value={form.sourceLabel} onChange={setF('sourceLabel')} placeholder="Govt. fare notification reference" />
            </div>
            <div className="field">
              <label>Source URL / PDF link</label>
              <input className="input" value={form.sourceUrl} onChange={setF('sourceUrl')} placeholder="https://… (optional)" />
            </div>
          </div>

          <div className="field">
            <label>Admin notes (policy reference)</label>
            <textarea className="input" rows={2} value={form.notes} onChange={setF('notes')} placeholder="What changed vs the previous revision?" />
          </div>

          <div className="spread mt">
            <h4 style={{ margin: 0 }}>Vehicle rates (blank = national default)</h4>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-ghost small" onClick={copyDefaults}>Copy national defaults</button>
              <button className="btn btn-ghost small" onClick={clearRates}>Clear to national</button>
            </div>
          </div>
          <div className="card table-wrap mt">
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  {RATE_FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {vehicleTypes.map((vt) => (
                  <tr key={vt.id}>
                    <td><b>{vt.label || vt.id}</b><div className="small muted">default: ₹{vt.defaultRates?.base}/{vt.defaultRates?.perKm}km · min ₹{vt.defaultRates?.minimum}</div></td>
                    {RATE_FIELDS.map((f) => (
                      <td key={f.key}>
                        <input
                          className="input"
                          style={{ minWidth: 72 }}
                          type="number"
                          step={f.key === 'seatCount' ? '1' : '0.5'}
                          min={f.key === 'seatCount' ? 1 : 0}
                          placeholder={vt.defaultRates?.[f.key] != null ? String(vt.defaultRates[f.key]) : ''}
                          value={form.vehicleRates[vt.id]?.[f.key] ?? ''}
                          onChange={setRate(vt.id, f.key)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row mt" style={{ justifyContent: 'flex-end', gap: 8 }}>
            {form.lastUpdatedBy || selected.policy?.lastUpdatedBy ? (
              <span className="small muted" style={{ marginRight: 'auto' }}>Last updated by {selected.policy?.lastUpdatedBy || form.lastUpdatedBy} · {selected.policy?.lastUpdatedAt ? new Date(selected.policy.lastUpdatedAt).toLocaleString('en-IN') : ''}</span>
            ) : null}
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save policy'}</button>
          </div>
        </div>
      )}
    </div>
  );
}