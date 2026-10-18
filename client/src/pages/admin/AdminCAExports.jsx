import { useState } from 'react';
import client from '../../api/client.js';

export default function AdminCAExports() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const dl = async (path, label) => {
    setBusy(path); setErr('');
    try {
      const res = await client.get(`/admin/export/${path}?month=${month}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${label.replace(/\s+/g, '_').toLowerCase()}_${month}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErr('Download failed — please try again.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="card">
      <h2>🧾 CA Exports</h2>
      <p className="muted">GST &amp; Tally CSV exports</p>
      <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      {err && <div className="err-box mt">{err}</div>}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn" disabled={!!busy} onClick={() => dl('gst/gstr1', 'GSTR-1')}>
          {busy === 'gst/gstr1' ? 'Preparing…' : 'Export GSTR-1 (CSV)'}
        </button>
        <button className="btn" disabled={!!busy} onClick={() => dl('gst/summary', 'GST Summary')}>
          {busy === 'gst/summary' ? 'Preparing…' : 'Export GST Summary (CSV)'}
        </button>
        <button className="btn" disabled={!!busy} onClick={() => dl('accounting/tally', 'Tally')}>
          {busy === 'accounting/tally' ? 'Preparing…' : 'Export Tally (CSV)'}
        </button>
      </div>
    </div>
  );
}
