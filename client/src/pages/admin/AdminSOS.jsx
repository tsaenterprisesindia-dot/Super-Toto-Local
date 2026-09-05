import { useEffect, useState } from 'react';
import client from '../../api/client.js';
import { useSocket } from '../../context/SocketContext.jsx';

const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtCoords = (c) => (c && c.lat != null ? `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}` : '—');

export default function AdminSOS() {
  const { socket } = useSocket();
  const [data, setData] = useState({ active: [], recent: [] });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState({});

  const load = () =>
    client
      .get('/admin/sos')
      .then(({ data }) => setData(data))
      .catch(() => {});

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onAny = () => load();
    socket.on('sos:new', onAny);
    socket.on('sos:solved', onAny);
    return () => {
      socket.off('sos:new', onAny);
      socket.off('sos:solved', onAny);
    };
  }, [socket]);

  const resolve = async (id) => {
    setBusy(true);
    setErr('');
    try {
      await client.post(`/admin/sos/${id}/resolve`, { note: notes[id] || '' });
      await load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not resolve alert');
    } finally {
      setBusy(false);
    }
  };

  const trackUrl = (e) => (e.ride?.shareToken ? `${window.location.origin}/track/${e.ride.shareToken}` : null);

  return (
    <div className="fade-in">
      <h2>🆘 SOS Monitoring</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Rider-emergency alerts arrive live here with the rider's and driver's coordinates.
      </p>

      {err && <div className="err-box mb">{err}</div>}

      <div className="card" style={{ borderLeft: '4px solid var(--danger)', marginBottom: 18 }}>
        <div className="spread">
          <div>
            <div className="small muted">ACTIVE ALERTS</div>
            <b style={{ fontSize: 22 }}>{data.active.length}</b>
          </div>
          <div style={{ fontSize: 30 }}>🚨</div>
        </div>
      </div>

      {data.active.length === 0 && (
        <div className="alert alert-green mb">No active SOS alerts. Monitoring is clear.</div>
      )}

      {data.active.map((e) => (
        <div key={e._id} className="card mb" style={{ border: '1px solid var(--danger)', background: '#fff5f5' }}>
          <div className="spread">
            <b style={{ color: 'var(--danger)' }}>🚨 SOS · {e.ride?.status || 'ride'}</b>
            <span className="small muted">{fmtTime(e.incidentAt)}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', marginTop: 10, fontSize: 13 }}>
            <div>
              <div className="small muted">Rider</div>
              <b>{e.rider?.name || '—'}</b>
              {e.rider?.phone && <div className="small">{e.rider.phone}</div>}
            </div>
            <div>
              <div className="small muted">Driver</div>
              <b>{e.driver?.name || '—'}</b>
              {e.driver?.vehicleNumber && (
                <div className="small">{e.driver.vehicleType} · {e.driver.vehicleNumber}</div>
              )}
            </div>
            <div>
              <div className="small muted">Rider coords</div>
              <b className="small">{fmtCoords(e.riderCoords)}</b>
            </div>
            <div>
              <div className="small muted">Driver coords</div>
              <b className="small">{fmtCoords(e.driverCoords)}</b>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="small muted">Pickup → Drop</div>
              <b className="small">{e.ride?.pickup?.name || '—'} → {e.ride?.drop?.name || '—'}</b>
            </div>
            {e.message && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="small muted">Rider message</div>
                <div className="err-box" style={{ color: 'inherit' }}>{e.message}</div>
              </div>
            )}
          </div>

          <div className="row mt" style={{ gap: 8 }}>
            {trackUrl(e) && (
              <a
                className="btn"
                href={trackUrl(e)}
                target="_blank"
                rel="noreferrer"
                style={{ background: 'none', border: '1px solid var(--line)', color: 'var(--brand-dark)' }}
              >
                🗺️ Open track map
              </a>
            )}
            <input
              className="input"
              placeholder="Resolution note (optional)"
              value={notes[e._id] || ''}
              onChange={(ev) => setNotes((p) => ({ ...p, [e._id]: ev.target.value }))}
              style={{ flex: 1 }}
            />
            <button className="btn btn-danger" disabled={busy} onClick={() => resolve(e._id)}>
              Mark resolved
            </button>
          </div>
        </div>
      ))}

      {data.recent.length > 0 && (
        <>
          <h3 style={{ marginBottom: 8 }}>Resolved (last 48h)</h3>
          {data.recent.map((e) => (
            <div key={e._id} className="card mb" style={{ boxShadow: 'none', background: 'var(--bg)' }}>
              <div className="spread small">
                <b>{e.ride?.pickup?.name || '—'} → {e.ride?.drop?.name || '—'}</b>
                <span className="muted">{fmtTime(e.incidentAt)} {e.resolutionNote ? `· "${e.resolutionNote}"` : ''}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}