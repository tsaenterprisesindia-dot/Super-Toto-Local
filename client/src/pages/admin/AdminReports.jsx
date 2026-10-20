import { useEffect, useState } from 'react';
import client from '../../api/client.js';
import { formatINR, timeAgo } from '../../utils/geo.js';

export default function AdminReports() {
  const [stats, setStats] = useState(null);
  const [rides, setRides] = useState([]);

  useEffect(() => {
    client.get('/admin/stats').then(({ data }) => setStats(data.stats)).catch(() => {});
    client.get('/admin/rides').then(({ data }) => setRides(data.rides)).catch(() => {});
  }, []);

  const settled = rides.filter((r) => r.status === 'completed' && r.payment?.status === 'paid');

  return (
    <div className="fade-in">
      <h2 style={{ marginTop: 0 }}>💰 Reports</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Revenue reconciliation — what riders paid, what the platform keeps, and what drivers earned.
      </p>

      {stats && (
        <>
          <div className="stats-grid mb">
            <div className="card stat">
              <div className="num" style={{ color: 'var(--amber)' }}>{formatINR(stats.revenue)}</div>
              <div className="lbl">Total billed</div>
            </div>
            <div className="card stat">
              <div className="num" style={{ color: 'var(--amber)' }}>{formatINR(stats.paid)}</div>
              <div className="lbl">Collected</div>
            </div>
            <div className="card stat">
              <div className="num" style={{ color: 'var(--brand-dark)' }}>{formatINR(stats.outstanding)}</div>
              <div className="lbl">Outstanding ({stats.pendingCount} pending)</div>
            </div>
          </div>

          <div className="stats-grid mb">
            <div className="card stat">
              <div className="num" style={{ color: '#1d4ed8' }}>{formatINR(stats.commission)}</div>
              <div className="lbl">Platform commission</div>
            </div>
            <div className="card stat">
              <div className="num" style={{ color: '#1d4ed8' }}>{formatINR(stats.gst)}</div>
              <div className="lbl">GST collected</div>
            </div>
            <div className="card stat">
              <div className="num" style={{ color: 'var(--amber)' }}>{formatINR(stats.cancellationFees)}</div>
              <div className="lbl">Cancellation fees ({formatINR(stats.cancellationFeesPaid)} paid)</div>
            </div>
            <div className="card stat">
              <div className="num" style={{ color: 'var(--brand-dark)' }}>{formatINR(stats.driverEarnings)}</div>
              <div className="lbl">Driver payouts</div>
            </div>
            <div className="card stat">
              <div className="num" style={{ color: 'var(--brand-dark)' }}>{formatINR(stats.platformRevenue)}</div>
              <div className="lbl">Platform revenue</div>
            </div>
          </div>

          {stats.ambulance && (
            <div className="card mb">
              <h3 style={{ marginTop: 0 }}>🚑 Ambulance earnings</h3>
              <div className="stats-grid">
                <div className="card stat"><div className="num">{stats.ambulance.total}</div><div className="lbl">Ambulance trips</div></div>
                <div className="card stat"><div className="num" style={{ color: 'var(--amber)' }}>{formatINR(stats.ambulance.revenue)}</div><div className="lbl">Billed</div></div>
                <div className="card stat"><div className="num" style={{ color: '#1d4ed8' }}>{formatINR(stats.ambulance.commission)}</div><div className="lbl">Platform commission</div></div>
                <div className="card stat"><div className="num" style={{ color: '#1d4ed8' }}>{formatINR(stats.ambulance.gst)}</div><div className="lbl">GST collected</div></div>
                <div className="card stat"><div className="num" style={{ color: 'var(--brand-dark)' }}>{formatINR(stats.ambulance.driverEarnings)}</div><div className="lbl">Driver/Fleet payouts</div></div>
              </div>
            </div>
          )}

          <h3 style={{ margin: '0 0 12px' }}>Payment methods</h3>
          <div className="stats-grid mb">
            {(['UPI', 'Cash', 'Card']).map((m) => (
              <div className="card stat" key={m}>
                <div className="num">{m === 'UPI' ? '📱' : m === 'Cash' ? '💵' : '💳'} {stats.methods[m]?.rides || 0} rides</div>
                <div className="lbl">{formatINR(stats.methods[m]?.amount || 0)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 style={{ margin: '0 0 12px' }}>Settled rides — fare breakdown</h3>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Rider</th>
              <th>Route</th>
              <th>Gross</th>
              <th>GST</th>
              <th>Commission</th>
              <th>Driver earns</th>
              <th>Total</th>
              <th>Method</th>
            </tr>
          </thead>
          <tbody>
            {settled.map((r) => {
              const fb = r.fareBreakup || {};
              return (
                <tr key={r._id}>
                  <td className="small">{timeAgo(r.createdAt)}</td>
                  <td>{r.rider?.name || '—'}</td>
                  <td className="small">{r.pickup.name} → {r.drop.name}</td>
                  <td>{formatINR(fb.gross ?? r.fare)}</td>
                  <td>{formatINR(fb.gst ?? 0)}</td>
                  <td>{formatINR(fb.commission ?? 0)}</td>
                  <td>{formatINR(fb.driverEarnings ?? 0)}</td>
                  <td>{formatINR(r.fare)}</td>
                  <td>{r.payment?.method || '—'}</td>
                </tr>
              );
            })}
            {settled.length === 0 && (
              <tr>
                <td colSpan={9} className="muted center">No settled rides yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
