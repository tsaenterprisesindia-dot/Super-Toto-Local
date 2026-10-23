import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client.js';
import Nav from '../../components/Nav.jsx';

const driverBadge = (d) => {
  if (d.suspension?.active) return { cls: 'badge-suspended', label: 'Suspended' };
  if (d.isHidden) return { cls: 'badge-gray', label: 'Hidden' };
  if (d.driverStatus === 'approved') return { cls: 'badge-green', label: 'Approved' };
  if (d.driverStatus === 'blocked') return { cls: 'badge-red', label: 'Blocked' };
  return { cls: 'badge-amber', label: 'Pending' };
};

const ambulanceBadge = (d) => {
  const ac = Array.isArray(d.ambulanceCompliance) ? d.ambulanceCompliance : [];
  const active = ac.find((x) => x && x.status === 'approved' && (!x.validTo || new Date(x.validTo) > new Date()));
  const pending = ac.find((x) => x && x.status === 'pending');
  const expired = ac.find((x) => x && x.status === 'approved' && x.validTo && new Date(x.validTo) <= new Date());
  if (active) {
    const state = active.state ? ` ${active.state}` : '';
    const type = active.type ? ` ${active.type}` : '';
    return { cls: 'badge-green', label: `Ambulance OK${type}${state}` };
  }
  if (pending) {
    const state = pending.state ? ` ${pending.state}` : '';
    return { cls: 'badge-amber', label: `Ambulance Pending${state}` };
  }
  if (expired) {
    const state = expired.state ? ` ${expired.state}` : '';
    return { cls: 'badge-red', label: `Ambulance Expired${state}` };
  }
  if (ac.length) {
    return { cls: 'badge-gray', label: 'Ambulance' };
  }
  return null;
};

export default function FleetDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      client.get('/fleet/drivers').then(({ data }) => setDrivers(data.drivers || [])),
      client.get('/fleet/vehicles').then(({ data }) => setVehicles(data.vehicles || [])),
    ])
      .catch((e) => setErr(e.response?.data?.message || 'Could not load fleet drivers'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const vehicleNumber = (id) => vehicles.find((v) => (v._id || v.id) === id)?.vehicleNumber || 'assigned';

  const assign = async (driverId, vehicleId) => {
    if (!vehicleId) return;
    setBusyId(driverId); setErr(''); setMsg('');
    try {
      await client.post('/fleet/assign', { driverId, vehicleId });
      setMsg('Vehicle assigned');
      load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not assign vehicle');
    } finally {
      setBusyId(null);
    }
  };

  const unassign = async (driverId, vehicleId) => {
    if (!window.confirm('Unassign this driver from their vehicle?')) return;
    setBusyId(driverId); setErr(''); setMsg('');
    try {
      await client.post('/fleet/unassign', { driverId, vehicleId });
      setMsg('Driver unassigned');
      load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not unassign driver');
    } finally {
      setBusyId(null);
    }
  };

  const availableVehicles = vehicles.filter((v) => v.status !== 'assigned');
  const filtered = drivers.filter((d) => {
    if (!search.trim()) return true;
    return String(d.name || '').toLowerCase().includes(search.trim().toLowerCase());
  });

  return (
    <>
      <Nav />
      <div className="page fade-in">
      <div className="spread">
        <h2 style={{ marginTop: 0 }}>Fleet Drivers</h2>
        <Link to="/fleet" className="btn btn-ghost small">← Dashboard</Link>
      </div>

      {err && <div className="err-box mb">{err}</div>}
      {msg && <div className="alert alert-green mb">{msg}</div>}

      <input
        className="input"
        placeholder="Search drivers by name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 320, marginBottom: 12 }}
      />

      <div className="card">
        {loading && <p className="muted small">Loading…</p>}
        {!loading && drivers.length === 0 && (
          <p className="muted small">No drivers in your fleet yet. Share your invite code (Fleet Dashboard) so drivers can join.</p>
        )}
        {!loading && drivers.length > 0 && filtered.length === 0 && <p className="muted small">No drivers match your search.</p>}
        {filtered.map((d) => {
          const id = d._id || d.id;
          const badge = driverBadge(d);
          return (
            <div key={id} className="card" style={{ padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <b>{d.name}</b>
                    <span className={`badge ${badge.cls}`}>{badge.label}</span>
                    {d.isOnline && <span className="badge badge-green">online</span>}
                    {(() => {
                      const ab = ambulanceBadge(d);
                      return ab ? <span className={`badge ${ab.cls}`}>{ab.label}</span> : null;
                    })()}
                  </div>
                  <div className="small muted" style={{ marginTop: 2 }}>
                    {d.phone || '—'} · {d.assignedVehicleId ? `Vehicle ${vehicleNumber(d.assignedVehicleId)}` : 'Unassigned'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!d.assignedVehicleId && (
                    <select
                      className="input"
                      style={{ maxWidth: 200 }}
                      disabled={busyId === id || availableVehicles.length === 0}
                      onChange={(e) => assign(id, e.target.value)}
                      value=""
                    >
                      <option value="">{availableVehicles.length ? 'Assign Vehicle' : 'No vehicles available'}</option>
                      {availableVehicles.map((v) => (
                        <option key={v._id || v.id} value={v._id || v.id}>{v.vehicleNumber}</option>
                      ))}
                    </select>
                  )}
                  {d.assignedVehicleId && (
                    <button className="btn btn-ghost" disabled={busyId === id} onClick={() => unassign(id, d.assignedVehicleId)}>
                      {busyId === id ? '…' : 'Unassign'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </>
  );
}
