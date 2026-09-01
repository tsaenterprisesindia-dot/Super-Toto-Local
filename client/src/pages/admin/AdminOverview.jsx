import { useEffect, useState } from 'react';
import client from '../../api/client.js';
import { apiBase } from '../../api/config.js';
import { formatINR } from '../../utils/geo.js';

export default function AdminOverview() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    client.get('/admin/stats').then(({ data }) => setStats(data.stats)).catch(() => {});
  }, []);

  if (!stats) return <div className="page-loader">Loading…</div>;

  return (
    <div className="fade-in">
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ marginTop: 0 }}>📊 Overview</h2>
          <p className="muted" style={{ marginTop: -8 }}>
            Platform activity at a glance. Admin-only area — riders and drivers can never reach it.
          </p>
        </div>
        <a href={`${apiBase()}/admin/export/users`} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
          📥 Export Users (CSV)
        </a>
      </div>

      <h3 style={{ margin: '0 0 12px' }}>Users &amp; rides</h3>
      <div className="stats-grid mb">
        <div className="card stat">
          <div className="num" style={{ color: 'var(--brand-dark)' }}>{stats.riders}</div>
          <div className="lbl">Riders</div>
        </div>
        <div className="card stat">
          <div className="num" style={{ color: '#1d4ed8' }}>{stats.drivers}</div>
          <div className="lbl">Drivers registered</div>
        </div>
        <div className="card stat">
          <div className="num" style={{ color: 'var(--danger)' }}>{stats.hiddenRiders}</div>
          <div className="lbl">Hidden riders</div>
        </div>
        <div className="card stat">
          <div className="num" style={{ color: 'var(--danger)' }}>{stats.hiddenDrivers}</div>
          <div className="lbl">Hidden drivers</div>
        </div>
        <div className="card stat">
          <div className="num" style={{ color: '#dc2626' }}>{stats.suspendedRiders || 0}</div>
          <div className="lbl">Suspended riders</div>
        </div>
        <div className="card stat">
          <div className="num" style={{ color: '#dc2626' }}>{stats.suspendedDrivers || 0}</div>
          <div className="lbl">Suspended drivers</div>
        </div>
        <div className="card stat">
          <div className="num">{stats.online}</div>
          <div className="lbl">Drivers online</div>
        </div>
        <div className="card stat">
          <div className="num">{stats.rides}</div>
          <div className="lbl">Total rides</div>
        </div>
        <div className="card stat">
          <div className="num">{stats.ridesToday}</div>
          <div className="lbl">Rides today</div>
        </div>
        <div className="card stat">
          <div className="num">{stats.avgFare}</div>
          <div className="lbl">Avg fare</div>
        </div>
      </div>

      <h3 style={{ margin: '0 0 12px' }}>Payments</h3>
      <div className="stats-grid mb">
        <div className="card stat">
          <div className="num" style={{ color: 'var(--amber)' }}>{formatINR(stats.revenue)}</div>
          <div className="lbl">Rider payments (all)</div>
        </div>
        <div className="card stat">
          <div className="num" style={{ color: 'var(--amber)' }}>{formatINR(stats.paid)}</div>
          <div className="lbl">Collected</div>
        </div>
        <div className="card stat">
          <div className="num" style={{ color: 'var(--brand-dark)' }}>{formatINR(stats.outstanding)}</div>
          <div className="lbl">Outstanding ({stats.pendingCount})</div>
        </div>
      </div>

      <h3 style={{ margin: '0 0 12px' }}>💸 Platform earnings</h3>
      <div className="stats-grid">
        <div className="card stat">
          <div className="num" style={{ color: 'var(--brand-dark)' }}>{formatINR(stats.platformRevenue)}</div>
          <div className="lbl">Platform total (commission + GST + fees)</div>
        </div>
        <div className="card stat">
          <div className="num" style={{ color: '#1d4ed8' }}>{formatINR(stats.commission)}</div>
          <div className="lbl">Commission</div>
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
          <div className="lbl">Paid out to drivers</div>
        </div>
        <div className="card stat">
          <div className="num">
            📱 {stats.methods.UPI.rides} · 💵 {stats.methods.Cash.rides} · 💳 {stats.methods.Card.rides}
          </div>
          <div className="lbl">
            Paid rides by method (UPI {formatINR(stats.methods.UPI.amount)} · Cash {formatINR(stats.methods.Cash.amount)} · Card {formatINR(stats.methods.Card.amount)})
          </div>
        </div>
      </div>
    </div>
  );
}
