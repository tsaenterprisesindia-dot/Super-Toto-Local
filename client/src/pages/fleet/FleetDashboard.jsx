import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client.js';
import Nav from '../../components/Nav.jsx';

export default function FleetDashboard() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [me, setMe] = useState(null);

  const [earnings, setEarnings] = useState(null);
  const [readiness, setReadiness] = useState([]);

  const load = () => {
    client.get('/fleet/invite-code')
      .then(({ data }) => setCode(data.code || ''))
      .catch((e) => setErr(e.response?.data?.message || 'Could not load invite code'));
    client.get('/auth/me')
      .then(({ data }) => setMe(data.user))
      .catch(() => {});
    client.get('/fleet/earnings').then(({ data }) => setEarnings(data)).catch(() => {});
    client.get('/fleet/ambulance-readiness').then(({ data }) => setReadiness(data.states || [])).catch(() => {});
  };
  useEffect(load, []);

  const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  const regenerate = async () => {
    if (!window.confirm('Generate a new invite code? The current code will stop working, but drivers who already joined stay in your fleet.')) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const { data } = await client.post('/fleet/invite-code/regenerate');
      setCode(data.code || '');
      setMsg('New invite code generated');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to generate a new code');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setMsg('Invite code copied');
    } catch {
      setErr('Could not copy — please copy it manually.');
    }
  };

  return (
    <>
      <Nav />
      <div className="page">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Fleet Owner Dashboard</h2>
        <p className="muted">Manage vehicles and drivers under your fleet.</p>
          <div className="row" style={{ gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <Link to="/fleet/vehicles" className="btn btn-primary">Manage Vehicles</Link>
          <Link to="/fleet/drivers" className="btn btn-ghost">Manage Drivers</Link>
          <Link to="/fleet/drivers" className="btn btn-ghost">Ambulance Readiness</Link>
        </div>
      </div>

      <div className="card mt">
        <h3 style={{ marginTop: 0 }}>Fleet earnings</h3>
        <div className="stats-grid">
          <div className="card stat" style={{ background: 'var(--brand-light)', border: '2px solid var(--brand-dark)' }}>
            <div className="lbl">Payable to you (unpaid)</div>
            <div className="num" style={{ color: 'var(--brand-dark)', fontSize: 28, fontWeight: 900 }}>{inr(me?.payable)}</div>
          </div>
          <div className="card stat">
            <div className="num">{inr(me?.earnings)}</div>
            <div className="lbl">Lifetime earned</div>
          </div>
          <div className="card stat">
            <div className="num">{inr(me?.paidOut)}</div>
            <div className="lbl">Paid out</div>
          </div>
        </div>
        {earnings && (earnings.ambulanceTotal || earnings.taxiTotal) && (
          <div style={{ marginTop: 10 }}>
            <b className="small">Breakdown</b>
            <div className="stats-grid" style={{ marginTop: 8 }}>
              <div className="card stat"><div className="num">{earnings.ambulanceCount || 0}</div><div className="lbl">Ambulance trips</div></div>
              <div className="card stat"><div className="num">{inr(earnings.ambulanceTotal)}</div><div className="lbl">Ambulance earnings</div></div>
              <div className="card stat"><div className="num">{earnings.taxiCount || 0}</div><div className="lbl">Taxi trips</div></div>
              <div className="card stat"><div className="num">{inr(earnings.taxiTotal)}</div><div className="lbl">Taxi earnings</div></div>
            </div>
          </div>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>
          Earnings from rides run on your fleet's vehicles accrue to you. Admin settles payouts; settled payouts
          appear here automatically.
        </p>
        {(me?.payouts || []).length > 0 && (
          <div className="stack" style={{ marginTop: 10 }}>
            <b className="small">Recent payouts</b>
            {me.payouts.slice().reverse().slice(0, 5).map((p) => (
              <div key={p._id || p.at} className="small spread" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
                <span>{p.note || 'Payout'}</span>
                <b style={{ color: 'var(--brand-dark)' }}>{inr(p.amount)}</b>
              </div>
            ))}
          </div>
        )}
      </div>

      {readiness.length > 0 && (
        <div className="card mt">
          <h3 style={{ marginTop: 0 }}>Ambulance readiness (by state)</h3>
          <div className="stats-grid">
            {readiness.slice(0, 6).map((s) => (
              <div key={s.stateCode} className="card stat">
                <div className="num">{s.bls} BLS / {s.als} ALS</div>
                <div className="lbl">{s.stateName || s.stateCode}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mt">
        <h3 style={{ marginTop: 0 }}>Fleet invite code</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Share this code with your drivers. They enter it under <b>Profile → My fleet</b> to join your fleet.
          The code can be reused for as many drivers as you like.
        </p>
        {err && <div className="err-box">{err}</div>}
        {msg && <div className="alert alert-green">{msg}</div>}
        <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 22,
              letterSpacing: 3,
              fontWeight: 700,
              padding: '8px 14px',
              border: '1px dashed var(--border, var(--line))',
              borderRadius: 8,
            }}
          >
            {code || '—'}
          </span>
          <button type="button" className="btn btn-ghost" onClick={copy} disabled={!code}>Copy</button>
          <button type="button" className="btn btn-ghost" onClick={regenerate} disabled={busy}>
            {busy ? 'Generating…' : 'Regenerate'}
          </button>
        </div>
      </div>
      </div>
    </>
  );
}
