import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiBase } from '../api/config.js';
import MapView from '../components/MapView.jsx';

const STATUS = {
  assigned: { label: 'Driver confirmed', badge: 'badge-blue' },
  driver_arrived: { label: 'Driver at pickup', badge: 'badge-amber' },
  in_progress: { label: 'Trip in progress', badge: 'badge-green' },
};

export default function TrackRide() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${apiBase()}/api/track/${encodeURIComponent(token)}`);
        const j = await res.json();
        if (!alive) return;
        if (res.ok) setData(j);
        else setErr(j.message || 'Tracking link not found');
      } catch {
        if (alive) setErr('Could not load this tracking link');
      }
    };
    load();
    const iv = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [token]);

  if (err) {
    return (
      <div style={{ maxWidth: 520, margin: '12vh auto', padding: '0 16px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <div style={{ fontSize: 42 }}>🧭</div>
          <h3 style={{ margin: '10px 0 6px' }}>{err}</h3>
          <p className="small muted" style={{ marginBottom: 0 }}>
            This track-my-ride link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="page-loader">Loading live trip…</div>;
  }

  if (data.sharing === false) {
    return (
      <div style={{ maxWidth: 520, margin: '12vh auto', padding: '0 16px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <div style={{ fontSize: 42 }}>🛺</div>
          <h3 style={{ margin: '10px 0 6px' }}>Live sharing is off</h3>
          <p className="small muted" style={{ marginBottom: 0 }}>
            This trip is finished or the rider stopped sharing it.
          </p>
        </div>
      </div>
    );
  }

  const st = STATUS[data.status] || { label: data.status, badge: 'badge-blue' };
  const d = data.driver || {};
  const vd = d.vehicleDetails || {};
  const started = data.startedAt ? new Date(data.startedAt) : null;
  const elapsedMin = started ? Math.max(0, Math.round((Date.now() - started.getTime()) / 60000)) : 0;
  const bounds = [
    [data.pickup.lat, data.pickup.lng],
    [data.drop.lat, data.drop.lng],
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ background: 'var(--brand-dark)', color: '#fff', padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 880, margin: '0 auto' }}>
          <div>
            <b>🛺 Super Toto Local</b>
            <div className="small" style={{ opacity: 0.8 }}>Live trip tracking</div>
          </div>
          <span className={`badge ${st.badge}`} style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>
            {st.label}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: '18px auto 40px', padding: '0 16px' }}>
        <div className="grid-2">
          <div className="map-col">
            <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <MapView pickup={data.pickup} drop={data.drop} driverPos={data.driverPos} bounds={bounds} />
            </div>
          </div>
          <div className="stack">
            <div className="card">
              <div className="spread">
                <span className="small muted">{data.pickup.name || 'Pickup'}</span>
                <span className="small muted">{data.drop.name || 'Drop'}</span>
              </div>
              <hr style={{ border: 'none', borderTop: '1px dashed var(--line)', margin: '12px 0' }} />
              <div className="spread">
                <span className="muted">Distance</span>
                <b>{data.distanceKm} km</b>
              </div>
              <div className="spread">
                <span className="muted">Remaining ETA</span>
                <b>{data.etaMinutes != null ? `~${data.etaMinutes} min` : '—'}</b>
              </div>
              <div className="spread">
                <span className="muted">Time in trip</span>
                <b>{elapsedMin} min</b>
              </div>
              <div className="spread">
                <span className="muted">Driver live position</span>
                <b className="small">
                  {data.driverPos ? `${data.driverPos.lat.toFixed(5)}, ${data.driverPos.lng.toFixed(5)}` : '—'}
                </b>
              </div>
            </div>

            <div className="card">
              <div className="row">
                <span className="avatar" style={{ background: '#1d4ed8' }}>
                  {(d.name || 'D')[0].toUpperCase()}
                </span>
                <div>
                  <b>{d.name || 'Driver'}</b>
                  <div className="small muted">
                    {d.vehicleType || 'toto'} · {d.vehicleNumber || '—'} · ⭐ {d.rating ? d.rating.toFixed(1) : '—'}
                  </div>
                </div>
              </div>
              {(vd.brand || vd.model || vd.color) && (
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
                  {vd.brand && <><span className="muted">Brand</span><b>{vd.brand}</b></>}
                  {vd.model && <><span className="muted">Model</span><b>{vd.model}</b></>}
                  {vd.color && <><span className="muted">Color</span><b>{vd.color}</b></>}
                </div>
              )}
            </div>

            <div className="alert alert-info" style={{ marginBottom: 0 }}>
              📍 Location refreshes every few seconds. Share this page with your family and friends to keep them informed.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}