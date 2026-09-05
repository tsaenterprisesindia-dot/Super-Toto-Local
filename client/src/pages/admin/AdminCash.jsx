import { useEffect, useState } from 'react';
import client from '../../api/client.js';
import Modal from '../../components/Modal.jsx';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const TYPE_LABEL = { cash_collected: '💰 Cash collected', deposit: '📲 UPI deposit', auto_deduct: '🔁 Auto-deducted' };

export default function AdminCash() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null); // { status, entries }
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailErr, setDetailErr] = useState('');

  const load = () => {
    setBusy(true);
    client.get('/admin/cash')
      .then(({ data }) => setData(data))
      .catch((e) => setErr(e.response?.data?.message || 'Failed to load cash settlement data'))
      .finally(() => setBusy(false));
  };
  useEffect(load, []);

  const openDetail = (driverId) => {
    setDetail(null);
    setDetailBusy(true);
    setDetailErr('');
    client.get(`/admin/cash/${driverId}`)
      .then(({ data }) => setDetail(data))
      .catch((e) => setDetailErr(e.response?.data?.message || 'Failed to load driver ledger'))
      .finally(() => setDetailBusy(false));
  };

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
            <button
              key={d.driver}
              onClick={() => openDetail(d.driver)}
              className="btn btn-ghost"
              style={{ display: 'block', width: '100%', textAlign: 'left', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: d.overdue ? '#fff5f5' : 'var(--bg)', margin: 0 }}
            >
              <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div className="small" style={{ fontWeight: 800 }}>{d.name || 'Driver'} <span className="muted">{d.phone || ''}</span></div>
                  <div className="small muted">{d.vehicleNumber || '—'} · owed since {d.cashPendingSince ? new Date(d.cashPendingSince).toLocaleDateString() : '—'}</div>
                  <div className="small muted">Settlement window: {d.deadlineHours || 48}h used {d.deadlineProgressPct || 0}% · {d.hoursLeft ?? 0}h left</div>
                  {d.reminderSent && <div className="small" style={{ color: '#334155', fontStyle: 'italic' }}>📩 SMS reminder sent {d.reminderSentAt ? new Date(d.reminderSentAt).toLocaleString() : ''}</div>}
                  {d.overdue && (
                    <div className="small" style={{ color: '#c0392b', fontWeight: 700 }}>
                      🚨 OVERDUE · held {d.overdueByHours} hrs (limit {fmt(d.limit)} / {d.deadlineHours || 48}h) — blocked from online
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="small muted">Cash owed</div>
                  <b style={{ fontSize: 20, fontWeight: 900, color: d.overdue ? '#c0392b' : 'var(--brand-dark)' }}>{fmt(d.cashDue)}</b>
                  <div className="small muted">Returned so far: {fmt(d.cashDeposited)}</div>
                  <div className="small" style={{ color: 'var(--brand-dark)', fontWeight: 700 }}>View ledger →</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Modal open={!!detail || detailBusy} onClose={() => { setDetail(null); setDetailErr(''); }}>
        {detailErr && <div className="small" style={{ color: '#c0392b', fontWeight: 700, margin: '10px 0' }}>{detailErr}</div>}
        {detail && (
          <div className="stack">
            <div className="spread" style={{ marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>💵 {detail.status.name || 'Driver'}'s cash ledger</h2>
              <button className="btn btn-ghost" onClick={() => { setDetail(null); setDetailErr(''); }}>✕ Close</button>
            </div>
            <p className="small muted" style={{ marginTop: 0 }}>
              {detail.status.phone || ''} · {detail.status.vehicleNumber || '—'}
            </p>
            <div className="spread" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div className="small muted">Cash owed now</div>
                <b style={{ fontSize: 24, fontWeight: 900, color: detail.status.overdue ? '#c0392b' : 'var(--brand-dark)' }}>{fmt(detail.status.cashDue)}</b>
              </div>
              <div>
                <div className="small muted">Returned so far</div>
                <b>{fmt(detail.status.cashDeposited)}</b>
              </div>
              <div>
                <div className="small muted">Window used</div>
                <b>{detail.status.deadlineProgressPct || 0}% ({detail.status.hoursLeft ?? 0}h left of {detail.status.deadlineHours || 48}h)</b>
              </div>
              <div>
                <div className="small muted">Status</div>
                <b style={{ color: detail.status.overdue ? '#c0392b' : (detail.status.pending ? '#8a6100' : 'var(--brand-dark)') }}>
                  {detail.status.overdue ? '🚨 Overdue' : detail.status.pending ? '⏳ Pending' : '✓ Settled'}
                </b>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <b className="small">Simulated SMS to driver</b>
              <div className="small muted" style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: '8px 10px', marginTop: 4, fontStyle: 'italic' }}>
                {detail.status.smsPreview || (
                  detail.status.reminderSent
                    ? `📩 Sent ${detail.status.reminderSentAt ? new Date(detail.status.reminderSentAt).toLocaleString() : ''}`
                    : 'Reminder will be sent automatically when the driver has used 50% of the settlement window.'
                )}
              </div>
            </div>
            <h3 style={{ margin: '14px 0 8px', fontSize: 16 }}>Ledger history ({detail.entries.length})</h3>
            <div className="stack">
              {detail.entries.length === 0 && <p className="small muted" style={{ marginTop: 0 }}>No cash ledger activity for this driver.</p>}
              {detail.entries.map((e) => (
                <div key={e.id} className="small spread" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                  <span style={{ display: 'block', maxWidth: '70%' }}>
                    {TYPE_LABEL[e.type] || e.type}
                    <span className="muted" style={{ display: 'block' }}>{e.note}</span>
                    <span className="muted">{new Date(e.createdAt).toLocaleString()}</span>
                  </span>
                  <b style={{ color: e.type === 'cash_collected' ? '#c0392b' : 'var(--brand-dark)' }}>
                    {e.type === 'cash_collected' ? '+' : '−'}{fmt(e.amount)}
                  </b>
                </div>
              ))}
            </div>
          </div>
        )}
        {detailBusy && !detail && <p className="small muted">Loading ledger…</p>}
      </Modal>
    </div>
  );
}