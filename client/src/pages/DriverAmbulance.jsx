import { useEffect, useState } from 'react';
import client from '../api/client.js';
import { Link } from 'react-router-dom';

const DOC_FIELDS = [
  { key: 'permit', label: 'State Transport Permit' },
  { key: 'fitness', label: 'Fitness Certificate' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'roadTax', label: 'Road Tax' },
  { key: 'puc', label: 'PUC' },
  { key: 'drivingLicense', label: 'Driver License' },
  { key: 'emtCert', label: 'EMT Certification' },
];

const STATUS_CONFIG = {
  pending: { label: 'Under Review', cls: 'badge-amber' },
  active: { label: 'Active', cls: 'badge-green' },
  suspended: { label: 'Suspended', cls: 'badge-red' },
};

const emptyForm = () => ({
  stateCode: '',
  ambulanceType: 'BLS',
  vehicleNumber: '',
  docs: Object.fromEntries(DOC_FIELDS.map((d) => [d.key, { number: '', validUpto: '' }])),
  equipmentList: '',
});

export default function DriverAmbulance() {
  const [states, setStates] = useState([]);
  const [records, setRecords] = useState([]);
  const [availableType, setAvailableType] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    client
      .get('/ambulance/availability')
      .then(({ data }) => {
        setStates(data.states || []);
        setAvailableType(data.enabled);
      })
      .catch(() => {});
    client
      .get('/ambulance/compliance')
      .then(({ data }) => setRecords(data.records || []))
      .catch((e) => setErr(e.response?.data?.message || 'Failed to load compliance records'));
  };

  useEffect(load, []);

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setDoc = (key, k) => (e) =>
    setForm((f) => ({ ...f, docs: { ...f.docs, [key]: { ...f.docs[key], [k]: e.target.value } } }));

  const startEdit = (rec) => {
    setEditingId(rec.id);
    setForm({
      stateCode: rec.stateCode,
      ambulanceType: rec.ambulanceType,
      vehicleNumber: rec.vehicleNumber,
      docs: Object.fromEntries(
        DOC_FIELDS.map((d) => [d.key, { number: rec[d.key]?.number || '', validUpto: (rec[d.key]?.validUpto || '').slice(0, 10) }])
      ),
      equipmentList: rec.equipmentList || '',
    });
    setMsg('');
    setErr('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
    setErr('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const payload = { ...form, docs: form.docs };
      if (editingId) {
        const { data } = await client.put(`/ambulance/compliance/${editingId}`, payload);
        setMsg(data.message || 'Compliance record updated');
      } else {
        const { data } = await client.post('/ambulance/compliance', payload);
        setMsg('Ambulance registered — pending admin review');
      }
      setEditingId(null);
      setForm(emptyForm());
      client
        .get('/ambulance/compliance')
        .then(({ data }) => setRecords(data.records || []))
        .catch(() => {});
    } catch (ex) {
      setErr(ex.response?.data?.message || 'Submission failed');
    } finally {
      setBusy(false);
    }
  };

  const removeRec = async (id) => {
    if (!window.confirm('Remove this ambulance registration?')) return;
    setBusy(true);
    setErr('');
    try {
      await client.delete(`/ambulance/compliance/${id}`);
      setRecords((r) => r.filter((x) => x.id !== id));
      setMsg('Compliance record removed');
    } catch (ex) {
      setErr(ex.response?.data?.message || 'Failed to remove record');
    } finally {
      setBusy(false);
    }
  };

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

  return (
    <div className="container" style={{ maxWidth: 860 }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>🚑 Ambulance Compliance</h2>
        <p className="small muted" style={{ marginTop: 4 }}>
          Under the <b>aggregator model</b>, each ambulance needs a state-level compliance record (permit, fitness, insurance, PUC,
          EMT certification) covering your service area. You are dispatched only to ambulance trips in states where your record is{' '}
          <b>active</b> and every document is current.
        </p>
        {!availableType && (
          <div className="alert alert-warn" style={{ marginTop: 8 }}>
            Ambulance service is currently paused platform-wide.
          </div>
        )}
        {msg && <div className="alert alert-success" style={{ marginTop: 8 }}>{msg}</div>}
        {err && <div className="err-box" style={{ marginTop: 8 }}>{err}</div>}
      </div>

      {records.length > 0 && (
        <div className="card">
          <h3 style={{ margin: 0 }}>Your registrations ({records.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {records.map((r) => (
              <div key={r.id} className="card" style={{ padding: 12, boxShadow: 'none', border: '1px solid var(--line)' }}>
                <div className="spread">
                  <b>
                    🚑 {r.ambulanceType} · {r.stateCode}
                  </b>
                  <span className={`badge ${STATUS_CONFIG[r.status]?.cls || 'badge-gray'}`}>
                    {STATUS_CONFIG[r.status]?.label || r.status}
                  </span>
                </div>
                <div className="small mt" style={{ color: 'var(--text)' }}>
                  {r.vehicleNumber || '—'} · {fmtDate(r.createdAt)}
                </div>
                {r.expiryItems.length > 0 ? (
                  <div className="small muted mt">
                    {r.expiryItems.map((it) => (
                      <span key={it.key} style={{ display: 'inline-block', marginRight: 10 }}>
                        {it.label.replace(' Upto', '')}: <b style={{ color: 'var(--text)' }}>{fmtDate(it.validUpto)}</b>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="small muted mt">No document expiry dates submitted</div>
                )}
                {r.rejectionReason && (
                  <div className="small" style={{ marginTop: 6, color: 'var(--danger)' }}>
                    ⚠ Rejection: {r.rejectionReason}
                  </div>
                )}
                {r.notes && (
                  <div className="small muted" style={{ marginTop: 4 }}>
                    {r.notes}
                  </div>
                )}
                <div className="row mt" style={{ gap: 8 }}>
                  <button className="btn btn-ghost small" onClick={() => startEdit(r)}>
                    ✏️ Update / Renew
                  </button>
                  <button className="btn btn-ghost small" style={{ color: 'var(--danger)' }} onClick={() => removeRec(r.id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ margin: 0 }}>{editingId ? 'Update ambulance registration' : 'New ambulance registration'}</h3>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <div className="row" style={{ gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label className="small muted">State</label>
              <select className="input" value={form.stateCode} onChange={setField('stateCode')} required>
                <option value="">Select state…</option>
                {states.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="small muted">Service level</label>
              <select className="input" value={form.ambulanceType} onChange={setField('ambulanceType')}>
                <option value="BLS">BLS — Basic Life Support</option>
                <option value="ALS">ALS — Advanced Life Support</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="small muted">Vehicle number</label>
              <input className="input" value={form.vehicleNumber} onChange={setField('vehicleNumber')} placeholder="e.g. SK-01-A-1234" required />
            </div>
          </div>

          <div className="card" style={{ padding: 10, boxShadow: 'none', border: '1px solid var(--line)' }}>
            <div className="small muted" style={{ marginBottom: 8, fontWeight: 600 }}>
              Compliance documents (all required for active status)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
              {DOC_FIELDS.map((d) => (
                <div key={d.key} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
                  <label className="small muted" style={{ fontWeight: 600 }}>
                    {d.label}
                  </label>
                  <input
                    className="input"
                    style={{ marginTop: 4 }}
                    value={form.docs[d.key].number}
                    onChange={setDoc(d.key, 'number')}
                    placeholder="Document number"
                  />
                  <label className="small muted" style={{ display: 'block', marginTop: 6 }}>
                    Valid upto
                  </label>
                  <input type="date" className="input" value={form.docs[d.key].validUpto} onChange={setDoc(d.key, 'validUpto')} />
                </div>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="small muted">Equipment carried (stretcher, oxygen, defibrillator, etc.)</label>
            <input className="input" value={form.equipmentList} onChange={setField('equipmentList')} placeholder="e.g. stretcher, oxygen cylinder, AED, first-aid kit" />
          </div>

          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Submit for review'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
                Cancel
              </button>
            )}
            <Link to="/driver" className="btn btn-ghost" style={{ marginLeft: 'auto' }}>
              ← Back to console
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}