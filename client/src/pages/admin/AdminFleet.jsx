import { useEffect, useState } from 'react';
import client from '../../api/client.js';

export default function AdminFleet() {
  const [overview, setOverview] = useState({ owners: 0, vehicles: 0, drivers: 0 });
  const [owners, setOwners] = useState([]);
  const [selected, setSelected] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    client.get('/admin/fleet-overview').then(d => setOverview(d.data.overview || {})).catch(()=>{});
    client.get('/admin/fleet-owners').then(d => setOwners(d.data.owners || [])).catch(()=>{});
  }, []);

  const select = (owner) => {
    setSelected(owner);
    client.get(`/admin/fleet-owners/${owner._id||owner.id}/vehicles`).then(d=>setVehicles(d.data.vehicles||[])).catch(()=>{});
    client.get(`/admin/fleet-owners/${owner._id||owner.id}/drivers`).then(d=>setDrivers(d.data.drivers||[])).catch(()=>{});
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Fleet Management</h2>
        <div className="row" style={{gap:12}}>
          <div className="card" style={{padding:10}}><b>{overview.owners}</b> Fleet Owners</div>
          <div className="card" style={{padding:10}}><b>{overview.vehicles}</b> Vehicles</div>
          <div className="card" style={{padding:10}}><b>{overview.drivers}</b> Fleet Drivers</div>
        </div>
      </div>
      <div className="grid" style={{gridTemplateColumns:'1fr 2fr',gap:12}}>
        <div className="card">
          <h3>Fleet Owners</h3>
          {owners.map(o=>(
            <div key={o._id||o.id} className="card" style={{padding:8,cursor:'pointer'}} onClick={()=>select(o)}>
              <b>{o.name}</b> · {o.email} · {o.phone}
            </div>
          ))}
        </div>
        <div className="card">
          <h3>{selected ? selected.name : 'Select owner'}</h3>
          {selected && (
            <div>
              <h4>Vehicles</h4>
              {vehicles.map(v=>(
                <div key={v._id||v.id} className="card" style={{padding:8}}>{v.vehicleNumber} · {v.vehicleType} · {v.status}</div>
              ))}
              <h4 style={{marginTop:12}}>Drivers</h4>
              {drivers.map(d=>(
                <div key={d._id||d.id} className="card" style={{padding:8}}>{d.name} · {d.phone} · {d.assignedVehicleId?'Assigned':'Unassigned'}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
