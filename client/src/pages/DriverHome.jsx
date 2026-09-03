import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import Nav from '../components/Nav.jsx';
import WarningBanner from '../components/WarningBanner.jsx';
import Modal from '../components/Modal.jsx';
import RideTracker from '../components/RideTracker.jsx';
import SafetyTips from '../components/SafetyTips.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { moveToward, jitter, formatINR, DESTINATIONS } from '../utils/geo.js';

const ACTIVE_STATUSES = ['assigned', 'driver_arrived', 'in_progress'];
const SIM_INTERVAL = 2500;

export default function DriverHome() {
  const { user, refreshUser } = useAuth();
  const { socket } = useSocket();

  const [isOnline, setIsOnline] = useState(user?.isOnline || false);
  const [ride, setRide] = useState(null);
  const [request, setRequest] = useState(null); // incoming ride request
  const [timeLeft, setTimeLeft] = useState(0);
  const [summary, setSummary] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const baseLoc = useRef(user?.location?.lat != null ? user.location : DESTINATIONS[0]);
  const pendingRef = useRef(null);

  const loadActive = useCallback(async () => {
    try {
      const { data } = await client.get('/rides/mine');
      const active = data.rides.find((r) => ACTIVE_STATUSES.includes(r.status));
      if (active) setRide(active);
    } catch {
      /* ignore */
    }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const { data } = await client.get('/driver/summary');
      setSummary(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadActive();
    loadSummary();
  }, [loadActive, loadSummary]);

  useEffect(() => {
    if (!socket) return;

    const onRequest = (r) => {
      setRequest(r);
      setTimeLeft(Math.round(r.timeLeftMs / 1000));
    };
    const onUpdate = (r) => {
      if (String(r.driver?._id) !== String(user?.id)) return;
      if (['requested', 'cancelled_by_rider', 'cancelled_by_driver', 'no_driver'].includes(r.status)) {
        setRide(null);
        setRequest(null);
        return;
      }
      setRide(r);
      if (r.status === 'completed') {
        setRide(r);
        loadSummary();
      }
    };

    socket.on('ride:request', onRequest);
    socket.on('ride:updated', onUpdate);
    return () => {
      socket.off('ride:request', onRequest);
      socket.off('ride:updated', onUpdate);
    };
  }, [socket, user?.id, loadSummary]);

  // Countdown for the incoming request
  useEffect(() => {
    if (!request) return;
    if (timeLeft <= 0) {
      setRequest(null);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [request, timeLeft]);

  // Simulated GPS loop
  useEffect(() => {
    if (!isOnline) return;
    const tick = () => {
      let next;
      if (ride && ride.status === 'in_progress') {
        next = moveToward(driverPos || baseLoc.current, ride.drop, 0.08);
      } else if (ride && (ride.status === 'assigned' || ride.status === 'driver_arrived')) {
        next = moveToward(driverPos || baseLoc.current, ride.pickup, 0.06);
      } else {
        next = jitter(baseLoc.current, 0.004);
      }
      baseLoc.current = next;
      setDriverPos(next);
      socket?.emit('driver:location', next);
    };
    const id = setInterval(tick, SIM_INTERVAL);
    return () => clearInterval(id);
  }, [isOnline, ride?.status, socket]);

  const toggleOnline = async () => {
    const next = !isOnline;
    setBusy(true);
    setErr('');
    try {
      const { data } = await client.post('/driver/online', { online: next });
      setIsOnline(next);
      await refreshUser();
      if (!next) {
        setRide(null);
        setRequest(null);
      }
      if (next) loadSummary();
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not update status');
    } finally {
      setBusy(false);
    }
  };

  const respond = async (accept) => {
    if (!request) return;
    setBusy(true);
    setErr('');
    try {
      if (accept) {
        const { data } = await client.post(`/driver/accept/${request._id}`);
        setRide(data.ride);
      } else {
        await client.post(`/driver/reject/${request._id}`);
      }
      setRequest(null);
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not respond');
    } finally {
      setBusy(false);
    }
  };

  const notApproved = user?.driverStatus !== 'approved';
  const inRide = ride && ACTIVE_STATUSES.includes(ride.status);

  return (
    <>
      <Nav />
      <div className="page">
        <WarningBanner />
        {err && <div className="alert alert-warn mb">{err}</div>}

        {notApproved ? (
          <div className="card">
            <h2>⏳ Account pending approval</h2>
            <p>
              Your driver account is <b>{user.driverStatus}</b>. An admin must approve it before you
              can go online. Please upload your documents for review.
            </p>
            <Link to="/driver/documents" className="btn btn-primary" style={{ display: 'inline-block', marginTop: 8 }}>
              📄 Upload Documents
            </Link>
          </div>
        ) : (
          <>
            <div className="card spread mb">
              <div>
                <h2 style={{ margin: 0 }}>🛺 Driver console</h2>
                <div className="small muted">
                  {inRide ? 'You are on an active ride.' : isOnline ? 'You are online — receiving ride requests.' : 'Go online to receive ride requests.'}
                </div>
              </div>
              <div className="row">
                <span className={`badge ${isOnline ? 'badge-green' : 'badge-gray'}`}>
                  {isOnline ? '● Online' : '○ Offline'}
                </span>
                <label className="switch">
                  <input type="checkbox" checked={isOnline} onChange={toggleOnline} disabled={busy} />
                  <span className="slider" />
                </label>
              </div>
            </div>

            <div className="stats-grid mb">
              <div className="card stat">
                <div className="num" style={{ color: 'var(--brand-dark)' }}>
                  {formatINR(summary?.totals?.revenue || 0)}
                </div>
                <div className="lbl">Net earnings (after commission)</div>
              </div>
              <div className="card stat">
                <div className="num">{summary?.totals?.count || 0}</div>
                <div className="lbl">Trips completed</div>
              </div>
              <div className="card stat">
                <div className="num">⭐ {user?.rating?.toFixed?.(1) || '5.0'}</div>
                <div className="lbl">Driver rating</div>
              </div>
              <div className="card stat">
                <div className="num">{summary?.online ?? '—'}</div>
                <div className="lbl">Drivers online now</div>
              </div>
            </div>

            <Link to="/driver/documents" className="btn btn-ghost btn-block mb" style={{ textAlign: 'center' }}>
              📄 View / Upload Documents
            </Link>

            <Link to="/driver/vehicle" className="btn btn-ghost btn-block mb" style={{ textAlign: 'center' }}>
              🚗 Vehicle Details
            </Link>

            {ride ? (
              <>
                <div className="alert alert-info mb">
                  {ride.status === 'completed'
                    ? 'Ride completed. You can rate the rider below or wait for the next request.'
                    : 'Your current ride — keep this window open while driving.'}
                </div>
                <RideTracker
                  ride={ride}
                  role="driver"
                  driverPos={driverPos}
                  setRide={setRide}
                  socket={socket}
                />
              </>
            ) : (
              <div className="card">
                <div className="spread">
                  <div>
                    <h3 style={{ margin: 0 }}>No active ride</h3>
                    <p className="muted small" style={{ marginBottom: 0 }}>
                      {isOnline
                        ? 'Waiting for ride requests from riders…'
                        : 'Turn the switch on to start receiving ride requests.'}
                    </p>
                  </div>
                  {isOnline && (
                    <span className="badge badge-green pulse" style={{ fontSize: 13 }}>
                      Listening for requests…
                    </span>
                  )}
                </div>
                <p className="small muted mt">
                  📍 Demo GPS is simulated so you can try everything without moving. In production a
                  driver’s real location would stream from their phone.
                </p>
              </div>
            )}
            <SafetyTips role="driver" />
          </>
        )}
      </div>

      <Modal open={!!request} onClose={() => pendingRef.current || respond(false)}>
        {request && (
          <div className="fade-in">
            <div className="spread">
              <h3>🚕 New ride request</h3>
              <span className={`badge ${timeLeft <= 8 ? 'badge-red' : 'badge-amber'}`}>{timeLeft}s</span>
            </div>
            <div className="card" style={{ background: 'var(--bg)', boxShadow: 'none', margin: '12px 0' }}>
              <div className="spread">
                <span className="muted small">Pickup</span>
                <b>{request.pickup.name}</b>
              </div>
              <div className="spread">
                <span className="muted small">Drop</span>
                <b>{request.drop.name}</b>
              </div>
              <div className="spread">
                <span className="muted small">Distance</span>
                <b>{request.distanceKm} km · ~{request.durationMin} min</b>
              </div>
              {request.shared?.enabled && (
                <div className="spread">
                  <span className="muted small">{request.shared?.mode === 'reserved' || request.shared?.reserved ? 'Reserved vehicle' : 'Shared trip · seats'}</span>
                  <b>
                    {request.shared?.mode === 'reserved' || request.shared?.reserved ? (
                      <span className="badge badge-blue">🪑 {request.shared.seatCount} seats · whole vehicle</span>
                    ) : (
                      <span className="badge badge-green">🪑 {request.shared.seatsTaken} / {request.shared.seatCount} booked</span>
                    )}
                  </b>
                </div>
              )}
              <div className="small muted" style={{ fontStyle: 'italic' }}>
                * Time estimates are approximate and may vary depending on road, traffic, and vehicle conditions.
              </div>
              <div className="spread" style={{ fontSize: 20, fontWeight: 800 }}>
                <span>{request.shared?.enabled ? (request.shared?.mode === 'reserved' || request.shared?.reserved ? 'Rider pays (whole vehicle)' : 'Trip fare (whole vehicle)') : 'Rider pays'}</span>
                <span style={{ color: 'var(--brand-dark)' }}>{formatINR(request.shared?.enabled ? (request.fareBreakup?.total || request.fare) : request.fare)}</span>
              </div>
              {request.shared?.enabled && request.shared?.mode !== 'reserved' && !request.shared?.reserved && (
                <div className="spread">
                  <span className="muted">Booked so far</span>
                  <b>{formatINR(request.shared.seatsTaken * (request.shared.perSeatFare || 0))} · {formatINR(request.shared.perSeatFare || 0)}/seat</b>
                </div>
              )}
              <div className="spread">
                <span className="muted">You earn (after commission)</span>
                <b>{formatINR(request.fareBreakup?.driverEarnings)}</b>
              </div>
              <div className="small muted">
                Rider: {request.rider?.name} {request.rider?.phone ? `· ${request.rider.phone}` : ''}
              </div>
            </div>
            <div className="row">
              <button className="btn btn-ghost btn-block" onClick={() => respond(false)} disabled={busy}>
                Decline
              </button>
              <button className="btn btn-primary btn-block" onClick={() => respond(true)} disabled={busy}>
                Accept
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
