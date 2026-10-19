import { useEffect, useState } from 'react';
import client from '../../api/client.js';
import Modal from '../../components/Modal.jsx';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function AdminPayouts() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailErr, setDetailErr] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payErr, setPayErr] = useState('');
  const [payMsg, setPayMsg] = useState('');

  const load = () => {
    setBusy(true);
    client.get('/admin/payouts')
      .then(({ data }) => setData(data))
      .catch((e) => setErr(e.response?.data?.message || 'Failed to load payouts'))
      .finally(() => setBusy(false));
  };
  useEffect(load, []);

  const openDetail = (id) => {
    setDetail(null);
    setDetailBusy(true);
    setDetailErr('');
    setAmount('');
    setNote('');
    setPayErr('');
    setPayMsg('');
    client.get(`/admin/payouts/${id}`)
      .then(({ data }) => setDetail(data))
      .catch((e) => setDetailErr(e.response?.data?.message || 'Failed to load payout detail'))
      .finally(() => setDetailBusy(false));
  };

  const doPay = async () => {
    if (!detail) return;
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) { setPayErr('Enter a valid amount'); return; }
    if (a > (detail.payable || 0) + 0.005) { setPayErr(`Amount exceeds payable ${fmt(detail.payable)}`); return; }
    setPayBusy(true);
    setPayErr('');
    setPayMsg('');
    try {
      await client.post(`/admin/payouts/${detail.account.id}`, { amount: a, note: note.trim() });
      setPayMsg('Payout recorded');
      setAmount('');
      setNote('');
      await Promise.all([load(), openDetail(detail.account.id)]);
    } catch (e) {
      setPayErr(e.response?.data?.message || 'Failed to record payout');
    } finally {
      setPayBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="flex" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>💰 Payouts (Drivers & Fleet Owners)</h2>
        <button className="btn btn-ghost" onClick={load} disabled={busy}>↻ Refresh</button>
      </div>
      {err && <div className="card" style={{ color: '#c0392b', border: '1px solid #c0392b' }}>{err}</div>}

      <div className="stats-grid">
        <div className="card stat" style={{ background: 'var(--brand-light)', border: '2px solid var(--brand-dark)' }}>
          <div className="lbl">Total payable (all accounts)</div>
          <div className="num" style={{ color: 'var(--brand-dark)', fontSize: 28, fontWeight: 900 }}>{fmt(data?.totals?.totalPayable)}</div>
        </div>
        <div className="card stat">
          <div className="num">{data?.totals?.count || 0}</div>
          <div className="lbl">Accounts with payable</div>
        </div>
        <div className="card stat">
          <div className="num">{fmt(data?.totals?.totalEarned)}</div>
          <div className="lbl">Lifetime earnings</div>
        </div>
        <div className="card stat">
          <div className="num" style={{ color: 'var(--brand-dark)' }}>{fmt(data?.totals?.totalPaid)}</div>
          <div className="lbl">Lifetime paid out</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Payees (earnings - payouts = payable)</h3>
        {data?.payees?.length === 0 && <p className="small muted">Nothing payable right now.</p>}
        <div className="stack">
          {data?.payees?.map((p) => (
            <button
              key={p.id}
              onClick={() => openDetail(p.id)}
              className="btn btn-ghost"
              style={{ display: 'block', width: '100%', textAlign: 'left', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--bg)' }}
            >
              <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div className="small" style={{ fontWeight: 800 }}>{p.name || 'Name'} · <span className="muted">{p.role} · {p.phone}</span></div>
                  <div className="small muted">{p.vehicleNumber || '—'} · Last payout: {p.lastPayoutAt ? new Date(p.lastPayoutAt).toLocaleDateString() : '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="small muted">Payable</div>
                  <b style={{ fontSize: 20, fontWeight: 900, color: 'var(--brand-dark)' }}>{fmt(p.payable)}</b>
                  <div className="small muted">Earned {fmt(p.earnings)} · Paid {fmt(p.paidOut)}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Modal open={!!detail || detailBusy} onClose={() => { setDetail(null); setPayErr(''); setPayMsg(''); }}>
        {detailErr && <div className="small" style={{ color: '#c0392b', fontWeight: 700, margin: '10px 0' }}>{detailErr}</div>}
        {detail && (
          <div className="stack">
            <div className="spread">
              <h2 style={{ margin: 0, fontSize: 20 }}>💸 {detail.account.name} — {detail.account.role === 'fleet_owner' ? 'Fleet Owner' : 'Driver'}</h2>
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>✕ Close</button>
            </div>
            <p className="small muted">{detail.account.phone} · {detail.account.vehicleNumber || '—'}</p>
            <div className="spread" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div><div className="small muted">Lifetime earnings</div><b>{fmt(detail.earnings)}</b></div>
              <div><div className="small muted">Paid out</div><b>{fmt(detail.paidOut)}</b></div>
              <div><div className="small muted">Payable</div><b style={{ fontSize: 20, color: 'var(--brand-dark)', fontWeight: 900 }}>{fmt(detail.payable)}</b></div>
              <div><div className="small muted">Last payout</div><b>{detail.lastPayoutAt ? new Date(detail.lastPayoutAt).toLocaleString() : '—'}</b></div>
            </div>

            <div className="card mt">
              <h3 style={{ marginTop: 0 }}>Record payout</h3>
              {payErr && <div className="small" style={{ color: '#c0392b' }}>{payErr}</div>}
              {payMsg && <div className="small" style={{ color: 'green' }}>{payMsg}</div>}
              <div className="stack" style={{ marginTop: 8 }}>
                <input type="number" step="0.01" className="form-input" placeholder={`Amount (max ${fmt(detail.payable)})`} value={amount} onChange={(e) => setAmount(e.target.value)} />
                <input type="text" className="form-input" placeholder="Note (e.g. UPI payout, reference no.)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={160} />
                <button className="btn btn-primary" onClick={doPay} disabled={payBusy}>
                  {payBusy ? 'Recording…' : 'Record payout'}
                </button>
              </div>
            </div>

            <h3 style={{ margin: '14px 0 8px', fontSize: 16 }}>Payout history ({detail.history?.length || 0})</h3>
            <div className="stack">
              {(!detail.history || detail.history.length === 0) && <p className="small muted">No payouts yet.</p>}
              {detail.history.map((h) => (
                <div key={h.id} className="small spread" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                  <span><span style={{ fontWeight: 700 }}>−{fmt(h.amount)}</span><br/><span className="muted">{h.note || '—'}</span></span>
                  <span className="muted">{new Date(h.at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {detailBusy && !detail && <p className="small muted">Loading detail…</p>}
      </Modal>
    </div>
  );
}
