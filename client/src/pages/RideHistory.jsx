import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import Nav from '../components/Nav.jsx';
import AdBanner from '../components/AdBanner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatINR, timeAgo, PAYMENT_METHODS } from '../utils/geo.js';
import { printInvoice } from '../utils/invoicePrint.js';

const BADGE = {
  completed: 'badge-green',
  requested: 'badge-blue',
  assigned: 'badge-blue',
  driver_arrived: 'badge-blue',
  in_progress: 'badge-amber',
  cancelled_by_rider: 'badge-red',
  cancelled_by_driver: 'badge-red',
  no_driver: 'badge-red',
};

function payStatus(ride) {
  if (ride.status === 'cancelled_by_rider' && ride.cancellationFee > 0) {
    return ride.payment?.status === 'paid'
      ? { text: `Fee paid ✓`, paid: true }
      : { text: `Fee pending · ${formatINR(ride.cancellationFee)}`, paid: false };
  }
  if (ride.payment?.status === 'paid') {
    return { text: `Paid ✓ ${ride.payment.method || ''}`.trim(), paid: true };
  }
  if (ride.payment?.status === 'cash_pending') {
    return { text: 'Cash pending', paid: false };
  }
  return { text: 'Payment pending', paid: false };
}

export default function RideHistory() {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [invId, setInvId] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [invBusy, setInvBusy] = useState(false);

  const load = () => {
    setLoading(true);
    client
      .get('/rides/mine')
      .then(({ data }) => setRides(data.rides))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const payFee = async (id) => {
    setBusyId(id);
    try {
      await client.post(`/rides/${id}/pay`, { method: 'UPI' });
      load();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not pay the cancellation fee');
    } finally {
      setBusyId(null);
    }
  };

  const loadInvoice = async (id) => {
    if (invId === id && invoice) {
      setInvId(null);
      setInvoice(null);
      return;
    }
    setInvId(id);
    setInvBusy(true);
    setInvoice(null);
    try {
      const { data } = await client.get(`/rides/${id}/invoice`);
      setInvoice(data.invoice);
    } catch (e) {
      alert(e.response?.data?.message || 'Could not load invoice');
      setInvId(null);
    } finally {
      setInvBusy(false);
    }
  };

  const invRow = (label, value, bold) => (
    <div className="spread" key={label}>
      <span className="muted">{label}</span>
      <b style={bold ? { fontWeight: 800 } : undefined}>{formatINR(value)}</b>
    </div>
  );

  const renderInvoice = () => {
    if (!invoice) return null;
    const b = invoice.breakup || {};
    return (
      <div className="mt" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--bg)' }}>
        <div className="spread">
          <b>GST Invoice</b>
          <span className="badge badge-green">{invoice.invoiceNo}</span>
        </div>
        <div className="small muted mt">
          {new Date(invoice.invoiceDate).toLocaleString('en-IN')} · {invoice.item}
        </div>
        <div className="small muted">
          {invoice.issuer?.name} · GSTIN: {invoice.issuer?.gstin}
          {invoice.issuer?.state ? ` · ${invoice.issuer.state}` : ''}
          {invoice.issuer?.insurancePolicyNo ? ` · Policy: ${invoice.issuer.insurancePolicyNo}` : ''}
        </div>
        {invoice.supply && (
          <div className="small muted">Place of supply: {invoice.trip?.placeOfSupply || '—'} · SAC {invoice.supply.sac}</div>
        )}
        <div className="small">
          {invoice.trip?.pickup} → {invoice.trip?.drop} · {invoice.trip?.distanceKm} km · ~{invoice.trip?.durationMin} min
        </div>
        <div className="mt" style={{ fontSize: 13 }}>
          {invRow('Base fare', b.base)}
          {invRow(`Distance (${invoice.trip?.distanceKm} km)`, b.distance)}
          {invRow(`Time (${invoice.trip?.durationMin} min)`, b.time)}
          {b.luggage > 0 && invRow('Luggage', b.luggage)}
          {invoice.trip?.status !== 'cancelled_by_rider' && b.gross - b.subtotal > 0 && invRow(`Surge ×${b.surgeMultiplier}`, b.gross - b.subtotal)}
          {invRow('Subtotal', b.subtotal)}
          {invoice.gstTitle && <div className="small muted" style={{ marginTop: 4 }}>{invoice.gstTitle}</div>}
          {(invoice.supply?.cgst > 0) && invRow('CGST (2.5%)', b.cgst)}
          {(invoice.supply?.sgst > 0) && invRow('SGST (2.5%)', b.sgst)}
          {(invoice.supply?.igst > 0) && invRow('IGST (5%)', b.igst)}
          {invRow('Total GST', b.gst)}
          {invRow('Grand total', b.gross + b.gst, true)}
        </div>
        {invoice.passengerInsurance && (
          <div className="small muted mt">🛡️ {invoice.passengerInsurance}</div>
        )}
        {invoice.complianceNote && (
          <div className="small muted mt" style={{ fontStyle: 'italic' }}>{invoice.complianceNote}</div>
        )}
      </div>
    );
  };

  return (
    <>
      <Nav />
      <div className="page">
        <div className="spread">
          <h2>🧾 My rides</h2>
          {user?.role === 'rider' && (
            <Link to="/ride" className="btn btn-primary">
              Book a toto
            </Link>
          )}
        </div>

        {loading ? (
          <div className="page-loader">Loading…</div>
        ) : rides.length === 0 ? (
          <div className="card">
            <p className="muted">No rides yet. Book your first toto!</p>
          </div>
        ) : (
          <div className="stack">
            {rides.map((r) => {
              const ps = payStatus(r);
              return (
                <div className="card" key={r._id}>
                  <div className="spread">
                    <div>
                      <b>
                        {r.pickup.name} → {r.drop.name}
                      </b>
                      <div className="small muted">
                        {timeAgo(r.createdAt)} · {r.distanceKm} km · ~{r.durationMin} min
                      </div>
                      <div className="small muted" style={{ fontStyle: 'italic' }}>
                        * Time is approximate; actual time may vary.
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className={`badge mb ${BADGE[r.status] || 'badge-gray'}`}>{r.status}</div>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>
                        {r.status === 'cancelled_by_rider' && r.cancellationFee > 0
                          ? formatINR(r.cancellationFee)
                          : formatINR(r.fare)}
                      </div>
                      <div className="small muted">
                        {r.status === 'cancelled_by_rider' && r.cancellationFee > 0
                          ? 'Cancellation fee'
                          : 'Fare (incl. GST)'}
                      </div>
                      <div className={`small ${ps.paid ? 'muted' : ''}`}>
                        {ps.text}
                      </div>
                    </div>
                  </div>
                  {r.status === 'cancelled_by_rider' && r.cancellationFee > 0 && !ps.paid && user?.role === 'rider' && (
                    <button
                      className="btn btn-primary btn-block mt"
                      disabled={busyId === r._id}
                      onClick={() => payFee(r._id)}
                    >
                      Pay cancellation fee · {formatINR(r.cancellationFee)} (UPI)
                    </button>
                  )}
                  {r.driver && user?.role === 'rider' && (
                    <div className="small muted mt">
                      🛺 {r.driver.name} · {r.driver.vehicleNumber}
                      {r.riderRating ? ` · you rated ⭐ ${r.riderRating}` : ''}
                    </div>
                  )}
                  {r.rider && user?.role === 'driver' && (
                    <div className="small muted mt">
                      👤 {r.rider.name}
                      {r.driverRating ? ` · you rated ⭐ ${r.driverRating}` : ''}
                    </div>
                  )}
                  {['completed', 'cancelled_by_rider'].includes(r.status) && (
                    <>
                      <div className="spread mt">
                        <button
                          className="btn btn-ghost"
                          style={{ flex: 1, marginRight: 6 }}
                          disabled={invBusy && invId === r._id}
                          onClick={() => loadInvoice(r._id)}
                        >
                          {invId === r._id && invoice ? 'Hide invoice' : invId === r._id && !invoice ? 'Loading…' : '🧾 GST invoice'}
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ flex: 1, marginLeft: 6 }}
                          disabled={invBusy || !r._id}
                          onClick={async () => {
                            setInvBusy(true);
                            try {
                              const { data } = await client.get(`/rides/${r._id}/invoice`);
                              printInvoice(data.invoice);
                            } catch (e) {
                              alert(e.response?.data?.message || 'Could not download invoice');
                            } finally {
                              setInvBusy(false);
                            }
                          }}
                        >
                          ⬇️ Download / Print PDF
                        </button>
                      </div>
                      {invId === r._id && renderInvoice()}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <AdBanner />
    </>
  );
}
