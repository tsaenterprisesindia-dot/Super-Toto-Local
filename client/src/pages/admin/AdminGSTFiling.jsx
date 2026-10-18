import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client.js';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function AdminGSTFiling() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [cfg, setCfg] = useState({});
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const [c, s] = await Promise.all([
        client.get('/admin/gst-config'),
        client.get(`/admin/gst/summary-json?month=${month}`),
      ]);
      setCfg(c.data.gstConfig || {});
      setSummary(s.data);
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not load GST data');
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const download = async (path, label) => {
    setBusy(path); setErr(''); setMsg('');
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
      setMsg(`${label} downloaded`);
    } catch {
      setErr(`${label} download failed`);
    } finally {
      setBusy('');
    }
  };

  const t = summary?.totals || {};
  const hasGstin = !!(cfg.gstin || '').trim();

  return (
    <div className="fade-in">
      <h2 style={{ marginTop: 0 }}>🧮 GST Filing</h2>
      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        Prepare and file your GST returns yourself. Download the GSTR-1 and GST summary for the
        month, then upload/pay on the GST portal.
      </p>

      {!hasGstin && (
        <div className="alert alert-warn mb">
          No GSTIN set yet. Add it in <Link to="/admin/compliance">Compliance</Link> so invoices and
          GSTR-1 carry your GST number.
        </div>
      )}
      {err && <div className="err-box mb">{err}</div>}
      {msg && <div className="alert alert-green mb">{msg}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="spread" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="small muted">Business (legal entity)</div>
            <b>{cfg.companyName || '—'}</b>
          </div>
          <div>
            <div className="small muted">GSTIN</div>
            <b>{cfg.gstin || 'Not set'}</b>
          </div>
          <div>
            <div className="small muted">Registered state</div>
            <b>{cfg.registeredStateCode || '—'}</b>
          </div>
          <div>
            <div className="small muted">SAC code</div>
            <b>{cfg.sacCodeDefault || '996412'}</b>
          </div>
          <div>
            <div className="small muted">GST rate</div>
            <b>{cfg.gstRatePct ?? 5}%</b>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ margin: 0 }}><b>Return period</b></label>
          <input type="month" className="input" style={{ maxWidth: 180 }} value={month} onChange={(e) => setMonth(e.target.value)} />
          <button className="btn btn-ghost btn-sm" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Period summary ({month})</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <div><div className="small muted">Taxable value</div><b>{inr(t.taxableValue)}</b></div>
          <div><div className="small muted">CGST</div><b>{inr(t.cgst)}</b></div>
          <div><div className="small muted">SGST</div><b>{inr(t.sgst)}</b></div>
          <div><div className="small muted">IGST</div><b>{inr(t.igst)}</b></div>
          <div><div className="small muted">Total GST</div><b>{inr(t.gstTotal)}</b></div>
          <div><div className="small muted">Invoices</div><b>{t.invoiceCount || 0}</b></div>
        </div>

        {(summary?.bySupply || []).length > 0 && (
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>Supply</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th style={{ textAlign: 'right' }}>Taxable</th>
                  <th style={{ textAlign: 'right' }}>CGST</th>
                  <th style={{ textAlign: 'right' }}>SGST</th>
                  <th style={{ textAlign: 'right' }}>IGST</th>
                  <th style={{ textAlign: 'right' }}>GST</th>
                  <th style={{ textAlign: 'right' }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {summary.bySupply.map((r) => (
                  <tr key={r.supplyType + r.gstRatePct}>
                    <td>{r.supplyType === 'inter' ? 'Inter-state' : 'Intra-state'}</td>
                    <td style={{ textAlign: 'right' }}>{r.gstRatePct}%</td>
                    <td style={{ textAlign: 'right' }}>{inr(r.taxableValue)}</td>
                    <td style={{ textAlign: 'right' }}>{inr(r.cgst)}</td>
                    <td style={{ textAlign: 'right' }}>{inr(r.sgst)}</td>
                    <td style={{ textAlign: 'right' }}>{inr(r.igst)}</td>
                    <td style={{ textAlign: 'right' }}>{inr(r.gstTotal)}</td>
                    <td style={{ textAlign: 'right' }}>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(summary?.bySupply || []).length === 0 && (
          <p className="muted small" style={{ marginBottom: 0 }}>No issued invoices in this period.</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Download for filing</h3>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={busy === 'gst/gstr1'} onClick={() => download('gst/gstr1', 'GSTR-1')}>
            {busy === 'gst/gstr1' ? 'Preparing…' : 'GSTR-1 (CSV)'}
          </button>
          <button className="btn btn-ghost" disabled={busy === 'gst/summary'} onClick={() => download('gst/summary', 'GST Summary')}>
            {busy === 'gst/summary' ? 'Preparing…' : 'GST Summary (CSV)'}
          </button>
          <button className="btn btn-ghost" disabled={busy === 'accounting/tally'} onClick={() => download('accounting/tally', 'Tally')}>
            {busy === 'accounting/tally' ? 'Preparing…' : 'Tally (CSV)'}
          </button>
        </div>
        <p className="small muted" style={{ marginBottom: 0, marginTop: 10 }}>
          The GSTR-1 CSV can be mapped into the GST Offline Tool (or your billing software) and
          uploaded on the portal. The GST Summary gives the totals for GSTR-3B.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>How to file yourself</h3>
        <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
          <li>Set your GSTIN in <Link to="/admin/compliance">Compliance</Link> (once).</li>
          <li>Each month, pick the return period and download <b>GSTR-1</b> for outward supplies.</li>
          <li>Import the CSV into the <b>GST Offline Tool</b> / billing software and upload the JSON on the portal, or enter invoices directly.</li>
          <li>Use the <b>GST Summary</b> totals to file <b>GSTR-3B</b> and pay the tax.</li>
          <li>Hand the <b>Tally CSV</b> to accounting if needed.</li>
        </ol>
        <a className="btn btn-ghost" href="https://www.gst.gov.in" target="_blank" rel="noopener noreferrer" style={{ marginTop: 24, display: 'inline-block', clear: 'both' }}>
          Open GST Portal ↗
        </a>
      </div>
    </div>
  );
}
