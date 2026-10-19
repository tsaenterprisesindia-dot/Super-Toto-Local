import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client.js';
import Nav from '../../components/Nav.jsx';

export default function FleetDashboard() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    client.get('/fleet/invite-code')
      .then(({ data }) => setCode(data.code || ''))
      .catch((e) => setErr(e.response?.data?.message || 'Could not load invite code'));
  };
  useEffect(load, []);

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
        </div>
      </div>

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
