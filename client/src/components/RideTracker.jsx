import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import client from '../api/client.js';
import MapView from './MapView.jsx';
import AdBanner from './AdBanner.jsx';
import AdInterstitial from './AdInterstitial.jsx';
import { STATUS_LABELS, formatINR, formatTime, PAYMENT_METHODS } from '../utils/geo.js';

const STEPS = [
  { key: 'assigned', tKey: 'tracker.stAssigned' },
  { key: 'driver_arrived', tKey: 'tracker.stArrived' },
  { key: 'in_progress', tKey: 'tracker.stInProgress' },
  { key: 'completed', tKey: 'tracker.stCompleted' },
];

function StarPicker({ value, onChange, disabled }) {
  return (
    <div className="row">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          disabled={disabled}
          onClick={() => onChange(n)}
          style={{
            fontSize: 26,
            background: 'none',
            border: 'none',
            filter: n <= value ? 'none' : 'grayscale(1)',
          }}
        >
          ⭐
        </button>
      ))}
    </div>
  );
}

export default function RideTracker({ ride, role, driverPos, setRide, socket }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [rating, setRating] = useState(0);
  const [method, setMethod] = useState('UPI');
  const [reviewTexts, setReviewTexts] = useState({ driverFeedback: '', distanceFeedback: '', timeFeedback: '' });
  const [fbCfg, setFbCfg] = useState({ enabled: true, discountAmount: 10 });
  const [adsCfg, setAdsCfg] = useState({ enabled: false, interstitialFrequency: 3 });
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [upiCfg, setUpiCfg] = useState({ upiId: '', merchantName: 'Super Toto Local', enabled: true, showQr: true });
  const [upiPaid, setUpiPaid] = useState(false);
  const [seatCfg, setSeatCfg] = useState({ mode: 'shared' });

  const isRider = role === 'rider';
  const seatMode = ['shared', 'reserved', 'off'].includes(seatCfg.mode)
    ? seatCfg.mode
    : seatCfg.enabled === false
      ? 'off'
      : 'shared';
  const seatsEnabled = seatMode !== 'off';
  const reservedTrip = ride.shared?.mode === 'reserved' || ride.shared?.reserved === true;
  const statusIdx = STEPS.findIndex((s) => s.key === ride.status);
  const completed = ride.status === 'completed';
  const fb = ride.fareBreakup || {};
  const userId = JSON.parse(localStorage.getItem('btl_user') || '{}')?.id;
  const isCreator = String(ride.rider?._id || ride.rider) === String(userId);
  const myOcc = (ride.occupants || []).find((o) => String(o.rider?._id || o.rider) === String(userId));
  const seatsTotal = ride.shared?.seatCount || 0;
  const seatsTaken = ride.shared?.seatsTaken || 0;
  const otherRiders = Math.max(0, (ride.occupants || []).length - (myOcc ? 1 : 0));
  const mySeats = myOcc?.seats || 0;
  const myFare = myOcc?.fare !== undefined ? myOcc.fare : ride.fare;
  const paymentView = isRider && myOcc ? myOcc.payment : ride.payment || {};
  const paid = paymentView?.status === 'paid';
  const cashPending = isRider
    ? paymentView?.status === 'cash_pending'
    : ride.payment?.status === 'cash_pending' ||
      (ride.occupants || []).some((o) => o.payment?.status === 'cash_pending');

  useEffect(() => {
    socket?.emit('ride:join', ride._id);
  }, [ride._id, socket]);

  useEffect(() => {
    client.get('/feedback-config').then(({ data }) => setFbCfg(data.feedbackConfig || {})).catch(() => {});
    client.get('/ads-config').then(({ data }) => setAdsCfg(data.adsConfig || {})).catch(() => {});
    client.get('/upi-config').then(({ data }) => setUpiCfg(data.upiConfig || {})).catch(() => {});
    client.get('/seat-booking-config').then(({ data }) => setSeatCfg(data.seatBookingConfig || { mode: 'shared' })).catch(() => {});
  }, []);

  useEffect(() => {
    if (!completed || !isRider || !adsCfg.enabled || !adsCfg.interstitialEnabled) return;
    const rideCount = parseInt(localStorage.getItem('stl_ride_count') || '0', 10);
    localStorage.setItem('stl_ride_count', String(rideCount + 1));
    if ((rideCount + 1) % (adsCfg.interstitialFrequency || 3) === 0) {
      const t = setTimeout(() => setShowInterstitial(true), 1500);
      return () => clearTimeout(t);
    }
  }, [completed, isRider, adsCfg]);

  const act = async (fn, then) => {
    setBusy(true);
    setErr('');
    try {
      const { data } = await fn();
      setRide(data.ride || data);
      then?.(data);
    } catch (e) {
      setErr(e.response?.data?.message || t('tracker.errGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const pay = () => act(() => client.post(`/rides/${ride._id}/pay`, { method }));
  const settleCash = () => act(() => client.post(`/driver/settle/${ride._id}`));
  const rate = () =>
    act(() => client.post(`/rides/${ride._id}/rate`, { rating, ratedRole: isRider ? 'driver' : 'rider' }));

  const submitReview = () =>
    act(() => client.post(`/rides/${ride._id}/review`, reviewTexts));

  const canCancel = ['requested', 'assigned'].includes(ride.status);
  const driver = ride.driver;
  const methodMeta = PAYMENT_METHODS.find((m) => m.id === method) || PAYMENT_METHODS[0];

  return (
    <div className="grid-2 fade-in">
      <div className="map-col">
        <MapView
          pickup={ride.pickup}
          drop={ride.drop}
          driverPos={driverPos || (ride.driver?.location?.lat != null ? ride.driver.location : null)}
        />
      </div>

      <div className="stack">
        <div className="card">
          <div className="spread">
            <h3 style={{ margin: 0 }}>
              {isRider ? t('tracker.yourRide') : t('tracker.driverRide')} ·{' '}
              <span className="badge badge-blue">{STATUS_LABELS[ride.status]}</span>
            </h3>
          </div>

          {err && <div className="err-box mt">{err}</div>}

          {driver ? (
            <div className="card mt" style={{ boxShadow: 'none', background: 'var(--bg)' }}>
              <div className="row">
                <span className="avatar" style={{ background: '#1d4ed8' }}>
                  {driver.name?.[0]?.toUpperCase()}
                </span>
                <div>
                  <b>{driver.name}</b>
                  <div className="small muted">
                    {driver.vehicleType} · {driver.vehicleNumber || '—'} · ⭐ {driver.rating?.toFixed?.(1) || '—'}
                  </div>
                </div>
              </div>
              {driver.vehicleDetails?.brand && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--card)', borderRadius: 8, border: '1px solid var(--line)' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{t('tracker.vehicleDetails')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
                    <span className="muted">{t('tracker.brand')}</span><b>{driver.vehicleDetails.brand}</b>
                    <span className="muted">{t('tracker.model')}</span><b>{driver.vehicleDetails.model || '—'}</b>
                    <span className="muted">{t('tracker.year')}</span><b>{driver.vehicleDetails.year || '—'}</b>
                    <span className="muted">{t('tracker.color')}</span><b>{driver.vehicleDetails.color || '—'}</b>
                    <span className="muted">{t('tracker.seats')}</span><b>{driver.vehicleDetails.seats || '—'}</b>
                    <span className="muted">{t('tracker.luggage')}</span><b>{driver.vehicleDetails.luggageCapacityKg || 0} kg</b>
                    <span className="muted">{t('tracker.fuel')}</span><b>{driver.vehicleDetails.fuelType || '—'}</b>
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 10, fontSize: 11 }}>
                    {driver.vehicleDetails.hasStep && <span className="badge badge-green">Step ✓</span>}
                    {driver.vehicleDetails.hasCanopy && <span className="badge badge-green">Canopy ✓</span>}
                    {driver.vehicleDetails.hasStorage && <span className="badge badge-green">Storage ✓</span>}
                  </div>
                </div>
              )}
            </div>
          ) : ride.status === 'reserved' ? (
            <div className="alert alert-info mt">
              {t('tracker.reservedNotDispatched')}
            </div>
          ) : (
            <div className="alert alert-warn mt pulse">
              {t('tracker.searching')}
            </div>
          )}

          <ul className="timeline mt">
            {STEPS.map((s, i) => (
              <li
                key={s.key}
                className={
                  ride.status === s.key || (ride.status === 'completed' && i <= statusIdx)
                    ? 'done'
                    : ride.status === s.key
                      ? 'active'
                      : ''
                }
              >
                <span className="dot" />
                <div>
                  <div className="t-label">{t(s.tKey)}</div>
                  <div className="t-sub">
                    {s.key === 'assigned' && formatTime(ride.acceptedAt)}
                    {s.key === 'driver_arrived' && formatTime(ride.arrivedAt)}
                    {s.key === 'in_progress' && formatTime(ride.startedAt)}
                    {s.key === 'completed' && formatTime(ride.completedAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="spread">
            <div>
              <div className="small muted">{t('tracker.pickup')}</div>
              <b>{ride.pickup.name}</b>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="small muted">{t('tracker.drop')}</div>
              <b>{ride.drop.name}</b>
            </div>
          </div>
          <hr style={{ border: 'none', borderTop: '1px dashed var(--line)', margin: '14px 0' }} />
          <div className="spread">
            <span className="muted">{t('tracker.distance')}</span>
            <b>{ride.distanceKm} km</b>
          </div>
          <div className="spread">
            <span className="muted">{t('tracker.estTime')}</span>
            <b>{ride.durationMin} min</b>
          </div>
          {seatsEnabled && seatsTotal > 0 && (
            <>
              {reservedTrip ? (
                <div className="spread">
                  <span className="muted">{t('tracker.vehicleReservedWhole')}</span>
                  <b>{t('tracker.allYours', { count: seatsTotal })}</b>
                </div>
              ) : (
                <div className="spread">
                  <span className="muted">{t('tracker.vehicleSeats')}</span>
                  <b>{t('tracker.bookedN', { taken: seatsTaken, total: seatsTotal })}</b>
                </div>
              )}
              {mySeats > 0 && (
                <div className="spread">
                  <span className="muted">{reservedTrip ? t('tracker.wholeVehicleAll') : t('tracker.yourSeats')}</span>
                  <b>{reservedTrip ? formatINR(myFare) : `${mySeats} × ${formatINR(ride.shared?.perSeatFare || 0)}`}</b>
                </div>
              )}
              {isRider && otherRiders > 0 && (
                <div className="spread">
                  <span className="muted">{t('tracker.otherRiders')}</span>
                  <b>{otherRiders}</b>
                </div>
              )}
            </>
          )}
          {ride.luggage?.count > 0 && (
            <div className="spread">
              <span className="muted">{t('tracker.luggage')}</span>
              <b>{t('tracker.luggageLine', { count: ride.luggage.count })}{ride.luggage.charge > 0 ? t('tracker.luggageCharge', { fare: formatINR(ride.luggage.charge) }) : t('tracker.luggageFree')}</b>
            </div>
          )}
          {fb.subtotal > 0 && (
            <>
              <div className="spread">
                <span className="muted">{t('tracker.tripFareWhole')}</span>
                <b>₹{fb.base} + ₹{fb.distance} + ₹{fb.time}</b>
              </div>
              {fb.feedbackDiscount > 0 && (
                <div className="spread">
                  <span className="muted">{t('tracker.reviewDiscount')}</span>
                  <b style={{ color: '#16a34a' }}>-{formatINR(fb.feedbackDiscount)}</b>
                </div>
              )}
              <div className="spread">
                <span className="muted">{t('tracker.surge')}</span>
                <b>{fb.surge > 1 ? <span className="badge badge-red">×{fb.surge}</span> : <span className="badge badge-green">×1.0</span>}</b>
              </div>
              <div className="spread">
                <span className="muted">GST (5%)</span>
                <b>{formatINR(fb.gst)}</b>
              </div>
              {fb.supplyType === 'inter' ? (
                <div className="spread">
                  <span className="muted">IGST (5%)</span>
                  <b>{formatINR(fb.igst || fb.gst)}</b>
                </div>
              ) : (
                <>
                  <div className="spread">
                    <span className="muted">CGST (2.5%)</span>
                    <b>{formatINR(fb.cgst || 0)}</b>
                  </div>
                  <div className="spread">
                    <span className="muted">SGST (2.5%)</span>
                    <b>{formatINR(fb.sgst || 0)}</b>
                  </div>
                </>
              )}
              {seatsEnabled && seatsTotal > 1 && (
                <div className="spread">
                  <span className="muted">{t('tracker.tripTotalAll', { count: seatsTotal })}</span>
                  <b>{formatINR(fb.total)}</b>
                </div>
              )}
              <hr style={{ border: 'none', borderTop: '1px dashed var(--line)', margin: '10px 0' }} />
            </>
          )}
          <div className="spread" style={{ fontSize: 18, fontWeight: 800 }}>
            <span>
              {isRider
                ? mySeats > 0 && seatsEnabled
                  ? reservedTrip
                    ? t('tracker.youPayWhole')
                    : t('tracker.youPaySeats', { count: mySeats })
                  : t('tracker.youPayPlain')
                : t('tracker.collectedTrip')}
            </span>
            <span style={{ color: 'var(--brand-dark)' }}>{formatINR(isRider ? myFare : fb.total)}</span>
          </div>
          {!isRider && fb.driverEarnings > 0 && (
            <div className="spread mt" style={{ fontWeight: 700 }}>
              <span className="muted">{t('tracker.youEarn', { pct: Math.round((fb.gross - fb.driverEarnings) / fb.gross * 100) })}</span>
              <span style={{ color: 'var(--brand-dark)' }}>{formatINR(fb.driverEarnings)}</span>
            </div>
          )}
          {paid && (
            <div className="alert alert-green mt" style={{ marginBottom: 0 }}>
              {t('tracker.paidMsg', { amount: formatINR(paymentView.amount || myFare), method: paymentView.method || 'UPI' })}
              {paymentView.paidAt ? ` · ${formatTime(paymentView.paidAt)}` : ''}
            </div>
          )}
        </div>

        {/* Rider controls */}
        {isRider && ride.status === 'reserved' && isCreator && (
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn btn-ghost btn-block"
              disabled={busy}
              onClick={() => act(() => client.post(`/rides/${ride._id}/unreserve`))}
            >
              {t('tracker.unreserve')}
            </button>
            <button
              className="btn btn-primary btn-block"
              disabled={busy}
              onClick={() => act(() => client.post(`/rides/${ride._id}/dispatch`))}
            >
              {t('tracker.dispatchNow')}
            </button>
          </div>
        )}

        {isRider && canCancel && isCreator && (
          <button
            className="btn btn-danger btn-block"
            disabled={busy}
            onClick={() => act(() => client.post(`/rides/${ride._id}/cancel`))}
          >
            {t('tracker.cancelRide')}{' '}
            {ride.status === 'assigned' ? t('tracker.cancelFee') : ''}
          </button>
        )}

        {isRider && completed && !paid && !cashPending && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{t('tracker.paymentTitle')}{mySeats > 0 ? t('tracker.paymentSeats', { count: mySeats }) : ''}</h3>
            <div className="chip-row" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  className={`chip${method === m.id ? ' chip-active' : ''}`}
                  onClick={() => { setMethod(m.id); setUpiPaid(false); }}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
            {method === 'UPI' && upiCfg.enabled && (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                {upiCfg.showQr && (
                  <div style={{ display: 'inline-block', padding: 16, background: '#fff', borderRadius: 12, border: '2px solid #1e293b', marginBottom: 12 }}>
                    <QRCodeSVG
                      value={`upi://pay?pa=${encodeURIComponent(upiCfg.upiId)}&pn=${encodeURIComponent(upiCfg.merchantName)}&am=${encodeURIComponent(myFare || 0)}&cu=INR`}
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                )}
                <div style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>
                  <b>{t('tracker.upiId')}</b> {upiCfg.upiId}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                  {upiCfg.instructions}
                </div>
                <button
                  className="btn btn-primary btn-block btn-lg"
                  style={{ maxWidth: 300, margin: '0 auto' }}
                  onClick={() => {
                    const url = `upi://pay?pa=${encodeURIComponent(upiCfg.upiId)}&pn=${encodeURIComponent(upiCfg.merchantName)}&am=${encodeURIComponent(myFare || 0)}&cu=INR`;
                    window.open(url, '_blank');
                  }}
                >
                  {t('tracker.openUpiPay', { amount: formatINR(myFare) })}
                </button>
                <div style={{ marginTop: 12 }}>
                  <button
                    className="btn btn-success btn-block btn-lg"
                    style={{ maxWidth: 300, margin: '0 auto' }}
                    disabled={busy || upiPaid}
                    onClick={() => { setUpiPaid(true); pay(); }}
                  >
                    {upiPaid ? t('tracker.upiConfirmed') : t('tracker.ivePaid', { amount: formatINR(myFare) })}
                  </button>
                </div>
                <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
                  {t('tracker.upiStep1')}<br/>
                  {t('tracker.upiStep2')}<br/>
                  {t('tracker.upiStep3')}
                </p>
              </div>
            )}

            {method === 'UPI' && !upiCfg.enabled && (
              <button className="btn btn-primary btn-block btn-lg" disabled={busy} onClick={pay}>
                {t('tracker.payMock', { icon: methodMeta.icon, amount: formatINR(myFare), method })}
              </button>
            )}

            {method === 'Cash' && (
              <button className="btn btn-primary btn-block btn-lg" disabled={busy} onClick={pay}>
                {t('tracker.payCash', { amount: formatINR(myFare) })}
              </button>
            )}

            {method === 'Card' && (
              <button className="btn btn-primary btn-block btn-lg" disabled={busy} onClick={pay}>
                {t('tracker.payMock', { icon: methodMeta.icon, amount: formatINR(myFare), method })}
              </button>
            )}

            <p className="small muted" style={{ marginBottom: 0 }}>
              {method === 'Cash'
                ? t('tracker.cashHint')
                : method === 'Card'
                  ? t('tracker.cardHint')
                  : !upiCfg.enabled
                    ? t('tracker.upiMockHint')
                    : ''}
            </p>
          </div>
        )}

        {isRider && completed && cashPending && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{t('tracker.cashPaymentTitle')}</h3>
            <div className="alert alert-warn mb">
              {t('tracker.cashPendingNote', { amount: formatINR(paymentView.amount || myFare) })}
            </div>
          </div>
        )}

        {isRider && completed && paid && isCreator && !ride.riderRating && (
          <div className="card animate-slide-up">
            <h3 style={{ marginTop: 0 }}>{t('tracker.rateDriver')}</h3>
            <StarPicker value={rating} onChange={setRating} />
            <button className="btn btn-primary btn-block mt" disabled={busy || !rating} onClick={rate}>
              {t('tracker.submitRating')}
            </button>
          </div>
        )}

        {isRider && completed && paid && isCreator && !ride.riderReview?.submittedAt && fbCfg.enabled && (
          <div className="review-card-animated">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h3 style={{ marginTop: 0, marginBottom: 0 }}>{t('tracker.reviewTitle')}</h3>
              {fbCfg.discountAmount > 0 && (
                <span className="review-discount-badge">💰 {t('tracker.reviewDiscountOff', { amount: formatINR(fbCfg.discountAmount) })}</span>
              )}
            </div>
            <p className="small muted" style={{ marginTop: 4, marginBottom: 14 }}>
              {fbCfg.discountAmount > 0
                ? t('tracker.reviewUnlock')
                : t('tracker.reviewImprove')}
            </p>
            {fbCfg.requireDriverFeedback && (
              <div className="field" style={{ marginBottom: 10 }}>
                <label htmlFor="driverFeedback">{fbCfg.driverFeedbackLabel || 'How was the driver?'}</label>
                <textarea
                  id="driverFeedback"
                  className="input"
                  rows={2}
                  placeholder={fbCfg.driverFeedbackPlaceholder || 'Driver behaviour, driving skills, politeness…'}
                  value={reviewTexts.driverFeedback}
                  onChange={(e) => setReviewTexts((p) => ({ ...p, driverFeedback: e.target.value }))}
                />
              </div>
            )}
            {fbCfg.requireDistanceFeedback && (
              <div className="field" style={{ marginBottom: 10 }}>
                <label htmlFor="distanceFeedback">{fbCfg.distanceFeedbackLabel || 'Was the travel distance accurate?'}</label>
                <textarea
                  id="distanceFeedback"
                  className="input"
                  rows={2}
                  placeholder={fbCfg.distanceFeedbackPlaceholder || 'Was the route taken accurate and shortest?'}
                  value={reviewTexts.distanceFeedback}
                  onChange={(e) => setReviewTexts((p) => ({ ...p, distanceFeedback: e.target.value }))}
                />
              </div>
            )}
            {fbCfg.requireTimeFeedback && (
              <div className="field" style={{ marginBottom: 10 }}>
                <label htmlFor="timeFeedback">{fbCfg.timeFeedbackLabel || 'Was the travel time reasonable?'}</label>
                <textarea
                  id="timeFeedback"
                  className="input"
                  rows={2}
                  placeholder={fbCfg.timeFeedbackPlaceholder || 'Was the estimated time accurate?'}
                  value={reviewTexts.timeFeedback}
                  onChange={(e) => setReviewTexts((p) => ({ ...p, timeFeedback: e.target.value }))}
                />
              </div>
            )}
            <button
              className="btn btn-primary btn-block btn-lg"
              disabled={busy || (fbCfg.requireDriverFeedback && !reviewTexts.driverFeedback.trim()) || (fbCfg.requireDistanceFeedback && !reviewTexts.distanceFeedback.trim()) || (fbCfg.requireTimeFeedback && !reviewTexts.timeFeedback.trim())}
              onClick={submitReview}
              style={{ marginTop: 4 }}
            >
              {fbCfg.discountAmount > 0
                ? t('tracker.reviewCtaOff', { amount: formatINR(fbCfg.discountAmount) })
                : t('tracker.reviewCta')}
            </button>
          </div>
        )}

        {isRider && completed && ride.riderReview?.submittedAt && ride.riderReview.feedbackDiscount > 0 && (
          <div className="review-success-animated">
            ✅ {(fbCfg.discountMessage || t('tracker.reviewSuccess')).replace('{amount}', ride.riderReview.feedbackDiscount)}
          </div>
        )}

        {isRider && completed && ride.riderRating && !ride.riderReview?.submittedAt && (
          <div className="alert alert-green animate-pop">{t('tracker.ratedDriver', { rating: ride.riderRating })}</div>
        )}

        {/* Driver controls */}
        {!isRider && ride.status === 'assigned' && (
          <button
            className="btn btn-amber btn-block btn-lg"
            disabled={busy}
            onClick={() => act(() => client.post(`/driver/arrived/${ride._id}`))}
          >
            {t('tracker.arrivedPickup')}
          </button>
        )}
        {!isRider && ride.status === 'driver_arrived' && (
          <button
            className="btn btn-primary btn-block btn-lg"
            disabled={busy}
            onClick={() => act(() => client.post(`/driver/start/${ride._id}`))}
          >
            {t('tracker.startTrip')}
          </button>
        )}
        {!isRider && ride.status === 'in_progress' && (
          <button
            className="btn btn-primary btn-block btn-lg"
            disabled={busy}
            onClick={() => act(() => client.post(`/driver/complete/${ride._id}`))}
          >
            {t('tracker.completeEarn', { amount: formatINR(fb.driverEarnings) })}
          </button>
        )}
        {!isRider && completed && cashPending && (
          <button className="btn btn-primary btn-block btn-lg" disabled={busy} onClick={settleCash}>
            {t('tracker.confirmCash', { amount: formatINR(seatsTotal ? fb.total : (ride.payment.amount || ride.fare)) })}
          </button>
        )}
        {!isRider && completed && !ride.driverRating && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{t('tracker.rateRider')}</h3>
            <StarPicker value={rating} onChange={setRating} />
            <button className="btn btn-primary btn-block mt" disabled={busy || !rating} onClick={rate}>
              {t('tracker.submitRating')}
            </button>
          </div>
        )}
        {!isRider && completed && ride.driverRating && (
          <div className="alert alert-green">{t('tracker.ratedRider', { rating: ride.driverRating })}</div>
        )}
      </div>
      <AdBanner />
      <AdInterstitial visible={showInterstitial} onClose={() => setShowInterstitial(false)} />
    </div>
  );
}
