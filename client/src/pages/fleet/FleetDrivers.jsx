import { useEffect, useState } from 'react';
import client from '../../api/client.js';

export default function FleetDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    client.get('/fleet/drivers').then(d=>setDrivers(d.data.drivers||[])).catch(()=>{});
    client.get('/fleet/vehicles').then(d=>setVehicles(d.data.vehicles||[])).catch(()=>{});
  };
  useEffect(load, []);

  const assign = async (driverId, vehicleId) => {
    try {
      await client.post('/fleet/assign', { driverId, vehicleId });
      setMsg('Assigned');
      load();
    } catch (e) { setErr(e.response?.data?.message||'Failed'); }
  };

  const unassign = async (driverId, vehicleId) => {
    try {
      await client.post('/fleet/unassign', { driverId, vehicleId });
      setMsg('Unassigned');
      load();
    } catch (e) { setErr(e.response?.data?.message||'Failed'); }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Fleet Drivers</h2>
        {err && <div className="err-box">{err}</div>}
        {msg && <div className="alert alert-green">{msg}</div>}
        <div style={{marginTop:12}}>
          {drivers.map(d=>(
            <div key={d._id||d.id} className="card" style={{padding:10,marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <b>{d.name}</b> · {d.phone} · {d.assignedVehicleId ? 'Assigned' : 'Unassigned'}
                </div>
                <div style={{display:'flex',gap:6}}>
                  {!d.assignedVehicleId && (
                    <select className="input" style={{maxWidth:200}} onChange={e=>e.target.value && assign(d._id||d.id, e.target.value)} defaultValue="">
                      <option value="">Assign Vehicle</option>
                      {vehicles.filter(v=>v.status!=='assigned').map(v=>(
                        <option key={v._id||v.id} value={v._id||v.id}>{v.vehicleNumber}</option>
                      ))}
                    </select>
                  )}
                  {d.assignedVehicleId && (
                    <button className="btn btn-ghost" onClick={()=>unassign(d._id||d.id, d.assignedVehicleId)}>Unassign</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
