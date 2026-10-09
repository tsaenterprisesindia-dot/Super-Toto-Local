import { useEffect, useState } from 'react';
import client from '../../api/client.js';

export default function FleetVehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({ vehicleType: 'toto', vehicleNumber: '', vehicleDetails: {} });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    client.get('/fleet/vehicles')
      .then(d => setVehicles(d.data.vehicles || []))
      .catch(e => setErr(e.response?.data?.message || 'Failed'));
  };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(''); setMsg('');
    try {
      await client.post('/fleet/vehicles', form);
      setMsg('Vehicle added');
      setForm({ vehicleType: 'toto', vehicleNumber: '', vehicleDetails: {} });
      load();
    } catch (e) { setErr(e.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Fleet Vehicles</h2>
        {err && <div className="err-box">{err}</div>}
        {msg && <div className="alert alert-green">{msg}</div>}
        <form onSubmit={submit} style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>
          <select className="input" value={form.vehicleType} onChange={e=>setForm({...form,vehicleType:e.target.value})}>
            <option value="toto">Toto</option>
            <option value="auto">Auto</option>
            <option value="taxi">Taxi</option>
            <option value="bike">Bike</option>
            <option value="ambulance-bls">Ambulance BLS</option>
            <option value="ambulance-als">Ambulance ALS</option>
          </select>
          <input className="input" placeholder="Vehicle No." value={form.vehicleNumber} onChange={e=>setForm({...form,vehicleNumber:e.target.value.toUpperCase()})} required />
          <button className="btn btn-primary" disabled={busy}>{busy?'Adding...':'Add Vehicle'}</button>
        </form>
        <div style={{marginTop:16}}>
          {vehicles.map(v=>(
            <div key={v._id||v.id} className="card" style={{padding:10,marginBottom:8}}>
              <b>{v.vehicleNumber}</b> · {v.vehicleType} · {v.status}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
