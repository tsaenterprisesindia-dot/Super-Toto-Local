import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import Nav from '../components/Nav.jsx';
import WarningBanner from '../components/WarningBanner.jsx';
import Modal from '../components/Modal.jsx';
import RideTracker from '../components/RideTracker.jsx';
import SafetyTips from '../components/SafetyTips.jsx';
import { QRCodeSVG } from 'qrcode.react';
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
  const [cash, setCash] = useState(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmt, setDepositAmt] = useState('');
  const [depositRef, setDepositRef] = useState('');
  const [depBusy, setDepBusy] = useState(false);
  const [cashMsg, setCashMsg] = useState('');
  const [upiCfg, setUpiCfg] = useState({ upiId: 'supertotolocal@upi', merchantName: 'Super Toto Local', enabled: true, showQr: true });
  const [driverPos, setDriverPos] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const depositNum = Math.round((Number(depositAmt) || 0) * 100) / 100;
  const upiPayUrl =
    depositNum > 0 && upiCfg.enabled !== false
      ? `upi://pay?pa=${encodeURIComponent(upiCfg.upiId || 'supertotolocal@upi')}&pn=${encodeURIComponent(upiCfg.merchantName || 'Super Toto Local')}&am=${encodeURIComponent(depositNum)}&cu=INR&tn=${encodeURIComponent('Super Toto Local - cash settlement deposit')}`
      : null;

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

  const loadCash = useCallback(async () => {
    try {
      const { data } = await client.get('/driver/cash');
      setCash(data);
    } catch {
      /* ignore */
    }
  }, []);

  const submitDeposit = async () => {
    const amount = Math.round(Number(depositAmt) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      setCashMsg('Enter a valid deposit amount');
      return;
    }
    if (!String(depositRef || '').trim()) {
      setCashMsg('Enter the UPI reference (UTR) of your payment');
      return;
    }
    setDepBusy(true);
    setCashMsg('');
    try {
      const { data } = await client.post('/driver/cash/deposit', { amount, upiRef: depositRef });
      setCashMsg(`✅ ${data.message}`);
      setDepositAmt('');
      setDepositRef('');
      setDepositOpen(false);
      await Promise.all([loadCash(), loadSummary()]);
    } catch (e) {
      setCashMsg(`❌ ${e.response?.data?.message || 'Deposit failed'}`);
    } finally {
      setDepBusy(false);
    }
  };

  useEffect(() => {
    loadActive();
    loadSummary();
    loadCash();
  }, [loadActive, loadSummary, loadCash]);

  useEffect(() => {
    client.get('/upi-config').then(({ data }) => setUpiCfg(data.upiConfig || {})).catch(() => {});
  }, []);

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
                <label className="switch" data-tt="driver-online">
                  <input type="checkbox" checked={isOnline} onChange={toggleOnline} disabled={busy} />
                  <span className="slider" />
                </label>
              </div>
            </div>

            <div className="stats-grid mb" data-tt="driver-stats">
              <div className="card stat" style={{ background: 'var(--brand-light)', border: '2px solid var(--brand-dark)' }}>
                <div className="lbl" style={{ fontWeight: 800, color: 'var(--brand-dark)', fontStyle: 'italic' }}>
                  ✅ Your receivable (after commission)
                </div>
                <div className="num" style={{ color: 'var(--brand-dark)', fontSize: 30, fontWeight: 900, fontStyle: 'italic' }}>
                  {formatINR(summary?.totals?.revenue || 0)}
                </div>
                <div className="small muted">
                  This is the exact amount you receive · platform commission is already deducted.
                </div>
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

            {cash?.due > 0 && (
              <div className="card mb" style={{ border: cash.overdue ? '2px solid var(--danger, #dc3545)' : '2px solid var(--brand-dark)' }}>
                <div className="spread" style={{ marginBottom: 8 }}>
                  <h3 style={{ margin: 0 }}>{cash.overdue ? '🚨 Cash settlement overdue' : '🧾 Cash settlement due'}</h3>
                  <b style={{ fontSize: 26, fontWeight: 900, fontStyle: 'italic', color: cash.overdue ? '#c0392b' : 'var(--brand-dark)' }}>
                    {formatINR(cash.due)}
                  </b>
                </div>
                <p className="small muted" style={{ marginTop: 0 }}>
                  This is the <b>platform's share</b> (commission + GST) you collected in cash on your cash-paid trips.
                  You keep your net share; the platform's share must be returned. Paid via UPI below, or it is{' '}
                  <b>auto-deducted from your digital (UPI/Card) earnings</b>.
                </p>
                {(cash.overdue || (cash.deadlineProgressPct || 0) >= 50) && (
                  <div
                    className="small"
                    style={{
                      background: cash.overdue ? '#fdecea' : '#fff7e6',
                      color: cash.overdue ? '#c0392b' : '#8a6100',
                      fontWeight: 700,
                      padding: '8px 10px',
                      borderRadius: 8,
                      marginBottom: 8,
                      border: `1px solid ${cash.overdue ? '#c0392b' : '#e8c768'}`,
                    }}
                  >
                    {cash.overdue
                      ? `🚨 You have held ${formatINR(cash.due)} for ${cash.overdueByHours} hrs (limit ${cash.limit !== undefined ? formatINR(cash.limit) : '₹500'} / ${cash.deadlineHours || 48}h) — going online is blocked until you deposit.`
                      : `⏳ Deadline uses ${cash.deadlineProgressPct}% of the ${cash.deadlineHours || 48}h window — deposit within ${cash.hoursLeft}h or your online access will be blocked.`}
                  </div>
                )}
                {!cash.overdue && cash.deadlineProgressPct < 50 && (
                  <div className="small muted" style={{ marginBottom: 8 }}>
                    Pending since {cash.cashPendingSince ? new Date(cash.cashPendingSince).toLocaleDateString() : '—'} · stay within the {cash.limit !== undefined ? formatINR(cash.limit) : '₹500'} / {cash.deadlineHours || 48}h limit to keep working.
                  </div>
                )}
                {cash.reminderSent && (
                  <div className="small" style={{ marginBottom: 8, color: '#334155', fontStyle: 'italic' }}>
                    📩 SMS reminder sent to your registered phone {new Date(cash.reminderSentAt).toLocaleString()} — deposit soon to avoid being blocked.
                  </div>
                )}
                {cash.reminderSentJustNow && <div className="small" style={{ marginBottom: 8, color: 'var(--brand-dark)', fontWeight: 700 }}>📩 SMS reminder sent now — please deposit to avoid a block.</div>}
                <div className="spread" style={{ gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setDepositOpen(true)} disabled={depBusy}>
                    💳 Deposit via UPI
                  </button>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setCash(null); loadCash(); }}>
                    ↻ Refresh
                  </button>
                </div>
                {cash.entries?.length > 0 && (
                  <div className="stack" style={{ marginTop: 10 }}>
                    {cash.entries.slice(0, 6).map((e) => (
                      <div key={e.id} className="small spread" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                        <span>
                          {e.type === 'cash_collected' ? '💰 Cash collected' : e.type === 'deposit' ? '📲 UPI deposit' : '🔁 Auto-deducted'}
                          <span className="muted"> · {new Date(e.createdAt).toLocaleString()}</span>
                        </span>
                        <b style={{ color: e.type === 'cash_collected' ? '#c0392b' : 'var(--brand-dark)' }}>
                          {e.type === 'cash_collected' ? '+' : '−'}{formatINR(e.amount)}
                        </b>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {summary?.completed?.length > 0 && (
              <div className="card mb">
                <h3 style={{ margin: '0 0 8px' }}>💰 Your payouts</h3>
                <p className="small muted" style={{ marginTop: 0 }}>
                  Amount owed to you for each completed trip (gross fare − platform commission).
                </p>
                <div className="stack">
                  {summary.completed.map((t) => {
                    const fb = t.fareBreakup || {};
                    const gross = fb.gross || t.fare || 0;
                    const commission = fb.commission || Math.max(0, gross - (fb.driverEarnings || 0));
                    const net = fb.driverEarnings || 0;
                    return (
                      <div
                        key={t._id}
                        className="spread"
                        style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--bg)' }}
                      >
                        <div>
                          <div className="small">
                            {t.pickup?.name} → {t.drop?.name}
                          </div>
                          <div className="small muted">
                            {t.distanceKm} km · gross {formatINR(gross)} − commission {formatINR(commission)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="small muted" style={{ fontStyle: 'italic', fontWeight: 600 }}>Net receivable</div>
                          <b style={{ color: 'var(--brand-dark)', fontSize: 18, fontWeight: 900, fontStyle: 'italic' }}>{formatINR(net)}</b>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Link to="/driver/documents" data-tt="driver-docs" className="btn btn-ghost btn-block mb" style={{ textAlign: 'center' }}>
              📄 View / Upload Documents
            </Link>

            <Link to="/driver/vehicle" data-tt="driver-vehicle" className="btn btn-ghost btn-block mb" style={{ textAlign: 'center' }}>
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
                <span className="muted" style={{ fontStyle: 'italic', fontWeight: 600 }}>You earn (after commission)</span>
                <b style={{ color: 'var(--brand-dark)', fontSize: 20, fontWeight: 900, fontStyle: 'italic' }}>{formatINR(request.fareBreakup?.driverEarnings)}</b>
              </div>
              <div className="small muted">
                Rider: {request.rider?.name} {request.rider?.phone ? `· ${request.rider.phone}` : ''}
              </div>
            </div>
            <div className="row">
              <button className="btn btn-ghost btn-block" onClick={() => respond(false)} disabled={busy}>
                Decline
              </button>
<button data-tt="driver-accept" className="btn btn-primary btn-block" onClick={() => respond(true)} disabled={busy}>
              Accept
            </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={depositOpen} onClose={() => setDepositOpen(false)} title="💳 Deposit cash settlement via UPI">
        <p className="small muted" style={{ marginTop: 0 }}>
          Return the platform's cash share (commission + GST you collected). Scan the QR or tap <b>Pay via UPI</b> with any UPI app, then enter the amount and transaction reference (UTR) below to complete.
        </p>
        <div className="small" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
          <span className="spread">
            <span>Pending cash settlement</span>
            <b style={{ fontWeight: 900, fontStyle: 'italic', color: 'var(--brand-dark)' }}>{formatINR(cash?.due || 0)}</b>
          </span>
        </div>
        <label className="muted" style={{ display: 'block', marginBottom: 4 }}>Amount (₹)</label>
        <input
          className="form-input"
          type="number"
          min="1"
          step="0.01"
          value={depositAmt}
          onChange={(e) => setDepositAmt(e.target.value)}
          placeholder={`Up to ${formatINR(cash?.due || 0)}`}
        />
        {upiCfg.enabled !== false && depositNum > 0 && (
          <div style={{ textAlign: 'center', margin: '14px 0' }}>
            <div style={{ display: 'inline-block', padding: 12, background: '#fff', borderRadius: 12, border: '2px solid #1e293b', marginBottom: 8 }}>
              <QRCodeSVG
                value={upiPayUrl}
                size={170}
                level="H"
                includeMargin={true}
              />
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>
              Pay to: <b>{upiCfg.upiId || 'supertotolocal@upi'}</b> ({upiCfg.merchantName || 'Super Toto Local'})
            </div>
            <button
              className="btn btn-primary btn-block"
              onClick={() => upiPayUrl && window.open(upiPayUrl, '_blank')}
            >
              💳 Pay {formatINR(depositNum)} via UPI
            </button>
            <p className="small muted" style={{ margin: '6px 0 0' }}>
              Opens your UPI app · {upiCfg.instructions || 'Scan the QR or tap the button to pay via any UPI app.'}
            </p>
          </div>
        )}
        {upiCfg.enabled === false && (
          <div style={{ margin: '12px 0' }}>
            <button className="btn btn-primary btn-block" onClick={() => window.open(upiPayUrl, '_blank')} disabled={!upiPayUrl}>
              💳 Pay {depositNum > 0 ? formatINR(depositNum) : 'amount'} via UPI
            </button>
          </div>
        )}
        <label className="muted" style={{ display: 'block', margin: '10px 0 4px' }}>UPI Reference (UTR) — e.g. 4CL7XY29Z</label>
        <input
          className="form-input"
          type="text"
          value={depositRef}
          onChange={(e) => setDepositRef(e.target.value)}
          placeholder="Enter UPI transaction reference"
        />
        {cashMsg && <div className="small" style={{ margin: '10px 0 0', fontWeight: 700, color: cashMsg.startsWith('❌') ? '#c0392b' : 'var(--brand-dark)' }}>{cashMsg}</div>}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={() => setDepositOpen(false)} disabled={depBusy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submitDeposit} disabled={depBusy}>
            {depBusy ? 'Recording…' : 'Confirm deposit'}
          </button>
        </div>
      </Modal>
    </>
  );
}
