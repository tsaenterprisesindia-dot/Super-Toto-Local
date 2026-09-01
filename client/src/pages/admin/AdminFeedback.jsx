import { useEffect, useState } from 'react';
import client from '../../api/client.js';

const STATUSES = ['open', 'under-review', 'resolved', 'closed'];
const CAT_ICONS = {
  ride: '🚕',
  driver: '🛺',
  fare: '💰',
  payment: '💳',
  app: '📱',
  safety: '🛡️',
  vehicle: '🚗',
  other: '📝',
};

export default function AdminFeedback() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState({ type: '', status: '', q: '' });
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    const p = new URLSearchParams();
    if (filter.type) p.set('type', filter.type);
    if (filter.status) p.set('status', filter.status);
    if (filter.q.trim()) p.set('q', filter.q.trim());
    client.get(`/feedback?${p.toString()}`)
      .then(({ data }) => setItems(data.feedback || []))
      .catch(() => {});
  };

  useEffect(load, [filter]);

  useEffect(() => {
    if (selected) {
      setStatus(selected.status);
      setNote(selected.adminNote || '');
      setMsg('');
    }
  }, [selected]);

  const openDetail = (f) => setSelected(f);

  const saveStatus = async () => {
    setSaving(true);
    setMsg('');
    try {
      const { data } = await client.post(`/feedback/${selected._id}/status`, { status, adminNote: note });
      setSelected(data.feedback);
      setMsg('Saved ✓');
      load();
    } catch (e) {
      setMsg(e.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const fmt = (iso) =>
    new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const openCount = items.filter((i) => i.status === 'open').length;

  return (
    <div className="fade-in">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>💬 Complaint &amp; Suggestion</h2>
        <span className="muted small">
          {items.length} shown{openCount > 0 ? ` · ${openCount} open` : ''}
        </span>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select className="input" style={{ width: 150 }} value={filter.type} onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}>
          <option value="">All types</option>
          <option value="complaint">⚠️ Complaints</option>
          <option value="suggestion">💡 Suggestions</option>
        </select>
        <select className="input" style={{ width: 160 }} value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          className="input"
          style={{ width: 220 }}
          placeholder="Search name, phone, subject, message…"
          value={filter.q}
          onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
        />
      </div>

      {selected ? (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <b>{selected.type === 'complaint' ? '⚠️ Complaint' : '💡 Suggestion'} · {selected.subject || '(no subject)'}</b>
            <button className="btn btn-ghost" onClick={() => setSelected(null)}>← Back to list</button>
          </div>
          <div className="spread small muted" style={{ marginBottom: 8 }}>
            <span>{selected.name} · {selected.phone || '—'} · {selected.role} · {fmt(selected.createdAt)}</span>
          </div>
          <div className="small" style={{ marginBottom: 12 }}>
            <span className={`badge ${selected.type === 'complaint' ? 'badge-red' : 'badge-blue'}`}>{selected.type}</span>{' '}
            <span className="badge badge-gray">{CAT_ICONS[selected.category] || ''} {selected.category}</span>{' '}
            {selected.priority === 'high' && <span className="badge badge-red">🔴 high priority</span>}
          </div>
          <div className="alert" style={{ whiteSpace: 'pre-wrap' }}>{selected.message}</div>

          <div className="field mt">
            <label>Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Response / admin note</label>
            <textarea
              className="input"
              rows={3}
              value={note}
              maxLength={1000}
              placeholder="Visible to the user in their report list…"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {msg && <div className={msg === 'Saved ✓' ? 'alert alert-green' : 'err-box'}>{msg}</div>}
          <button className="btn btn-primary btn-block" onClick={saveStatus} disabled={saving}>
            {saving ? 'Saving…' : 'Save status & response'}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="card muted" style={{ textAlign: 'center', padding: 28 }}>
          No complaints or suggestions match these filters.
        </div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Type</th>
                <th>Category</th>
                <th>Subject / Message</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f._id} style={{ cursor: 'pointer' }} onClick={() => openDetail(f)}>
                  <td className="small">{fmt(f.createdAt)}</td>
                  <td className="small">{f.name || '—'}<div className="muted">{f.phone || ''} {f.role}</div></td>
                  <td>{f.type === 'complaint' ? '⚠️' : '💡'}</td>
                  <td className="small">{CAT_ICONS[f.category] || ''} {f.category}</td>
                  <td className="small">
                    <b>{f.subject || ''}</b>
                    <div style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.message}
                    </div>
                  </td>
                  <td>
                    {f.priority === 'high' ? <span className="badge badge-red">high</span> : f.priority}
                  </td>
                  <td>
                    <span className={`badge ${
                      f.status === 'open' ? 'badge-amber'
                        : f.status === 'under-review' ? 'badge-blue'
                        : f.status === 'resolved' ? 'badge-green' : 'badge-gray'
                    }`}>{f.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}