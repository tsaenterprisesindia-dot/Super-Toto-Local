import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import client from '../api/client.js';
import Nav from '../components/Nav.jsx';
import WarningBanner from '../components/WarningBanner.jsx';
import MapView from '../components/MapView.jsx';
import RideTracker from '../components/RideTracker.jsx';
import SafetyTips from '../components/SafetyTips.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { DESTINATIONS, formatINR } from '../utils/geo.js';

const ACTIVE_STATUSES = ['reserved', 'requested', 'assigned', 'driver_arrived', 'in_progress'];
const VEHICLE_OPTIONS = [
  { id: 'toto', label: '🛺 Toto (E-Rickshaw)', tag: 'Economy' },
  { id: 'auto', label: '🛺 Auto Rickshaw', tag: 'Standard' },
  { id: 'taxi', label: '🚗 Taxi', tag: 'Comfort' },
  { id: 'bike', label: '🏍 Bike Taxi', tag: 'Budget' },
];
const DEFAULT_SEATS = { toto: 4, auto: 3, taxi: 4, bike: 1 };

function SeatMap({ seatCount, taken = 0, mySeats = 0, reserved = false }) {
  const { t } = useTranslation();
  const n = Math.max(1, seatCount || 1);
  const seats = Array.from({ length: n }, (_, i) => i + 1);
  return (
    <div
      className="seatmap"
      title={
        reserved
          ? t('riderhome.seatMapTitleReserved', { taken, n })
          : t('riderhome.seatMapTitle', { taken, n })
      }
    >
      {seats.map((s) => {
        const isTaken = s <= taken;
        const isMine = reserved ? false : s > taken - mySeats;
        const cls = reserved ? 'seat seat-reserved' : isMine && isTaken ? 'seat seat-mine' : isTaken ? 'seat seat-taken' : 'seat seat-free';
        return <span key={s} className={cls}>{s}</span>;
      })}
    </div>
  );
}

export default function RiderHome() {
  const { socket } = useSocket();
  const { t } = useTranslation();
  const [ride, setRide] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [loading, setLoading] = useState(true);

  const [pickup, setPickup] = useState({ ...DESTINATIONS[0] });
  const [drop, setDrop] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [settingField, setSettingField] = useState('pickup');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [luggageCount, setLuggageCount] = useState(0);
  const [seats, setSeats] = useState(1);
  const [vehicleType, setVehicleType] = useState('toto');
  const [fstate, setFstate] = useState('');
  const [stateList, setStateList] = useState([]);

  const [sharedTrips, setSharedTrips] = useState([]);
  const [joinSeats, setJoinSeats] = useState({});
  const [joiningId, setJoiningId] = useState(null);
  const [seatCfg, setSeatCfg] = useState({ mode: 'shared' });

  const currentUserId = JSON.parse(localStorage.getItem('btl_user') || '{}')?.id;

  const seatMode = ['shared', 'reserved', 'off'].includes(seatCfg.mode)
    ? seatCfg.mode
    : seatCfg.enabled === false
      ? 'off'
      : 'shared';
  const seatsEnabled = seatMode !== 'off';
  const reservedSeats = seatMode === 'reserved';
  const maxSeats = estimate?.seatCount || DEFAULT_SEATS[vehicleType] || 4;

  useEffect(() => {
    client
      .get('/seat-booking-config')
      .then(({ data }) => setSeatCfg(data.seatBookingConfig || { mode: 'shared' }))
      .catch(() => {});
    client.get('/fare-policy')
      .then(({ data }) => setStateList(data.states || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!seatsEnabled || reservedSeats) setSeats(1);
  }, [seatsEnabled, reservedSeats]);

  const refreshActive = useCallback(async () => {
    try {
      const { data } = await client.get('/rides/mine');
      const active = data.rides.find((r) => ACTIVE_STATUSES.includes(r.status));
      if (active) setRide(active);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshShared = useCallback(async () => {
    try {
      const { data } = await client.get('/rides/shared');
      setSharedTrips(data.rides.filter((r) => (r.availableSeats || 0) > 0));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshActive();
    refreshShared();
  }, [refreshActive, refreshShared]);

  // Refresh the shared list whenever the user has no active ride (e.g. after it ends)
  useEffect(() => {
    if (!ride) refreshShared();
  }, [ride, refreshShared]);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = (r) => {
      const involved =
        r.rider?._id === currentUserId ||
        (r.rider?.toString?.() ?? String(r.rider || '')) === String(currentUserId) ||
        (r.occupants || []).some((o) => String(o.rider?._id || o.rider) === String(currentUserId));
      if (!involved) return;
      if (['cancelled_by_rider', 'cancelled_by_driver', 'no_driver'].includes(r.status)) {
        setRide(null);
        setDriverPos(null);
        if (r.status === 'no_driver') setNotice(t('riderhome.noDriverNotice'));
        return;
      }
      setRide(r);
      if (!ACTIVE_STATUSES.includes(r.status)) setDriverPos(null);
    };
    const onLoc = (pos) => setDriverPos(pos);

    socket.on('ride:updated', onUpdate);
    socket.on('ride:driver_location', onLoc);
    return () => {
      socket.off('ride:updated', onUpdate);
      socket.off('ride:driver_location', onLoc);
    };
  }, [socket, currentUserId]);

  useEffect(() => {
    if (!pickup || !drop) {
      setEstimate(null);
      return;
    }
    let alive = true;
    client
      .post('/rides/estimate', { pickup, drop, luggage: { count: luggageCount }, seats, vehicleType, state: fstate })
      .then(({ data }) => {
        if (!alive) return;
        setEstimate(data);
        if (data.seatCount) setSeats((s) => Math.min(s, data.seatCount));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pickup, drop, luggageCount, seats, vehicleType, fstate]);

  // Re-clamp the seat count when the vehicle type / capacity changes
  useEffect(() => {
    setSeats((s) => Math.min(Math.max(1, s), maxSeats));
  }, [maxSeats]);

  const pickDestination = (e, which) => {
    const found = DESTINATIONS.find((d) => d.name === e.target.value);
    if (which === 'pickup') setPickup(found);
    else setDrop(found);
  };

  const onMapClick = (latlng) => {
    if (settingField === 'pickup') setPickup({ name: 'Custom pickup', ...latlng, isCustom: true });
    else setDrop({ name: 'Custom drop', ...latlng, isCustom: true });
  };

  const requestRide = async () => {
    if (!pickup || !drop) return;
    setBusy(true);
    setErr('');
    try {
      const { data } = await client.post('/rides', { pickup, drop, luggage: { count: luggageCount }, seats, vehicleType, state: fstate });
      setRide(data.ride);
      refreshShared();
    } catch (e) {
      setErr(e.response?.data?.message || t('riderhome.requestError') || 'Could not request a ride');
    } finally {
      setBusy(false);
    }
  };

  const reserveRide = async () => {
    if (!pickup || !drop) return;
    setBusy(true);
    setErr('');
    try {
      const { data } = await client.post('/rides/reserve', { pickup, drop, luggage: { count: luggageCount }, seats, vehicleType, state: fstate });
      setRide(data.ride);
    } catch (e) {
      setErr(e.response?.data?.message || t('riderhome.reserveError') || 'Could not reserve a ride');
    } finally {
      setBusy(false);
    }
  };

  const joinTrip = async (r) => {
    const n = Math.min(Math.max(1, Number(joinSeats[r._id]) || 1), r.availableSeats || 1);
    setJoiningId(r._id);
    setErr('');
    setNotice('');
    try {
      const { data } = await client.post(`/rides/${r._id}/join`, { seats: n });
      setRide(data.ride);
      refreshShared();
      setNotice(`✅ ${data.message || t('riderhome.seatBooked', { driver: r.driver?.name || '' })}`);
    } catch (e) {
      setErr(e.response?.data?.message || t('riderhome.seatBookedError') || 'Could not book a seat');
    } finally {
      setJoiningId(null);
    }
  };

  if (loading) return <div className="page-loader">{t('common.loading')}</div>;

  return (
    <>
      <Nav />
      <div className="page">
        <WarningBanner />
        <Link to="/rider/documents" className="btn btn-ghost btn-block mb" style={{ textAlign: 'center' }}>
          {t('riderhome.identity')}
        </Link>
        {ride ? (
          <RideTracker
            ride={ride}
            role="rider"
            driverPos={driverPos}
            setRide={setRide}
            socket={socket}
          />
        ) : (
          <>
            <h2>{t('riderhome.bookTitle')}</h2>
            <p className="muted mb">
              {t('riderhome.introLead')}{' '}
              {reservedSeats
                ? t('riderhome.introReserved')
                : seatsEnabled
                  ? t('riderhome.introShared')
                  : t('riderhome.introOff')}
            </p>

            {err && <div className="alert alert-warn mb">{err}</div>}
            {notice && (
              <div className="alert alert-info mb" onClick={() => setNotice('')}>
                {notice}
              </div>
            )}

            <div className="grid-2">
              <div className="map-col">
                <MapView
                  center={pickup}
                  pickup={pickup}
                  drop={drop}
                  onMapClick={onMapClick}
                />
              </div>

              <div className="stack">
                <div className="card">
                  <h3>{t('riderhome.tripDetails')}</h3>

                  <div className="field">
                    <label>{t('riderhome.chooseVehicle')}</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {VEHICLE_OPTIONS.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setVehicleType(v.id)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: vehicleType === v.id ? '2px solid var(--brand)' : '1px solid var(--line)',
                            background: vehicleType === v.id ? 'var(--brand-light, #eef2ff)' : 'var(--card)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: 13,
                            fontWeight: vehicleType === v.id ? 700 : 500,
                          }}
                        >
                          {v.label}
                          <div className="small muted" style={{ fontWeight: 400 }}>
                            {t(`vehicle.tag${v.tag}`)} ·{' '}
                            {seatsEnabled
                              ? t('riderhome.seatsLabel', { count: v.id === 'bike' ? 1 : DEFAULT_SEATS[v.id] })
                              : t('common.noSeats')}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field">
                    <label>🧭 Fare state (state Govt. fare rules)</label>
                    <select className="input" value={fstate} onChange={(e) => setFstate(e.target.value)}>
                      <option value="">National (app default) fares</option>
                      {stateList.map((s) => (
                        <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                    {estimate?.farePolicy && (
                      <div className="alert alert-info small mt">
                        Fares as per <b>{estimate.farePolicy.stateName}</b> state policy ·
                        {estimate.farePolicy.sourceLabel ? <> {estimate.farePolicy.sourceLabel}</> : ' configurable under Admin → State Fares'}
                        {estimate.farePolicy.effectiveFrom ? <> · effective {new Date(estimate.farePolicy.effectiveFrom).toLocaleDateString('en-IN')}</> : ''}
                        {estimate.farePolicy.surgeCap != null && <> · surge capped at ×{estimate.farePolicy.surgeCap}</>}
                      </div>
                    )}
                  </div>

                  <div className="chip-row" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button
                      className={`chip${settingField === 'pickup' ? ' chip-active' : ''}`}
                      onClick={() => setSettingField('pickup')}
                    >
                      {t('riderhome.setPickupMap')}
                    </button>
                    <button
                      className={`chip${settingField === 'drop' ? ' chip-active' : ''}`}
                      onClick={() => setSettingField('drop')}
                    >
                      {t('riderhome.setDropMap')}
                    </button>
                  </div>

                  <div className="field">
                    <label>{t('riderhome.pickup')}</label>
                    {pickup.isCustom ? (
                      <div className="row" style={{ gap: 6 }}>
                        <input
                          className="input"
                          style={{ flex: 1 }}
                          value={pickup.customAddress || ''}
                          onChange={(e) => setPickup({ ...pickup, customAddress: e.target.value, name: e.target.value || 'Custom pickup' })}
                          placeholder={t('riderhome.pickupAddressPlaceholder')}
                          autoFocus
                        />
                        <button type="button" className="btn btn-ghost small" onClick={() => setPickup(DESTINATIONS[0])}>✕</button>
                      </div>
                    ) : (
                      <>
                        <select className="input" value={pickup.name} onChange={(e) => pickDestination(e, 'pickup')}>
                          {DESTINATIONS.map((d) => (
                            <option key={d.name}>{d.name}</option>
                          ))}
                        </select>
                        <button type="button" className="btn btn-ghost small" style={{ marginTop: 4, width: '100%' }} onClick={() => setPickup({ name: 'Custom pickup', lat: 25.5348, lng: 87.5734, isCustom: true })}>
                          {t('riderhome.addCustomPickup')}
                        </button>
                      </>
                    )}
                  </div>

                  <div className="field">
                    <label>{t('riderhome.drop')}</label>
                    {drop?.isCustom ? (
                      <div className="row" style={{ gap: 6 }}>
                        <input
                          className="input"
                          style={{ flex: 1 }}
                          value={drop?.customAddress || ''}
                          onChange={(e) => setDrop({ ...(drop || { lat: 25.5348, lng: 87.5734 }), customAddress: e.target.value, name: e.target.value || 'Custom drop' })}
                          placeholder={t('riderhome.dropAddressPlaceholder')}
                          autoFocus
                        />
                        <button type="button" className="btn btn-ghost small" onClick={() => setDrop(null)}>✕</button>
                      </div>
                    ) : (
                      <>
                        <select className="input" value={drop?.name || ''} onChange={(e) => pickDestination(e, 'drop')}>
                          <option value="">{t('riderhome.selectDestination')}</option>
                          {DESTINATIONS.filter((d) => d.name !== pickup.name).map((d) => (
                            <option key={d.name}>{d.name}</option>
                          ))}
                        </select>
                        <button type="button" className="btn btn-ghost small" style={{ marginTop: 4, width: '100%' }} onClick={() => setDrop({ name: 'Custom drop', lat: 25.5348, lng: 87.5734, isCustom: true })}>
                          {t('riderhome.addCustomDrop')}
                        </button>
                      </>
                    )}
                  </div>

                  <div className="field">
                    {reservedSeats ? (
                      <label>{t('riderhome.seatsAvailable', { count: maxSeats })}</label>
                    ) : seatsEnabled ? (
                      <label>{t('riderhome.seatsToBook', { booked: Math.min(seats, maxSeats), max: maxSeats })}</label>
                    ) : (
                      <label>{t('riderhome.passengers')}</label>
                    )}
                    <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                      {reservedSeats ? (
                        <>
                          <SeatMap seatCount={maxSeats} reserved />
                          <span className="small muted" style={{ marginLeft: 'auto' }}>
                            <b>{t('riderhome.wholeVehicle')}</b>
                          </span>
                        </>
                      ) : seatsEnabled ? (
                        <>
                          <button type="button" className="btn btn-ghost small" onClick={() => setSeats((s) => Math.max(1, s - 1))} disabled={seats <= 1 || !seatsEnabled}>−</button>
                          <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{seats}</span>
                          <button type="button" className="btn btn-ghost small" onClick={() => setSeats((s) => Math.min(maxSeats, s + 1))} disabled={seats >= maxSeats || !seatsEnabled}>+</button>
                          <span className="small muted" style={{ marginLeft: 4 }}>
                            {estimate?.perSeatFare && seatsEnabled ? t('riderhome.perSeat', { fare: formatINR(estimate.perSeatFare) }) : ''}
                          </span>
                        </>
                      ) : null}
                    </div>
                    {seatsEnabled && !reservedSeats && (
                      <div className="seatmap-wrap">
                        <span className="small muted">{t('riderhome.seatAvailability')}</span>
                        <SeatMap seatCount={maxSeats} taken={estimate?.seats || 0} mySeats={seats} />
                        <span className="small muted">{t('riderhome.seatLegend')}</span>
                      </div>
                    )}
                    <div
                      className="small muted"
                      style={{ marginTop: 4 }}
                    >
                      {reservedSeats
                        ? t('riderhome.seatNoteReserved')
                        : seatsEnabled
                          ? t('riderhome.seatNoteShared')
                          : seatCfg.message
                            ? String(seatCfg.message)
                            : t('riderhome.seatNoteOff')}
                    </div>
                  </div>

                  <div className="field">
                    <label>
                      {t('riderhome.luggageLabel', {
                        detail: estimate?.fare?.luggage > 0 ? t('riderhome.luggageCharge') : t('riderhome.luggageFree'),
                      })}
                    </label>
                    <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                      <button type="button" className="btn btn-ghost small" onClick={() => setLuggageCount((c) => Math.max(0, c - 1))} disabled={luggageCount === 0}>−</button>
                      <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{luggageCount}</span>
                      <button type="button" className="btn btn-ghost small" onClick={() => setLuggageCount((c) => c + 1)}>+</button>
                      <span className="small muted" style={{ marginLeft: 4 }}>
                        {luggageCount === 0
                          ? t('riderhome.noLuggage')
                          : luggageCount === 1
                            ? t('riderhome.oneBag')
                            : t('riderhome.bags', { count: luggageCount })}
                      </span>
                    </div>
                    <div className="small muted" style={{ marginTop: 4 }}>
                      {estimate?.luggage?.charge > 0
                        ? t('riderhome.luggageExtra', { fare: formatINR(estimate.luggage.charge) })
                        : t('riderhome.luggageFirstFree')}
                    </div>
                  </div>

                  {estimate ? (
                    <div className="card mt" style={{ background: 'var(--bg)', boxShadow: 'none' }}>
                      {estimate.distanceError ? (
                        <div className="alert alert-warn mb" style={{ marginTop: 0 }}>
                          ⚠️ {estimate.distanceError}
                        </div>
                      ) : null}
                      <div className="spread">
                        <span className="muted">{t('riderhome.distance')}</span>
                        <b>{t('riderhome.distanceLine', { km: estimate.distanceKm, min: estimate.durationMin })}</b>
                      </div>
                      <div className="spread">
                        <span className="muted">{t('riderhome.tripFareWhole')}</span>
                        <b>
                          ₹{estimate.fare.base} + ₹{estimate.fare.distance} + ₹{estimate.fare.time}
                        </b>
                      </div>
                      {estimate.fare.luggage > 0 && (
                        <div className="spread">
                          <span className="muted">{t('riderhome.luggageChargeTrip')}</span>
                          <b>{formatINR(estimate.fare.luggage)}</b>
                        </div>
                      )}
                      {estimate.fare.surge > 1 ? (
                        <div className="spread">
                          <span className="muted">
                            {t('riderhome.surge')} <span className="badge badge-red" style={{ marginLeft: 6 }}>×{estimate.fare.surge}</span>
                          </span>
                          <b>{t('riderhome.surgeExtra', { fare: formatINR(estimate.fare.gross - estimate.fare.subtotal) })}</b>
                        </div>
                      ) : (
                        <div className="spread">
                          <span className="muted">{t('riderhome.surge')}</span>
                          <b className="badge badge-green">{t('riderhome.noSurge')}</b>
                        </div>
                      )}
                      <div className="spread">
                        <span className="muted">{t('riderhome.gst')}</span>
                        <b>{formatINR(estimate.fare.gst)}</b>
                      </div>
                      {estimate.fare.supplyType === 'inter' ? (
                        <div className="spread">
                          <span className="muted">IGST (5%)</span>
                          <b>{formatINR(estimate.fare.igst || estimate.fare.gst)}</b>
                        </div>
                      ) : (
                        <>
                          <div className="spread">
                            <span className="muted">CGST (2.5%)</span>
                            <b>{formatINR(estimate.fare.cgst || 0)}</b>
                          </div>
                          <div className="spread">
                            <span className="muted">SGST (2.5%)</span>
                            <b>{formatINR(estimate.fare.sgst || 0)}</b>
                          </div>
                        </>
                      )}
                      <div className="spread">
                        <span className="muted">{seatsEnabled ? t('riderhome.tripTotalAll', { count: estimate.seatCount }) : t('riderhome.tripTotal')}</span>
                        <b>{formatINR(estimate.fare.total)}</b>
                      </div>
                      <hr style={{ border: 'none', borderTop: '1px dashed var(--line)', margin: '10px 0' }} />
                      {reservedSeats ? (
                        <div className="spread">
                          <span className="muted">{t('riderhome.wholeVehicleTotal', { count: estimate.seatCount })}</span>
                          <b>{formatINR(estimate.riderTotal)}</b>
                        </div>
                      ) : seatsEnabled ? (
                        <div className="spread">
                          <span className="muted">{t('riderhome.yourSeats', { n: estimate.seats, fare: formatINR(estimate.perSeatFare) })}</span>
                          <b>{formatINR(estimate.riderTotal)}</b>
                        </div>
                      ) : null}
                      <div className="spread" style={{ fontSize: 20, fontWeight: 800 }}>
                        <span>{t('riderhome.youPay')}</span>
                        <span style={{ color: 'var(--brand-dark)' }}>{formatINR(estimate.riderTotal)}</span>
                      </div>
                      <div className="small muted" style={{ fontStyle: 'italic', marginTop: 6 }}>
                        {reservedSeats
                          ? t('riderhome.footnoteReserved', { count: estimate.seatCount })
                          : seatsEnabled
                            ? t('riderhome.footnoteShared')
                            : t('riderhome.footnoteOff')}
                      </div>
                      {estimate.activeRequests > 0 && (
                        <div className="small muted mt">
                          {t('riderhome.activeRequests', { count: estimate.activeRequests, drivers: estimate.onlineDrivers })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="alert alert-info">{t('riderhome.selectDrop')}</div>
                  )}

                  {vehicleType === 'bike' && (
                    <div className="bike-safety-banner" style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 10, padding: '10px 14px', marginTop: 12, border: '1px solid #f59e0b' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 20 }}>🏍️</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>{t('riderhome.bikeTitle')}</div>
                          <div style={{ fontSize: 12, color: '#a16207' }}>{t('riderhome.bikeSub')}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="row mt" style={{ gap: 8 }}>
                    <button
                      className="btn btn-ghost btn-lg"
                      style={{ flex: 1 }}
                      disabled={!drop || busy || estimate?.distanceError}
                      onClick={reserveRide}
                    >
                      {reservedSeats ? t('riderhome.reserveWhole') : t('riderhome.reserveBtn')}
                    </button>
                    <button
                      className="btn btn-primary btn-lg"
                      style={{ flex: 1 }}
                      disabled={!drop || busy || estimate?.distanceError}
                      onClick={requestRide}
                    >
                      {busy ? t('riderhome.requesting') : reservedSeats ? t('riderhome.reserveRequest') : t('riderhome.requestNow')}
                    </button>
                  </div>
                </div>

                {seatMode === 'shared' ? (
                <div className="card">
                  <h3 style={{ margin: 0 }}>{t('riderhome.joinTitle')}</h3>
                  <p className="small muted" style={{ marginTop: 4 }}>
                    {t('riderhome.joinSub')}
                  </p>
                  {sharedTrips.length === 0 ? (
                    <div className="small muted" style={{ marginTop: 8 }}>
                      {t('riderhome.noSharedTrips')}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                      {sharedTrips.map((r) => (
                        <div key={r._id} className="card" style={{ padding: 12, boxShadow: 'none', border: '1px solid var(--line)' }}>
                          <div className="spread">
                            <b style={{ fontSize: 13 }}>{r.pickup.name} → {r.drop.name}</b>
                            <span className="badge badge-green">{t('riderhome.seatsLeft', { count: r.availableSeats })}</span>
                          </div>
                          <div className="small muted mt">
                            {t('riderhome.driverLine', { driver: r.driver?.name || '—', vehicle: r.vehicleType, km: r.distanceKm, min: r.durationMin })}
                          </div>
                          <div className="seatmap-wrap">
                            <span className="small muted">{t('riderhome.availableSeatsLabel')}</span>
                            <SeatMap seatCount={r.shared?.seatCount || r.seatCount} taken={r.shared?.seatsTaken || 0} />
                            <span className="small muted">{t('riderhome.perSeatShort', { fare: formatINR(r.shared?.perSeatFare || 0) })}</span>
                          </div>
                          <div className="row mt" style={{ gap: 8, alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-ghost small"
                              onClick={() => setJoinSeats((p) => ({ ...p, [r._id]: Math.max(1, (Number(p[r._id]) || 1) - 1) }))}
                              disabled={(Number(joinSeats[r._id]) || 1) <= 1}
                            >−</button>
                            <b style={{ minWidth: 16, textAlign: 'center' }}>{Math.min(Math.max(1, Number(joinSeats[r._id]) || 1), r.availableSeats)}</b>
                            <button
                              type="button"
                              className="btn btn-ghost small"
                              onClick={() => setJoinSeats((p) => ({ ...p, [r._id]: Math.min(r.availableSeats, (Number(p[r._id]) || 2) + 1) }))}
                              disabled={(Number(joinSeats[r._id]) || 1) >= r.availableSeats}
                            >+</button>
                            <button
                              className="btn btn-primary small"
                              style={{ marginLeft: 'auto' }}
                              disabled={joiningId === r._id}
                              onClick={() => joinTrip(r)}
                            >
                              {joiningId === r._id ? t('riderhome.booking') : t('riderhome.bookSeats', { count: Math.min(Math.max(1, Number(joinSeats[r._id]) || 1), r.availableSeats) })}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

                <div className="card">
                  <h3 style={{ margin: 0 }}>{t('riderhome.howItWorks')}</h3>
                  <ul className="small muted" style={{ paddingLeft: 18, marginBottom: 0 }}>
                    {reservedSeats ? (
                      <li>{t('riderhome.howReserveWhole')}</li>
                    ) : seatsEnabled ? <li>{t('riderhome.howBookSeats')}</li> : null}
                    <li>{t('riderhome.howNearestDriver')}</li>
                    {seatsEnabled && !reservedSeats ? <li>{t('riderhome.howJoinEmpty')}</li> : null}
                    <li>{t('riderhome.howPay')}</li>
                  </ul>
                </div>
                <SafetyTips role="rider" />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}