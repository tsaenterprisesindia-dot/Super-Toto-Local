import { useEffect, useState } from 'react';
import client from '../../api/client.js';

const STATUS_CLS = { approved: 'badge-green', pending: 'badge-amber', blocked: 'badge-red' };

export default function AdminFleet() {
  const [overview, setOverview] = useState({ owners: 0, vehicles: 0, drivers: 0 });
  const [owners, setOwners] = useState([]);
  const [selected, setSelected] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      client.get('/admin/fleet-overview').then(({ data }) => setOverview(data.overview || { owners: 0, vehicles: 0, drivers: 0 })),
      client.get('/admin/fleet-owners').then(({ data }) => setOwners(data.owners || [])),
    ])
      .catch((e) => setErr(e.response?.data?.message || 'Could not load fleet data'))
      .finally(() => setLoading(false));
  }, []);

  const select = (owner) => {
    setSelected(owner);
    setVehicles([]);
    setDrivers([]);
    setDetailLoading(true);
    setErr('');
    const id = owner._id || owner.id;
    Promise.all([
      client.get(`/admin/fleet-owners/${id}/vehicles`).then(({ data }) => setVehicles(data.vehicles || [])),
      client.get(`/admin/fleet-owners/${id}/drivers`).then(({ data }) => setDrivers(data.drivers || [])),
    ])
      .catch((e) => setErr(e.response?.data?.message || 'Could not load fleet details'))
      .finally(() => setDetailLoading(false));
  };

  const setStatus = async (owner, status) => {
    if (status === 'blocked' && !window.confirm(`Block ${owner.name}? Their drivers will be affected.`)) return;
    const id = owner._id || owner.id;
    setBusyId(id); setErr(''); setMsg('');
    try {
      await client.patch(`/admin/fleet-owners/${id}/status`, { status });
      const list = await client.get('/admin/fleet-owners');
      setOwners(list.data.owners || []);
      setSelected((cur) => (cur && (cur._id || cur.id) === id ? { ...cur, fleetStatus: status } : cur));
      setMsg(`Fleet owner ${owner.name} marked ${status}`);
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not update status');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = owners.filter((o) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [o.name, o.email, o.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });
  const pendingCount = owners.filter((o) => o.fleetStatus === 'pending').length;

  return (
    <div className="page fade-in">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ marginTop: 0 }}>Fleet Management</h2>
        {pendingCount > 0 && <span className="badge badge-amber">{pendingCount} awaiting approval</span>}
      </div>

      {msg && <div className="alert alert-green mb">{msg}</div>}
      {err && <div className="err-box mb">{err}</div>}

      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: 10, minWidth: 120 }}><b>{overview.owners}</b> <div className="small muted">Fleet Owners</div></div>
        <div className="card" style={{ padding: 10, minWidth: 120 }}><b>{overview.vehicles}</b> <div className="small muted">Fleet Vehicles</div></div>
        <div className="card" style={{ padding: 10, minWidth: 120 }}><b>{overview.drivers}</b> <div className="small muted">Fleet Drivers</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginTop: 12 }}>
        <div className="card">
          <div className="spread" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Fleet Owners</h3>
          </div>
          <input
            className="input"
            placeholder="Search name, email or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 10 }}
          />
          {loading && <p className="muted small">Loading…</p>}
          {!loading && filtered.length === 0 && <p className="muted small">No fleet owners{search ? ' match your search' : ' yet'}.</p>}
          {filtered.map((o) => (
            <div
              key={o._id || o.id}
              className="card"
              style={{
                padding: 8,
                cursor: 'pointer',
                borderColor: selected && (selected._id || selected.id) === (o._id || o.id) ? 'var(--primary, var(--line))' : undefined,
              }}
            >
              <div onClick={() => select(o)}>
                <b>{o.name}</b>
                <div className="small muted">{o.email || '—'} · {o.phone || '—'}</div>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className={`badge ${STATUS_CLS[o.fleetStatus] || 'badge-gray'}`}>{o.fleetStatus || 'pending'}</span>
                <button className="btn btn-ghost small" disabled={busyId === (o._id || o.id)} onClick={() => setStatus(o, 'approved')}>Approve</button>
                <button className="btn btn-ghost small" disabled={busyId === (o._id || o.id)} onClick={() => setStatus(o, 'pending')}>Pending</button>
                <button className="btn btn-danger small" disabled={busyId === (o._id || o.id)} onClick={() => setStatus(o, 'blocked')}>Block</button>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>{selected ? selected.name : 'Select owner'}</h3>
          {!selected && <p className="muted small">Choose a fleet owner to view their vehicles and drivers.</p>}
          {selected && (
            <div>
              <h4>Vehicles</h4>
              {detailLoading && <p className="muted small">Loading…</p>}
              {!detailLoading && vehicles.length === 0 && <p className="muted small">No vehicles.</p>}
              {vehicles.map((v) => (
                <div key={v._id || v.id} className="card" style={{ padding: 8, marginBottom: 6 }}>
                  <b>{v.vehicleNumber}</b>
                  <div className="small muted">{v.vehicleType} · {v.status}</div>
                </div>
              ))}
              <h4 style={{ marginTop: 12 }}>Drivers</h4>
              {!detailLoading && drivers.length === 0 && <p className="muted small">No drivers in this fleet.</p>}
              {drivers.map((d) => (
                <div key={d._id || d.id} className="card" style={{ padding: 8, marginBottom: 6 }}>
                  <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <b>{d.name}</b>
                    <span className={`badge ${d.driverStatus === 'approved' ? 'badge-green' : d.driverStatus === 'pending' ? 'badge-amber' : 'badge-red'}`}>
                      {d.driverStatus || 'pending'}
                    </span>
                  </div>
                  <div className="small muted" style={{ marginTop: 2 }}>
                    {d.phone || '—'} ·                     {d.assignedVehicleId ? `Vehicle ${d.vehicleNumber || 'assigned'}` : 'Unassigned'}
                    {d.isOnline ? ' · online' : ''}
                    {d.suspended ? ' · suspended' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
