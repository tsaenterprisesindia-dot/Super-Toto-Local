import { useCallback, useEffect, useState } from 'react';
import client from '../../api/client.js';

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const EMPTY = { code: '', type: 'pct', value: '', maxDiscount: '', minFare: '', description: '', active: true, usageLimit: '', perUserLimit: 1 };

export default function AdminPromos() {
  const [promos, setPromos] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    client.get('/admin/promos').then(({ data }) => setPromos(data.promos || [])).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await client.post('/admin/promos', form);
      setForm(EMPTY);
      setShowForm(false);
      await load();
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Could not create promo');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (p) => {
    try {
      await client.patch(`/admin/promos/${p._id}`, { active: !p.active });
      await load();
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Could not update promo');
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete promo ${p.code}?`)) return;
    try {
      await client.delete(`/admin/promos/${p._id}`);
      await load();
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Could not delete promo');
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <h2>Promo codes</h2>
      <p className="muted">Create discount codes riders can apply at booking. Discounts are capped and counted per user.</p>

      {err && <div className="alert alert-warn mb">{err}</div>}

      {!showForm ? (
        <button className="btn btn-primary mb" onClick={() => setShowForm(true)}>+ New promo</button>
      ) : (
        <form className="card mb" onSubmit={create}>
          <h3 style={{ marginTop: 0 }}>New promo</h3>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Code</label>
              <input className="input" value={form.code} onChange={set('code')} placeholder="FLAT50" required />
            </div>
            <div className="field" style={{ width: 110 }}>
              <label>Type</label>
              <select className="input" value={form.type} onChange={set('type')}>
                <option value="pct">% off</option>
                <option value="fixed">Flat ₹</option>
              </select>
            </div>
            <div className="field" style={{ width: 110 }}>
              <label>Value</label>
              <input className="input" type="number" min="0" step="any" value={form.value} onChange={set('value')} placeholder="10" required />
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Max discount (₹, optional)</label>
              <input className="input" type="number" min="0" value={form.maxDiscount} onChange={set('maxDiscount')} placeholder="30" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Min fare (₹)</label>
              <input className="input" type="number" min="0" value={form.minFare} onChange={set('minFare')} placeholder="0" />
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Total limit (optional)</label>
              <input className="input" type="number" min="1" value={form.usageLimit} onChange={set('usageLimit')} placeholder="unlimited" />
            </div>
            <div className="field" style={{ width: 120 }}>
              <label>Per user</label>
              <input className="input" type="number" min="1" value={form.perUserLimit} onChange={set('perUserLimit')} />
            </div>
            <div className="field" style={{ width: 120, alignSelf: 'flex-end' }}>
              <label className="row" style={{ gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
                Active
              </label>
            </div>
          </div>
          <div className="field">
            <label>Description</label>
            <input className="input" value={form.description} onChange={set('description')} placeholder="10% off your next trip (up to ₹30)" />
          </div>
          <div className="modal-actions" style={{ paddingLeft: 0 }}>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create promo'}</button>
          </div>
        </form>
      )}

      {promos.length === 0 ? (
        <div className="alert alert-info">No promos yet. Create one above to let riders save on trips.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {promos.map((p) => (
            <div key={p._id} className="card" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
              <div className="spread">
                <b>{p.code}</b>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className={`badge ${p.active ? 'badge-green' : 'badge-red'}`}>{p.active ? 'Active' : 'Paused'}</span>
                  <button className="btn btn-ghost small" onClick={() => toggle(p)}>{p.active ? 'Pause' : 'Activate'}</button>
                  <button className="btn btn-ghost small" onClick={() => remove(p)}>Delete</button>
                </div>
              </div>
              <div className="small muted mt">
                {p.type === 'pct' ? `${p.value}% off${p.maxDiscount ? ` · up to ₹${p.maxDiscount}` : ''}` : `Flat ₹${p.value} off`}
                {p.minFare > 0 ? ` · min fare ₹${p.minFare}` : ''}
                {p.description ? ` · ${p.description}` : ''}
              </div>
              <div className="small muted mt">
                Used {p.usedCount || 0}{p.usageLimit ? ` / ${p.usageLimit}` : ''} times
                {p.perUserLimit ? ` · up to ${p.perUserLimit}/user` : ''}
                <span> · created {fmtDate(p.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}