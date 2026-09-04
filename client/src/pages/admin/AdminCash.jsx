import { useEffect, useState } from 'react';
import client from '../../api/client.js';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function AdminCash() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    setBusy(true);
    client.get('/admin/cash')
      .then(({ data }) => setData(data))
      .catch((e) => setErr(e.response?.data?.message || 'Failed to load cash settlement data'))
      .finally(() => setBusy(false));
  };
  useEffect(load, []);

  const s = data?.cashSettlement || { overdueLimit: 500, deadlineHours: 48 };
  const t = data?.totals || { outstanding: 0, totalCashCollected: 0, totalCashSettled: 0 };
  const outstandingDrivers = data?.drivers || [];

  return (
    <div className="stack">
      <div className="flex" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>💵 Cash Settlement</h2>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost" onClick={load} disabled={busy}>↻ Refresh</button>
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 0 }}>
        When riders pay in cash, the driver collects the whole fare. The driver keeps their net share, and the
        platform's share (commission + GST under Sec 9(5) CGST Act) is shown below as <b>cash owed</b> until the
        driver deposits it via UPI or it is auto-deducted from their digital earnings.
      </p>
      {err && <div className="card" style={{ color: '#c0392b', border: '1px solid #c0392b' }}>{err}</div>}

      <div className="stats-grid">
        <div className="card stat" style={{ background: 'var(--brand-light)', border: '2px solid var(--brand-dark)' }}>
          <div className="lbl">Cash owed by drivers (outstanding)</div>
          <div className="num" style={{ color: '#c0392b', fontSize: 28, fontWeight: 900 }}>{fmt(t.outstanding)}</div>
        </div>
        <div className="card stat">
          <div className="num">{outstandingDrivers.length}</div>
          <div className="lbl">Drivers owing cash</div>
        </div>
        <div className="card stat">
          <div className="num">{fmt(t.totalCashCollected)}</div>
          <div className="lbl">Total cash collected (platform share)</div>
        </div>
        <div className="card stat">
          <div className="num" style={{ color: 'var(--brand-dark)' }}>{fmt(t.totalCashSettled)}</div>
          <div className="lbl">Total returned to platform</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Settlement policy</h3>
        <p className="small muted" style={{ marginTop: 0 }}>
          A driver is marked <b>overdue</b> and blocked from going online / accepting rides when their outstanding
          balance exceeds <b>{fmt(s.overdueLimit)}</b> and has been held for more than <b>{s.deadlineHours} hours</b>.
        </p>
        <div className="spread" style={{ gap: 16, flexWrap: 'wrap' }}>
          <label className="small">
            Free-carry limit (₹) — below this, balance is never overdue
            <input
              className="form-input"
              type="number"
              defaultValue={s.overdueLimit}
              onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0) setData((d) => ({ ...d, cashSettlement: { ...d.cashSettlement, overdueLimit: v } })); }}
            />
          </label>
          <label className="small">
            Deadline (hours) — time allowed to return the platform's cash share
            <input
              className="form-input"
              type="number"
              defaultValue={s.deadlineHours}
              onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0) setData((d) => ({ ...d, cashSettlement: { ...d.cashSettlement, deadlineHours: v } })); }}
            />
          </label>
          <button
            className="btn btn-primary"
            onClick={async () => {
              setBusy(true); setErr('');
              try {
                await client.put('/admin/compliance', { cashSettlement: { overdueLimit: Number(data.cashSettlement.overdueLimit), deadlineHours: Number(data.cashSettlement.deadlineHours) } });
                load();
              } catch (e) {
                setErr(e.response?.data?.message || 'Failed to save policy');
                setBusy(false);
              }
            }}
            disabled={busy}
          >
            Save policy
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Drivers owing cash</h3>
        {outstandingDrivers.length === 0 && (
          <p className="small muted" style={{ marginTop: 0 }}>No outstanding cash settlements. All drivers are settled. 🎉</p>
        )}
        <div className="stack">
          {outstandingDrivers.map((d) => (
            <div key={d.driver} className="spread" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', flexWrap: 'wrap', gap: 8, background: d.overdue ? '#fff5f5' : 'var(--bg)' }}>
              <div>
                <div className="small" style={{ fontWeight: 800 }}>{d.name || 'Driver'} <span className="muted">{d.phone || ''}</span></div>
                <div className="small muted">{d.vehicleNumber || '—'} · owed since {d.cashPendingSince ? new Date(d.cashPendingSince).toLocaleDateString() : '—'}</div>
                {d.overdue && (
                  <div className="small" style={{ color: '#c0392b', fontWeight: 700 }}>
                    🚨 OVERDUE · held {d.overdueByHours} hrs (limit {fmt(d.limit)} / {s.deadlineHours}h) — blocked from online
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="small muted">Cash owed</div>
                <b style={{ fontSize: 20, fontWeight: 900, color: d.overdue ? '#c0392b' : 'var(--brand-dark)' }}>{fmt(d.cashDue)}</b>
                <div className="small muted">Returned so far: {fmt(d.cashDeposited)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}