import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import client from '../api/client.js';

const VEHICLE_OPTIONS = [
  { id: 'toto', label: 'Toto (E-Rickshaw)', fuelDefault: 'Electric' },
  { id: 'auto', label: 'Auto Rickshaw', fuelDefault: 'Petrol' },
  { id: 'taxi', label: 'Taxi', fuelDefault: 'Petrol' },
  { id: 'bike', label: 'Bike Taxi', fuelDefault: 'Petrol' },
];
const BRANDS_BY_TYPE = {
  toto: ['Mahindra', 'Kinetic', 'Lohia', 'Hero', 'Euler', 'Terra', 'Atul', 'Other'],
  auto: ['Bajaj', 'Piaggio', 'TVS', 'Atul', 'Mahindra', 'Other'],
  taxi: ['Maruti', 'Hyundai', 'Tata', 'Mahindra', 'Toyota', 'Honda', 'Kia', 'Other'],
  bike: ['Hero MotoCorp', 'Bajaj', 'TVS', 'Honda', 'Suzuki', 'Yamaha', 'Royal Enfield', 'KTM', 'Other'],
};
const COLORS = ['White', 'Black', 'Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Silver', 'Grey', 'Other'];
const FUEL_TYPES_BY_TYPE = {
  toto: ['Electric', 'Lead-Acid', 'Lithium'],
  auto: ['Petrol', 'CNG', 'Electric', 'Diesel'],
  taxi: ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'],
  bike: ['Petrol', 'Electric'],
};
const CURRENT_YEAR = new Date().getFullYear();

const VTYPE_LABEL = Object.fromEntries(VEHICLE_OPTIONS.map(v => [v.id, v.label]));
const VTYPE_ID = Object.fromEntries(VEHICLE_OPTIONS.map(v => [v.label, v.id]));

export default function VehicleDetails() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    vehicleNumber: '',
    vehicleType: 'Toto (E-Rickshaw)',
    brand: '',
    model: '',
    year: CURRENT_YEAR,
    color: '',
    seats: 4,
    luggageCapacityKg: 10,
    hasStep: true,
    hasCanopy: true,
    hasStorage: false,
    fuelType: 'Electric',
    insuranceUpto: '',
    permitUpto: '',
    engineCc: 0,
    hasPillionSeat: true,
    helmetCount: 2,
    hasTopBox: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const typeId = VTYPE_ID[form.vehicleType] || 'toto';
  const isBike = typeId === 'bike';
  const isToto = typeId === 'toto';
  const isAuto = typeId === 'auto';

  const load = useCallback(async () => {
    try {
      const { data } = await client.get('/driver/vehicle');
      if (data.vehicleDetails) {
        setForm((prev) => ({
          ...prev,
          ...data.vehicleDetails,
          vehicleNumber: data.vehicleNumber || prev.vehicleNumber,
          vehicleType: data.vehicleType ? (VTYPE_LABEL[data.vehicleType] || data.vehicleType) : prev.vehicleType,
        }));
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const onTypeChange = (newLabel) => {
    const newId = VTYPE_ID[newLabel] || 'toto';
    const oldId = typeId;
    setForm((prev) => {
      const next = { ...prev, vehicleType: newLabel };
      if (newId !== oldId) {
        next.fuelType = FUEL_TYPES_BY_TYPE[newId]?.[0] || 'Petrol';
        next.brand = '';
        if (newId === 'bike') {
          next.seats = 2;
          next.luggageCapacityKg = 5;
          next.hasStep = false;
          next.hasCanopy = false;
          next.hasStorage = false;
          next.helmetCount = 2;
          next.hasPillionSeat = true;
          next.hasTopBox = false;
          next.engineCc = 150;
        } else if (newId === 'toto') {
          next.seats = 4;
          next.luggageCapacityKg = 10;
          next.hasStep = true;
          next.hasCanopy = true;
          next.hasStorage = false;
        } else if (newId === 'auto') {
          next.seats = 3;
          next.luggageCapacityKg = 8;
          next.hasStep = true;
          next.hasCanopy = true;
          next.hasStorage = false;
        } else {
          next.seats = 4;
          next.luggageCapacityKg = 15;
          next.hasStep = false;
          next.hasCanopy = false;
          next.hasStorage = true;
        }
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true); setMsg(''); setErr('');
    try {
      await client.put('/driver/vehicle', form);
      setMsg('Vehicle details saved successfully');
    } catch (e) {
      setErr(e.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="page-loader">Loading…</div>;

  const seatMin = isBike ? 1 : 2;
  const seatMax = isBike ? 2 : 8;
  const luggageMax = isBike ? 15 : 50;
  const brands = BRANDS_BY_TYPE[typeId] || BRANDS_BY_TYPE.toto;
  const fuels = FUEL_TYPES_BY_TYPE[typeId] || FUEL_TYPES_BY_TYPE.toto;

  return (
    <>
      <Nav />
      <div className="page">
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{ marginTop: 0 }}>{isBike ? '🏍' : isToto ? '🛺' : isAuto ? '🛺' : '🚗'} Vehicle Details</h2>
          <p className="small muted mb">
            Fill in your vehicle information. This helps riders know what to expect before they book.
          </p>

          {msg && <div className="alert alert-green mb">{msg}</div>}
          {err && <div className="err-box mb">{err}</div>}

          <div className="card">
            <h3 style={{ margin: '0 0 12px' }}>Registration</h3>

            <div className="field">
              <label>Vehicle Number *</label>
              <input className="input" placeholder="e.g. BR01AB1234" value={form.vehicleNumber} onChange={(e) => set('vehicleNumber', e.target.value.toUpperCase())} />
            </div>

            <div className="field">
              <label>Vehicle Type</label>
              <select className="input" value={form.vehicleType} onChange={(e) => onTypeChange(e.target.value)}>
                {VEHICLE_OPTIONS.map((v) => <option key={v.id} value={v.label}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 12px' }}>Vehicle Information</h3>

            <div className="field">
              <label>Brand / Manufacturer *</label>
              <select className="input" value={form.brand} onChange={(e) => set('brand', e.target.value)}>
                <option value="">Select brand…</option>
                {brands.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Model Name *</label>
              <input
                className="input"
                placeholder={isBike ? 'e.g. Splendor+, Pulsar, Activa' : isToto ? 'e.g. Treo, Zor' : 'e.g. PIAGGIO Ape'}
                value={form.model}
                onChange={(e) => set('model', e.target.value)}
              />
            </div>

            <div className="grid-2">
              <div className="field">
                <label>Registration Year *</label>
                <select className="input" value={form.year} onChange={(e) => set('year', Number(e.target.value))}>
                  {Array.from({ length: 20 }, (_, i) => CURRENT_YEAR - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Color</label>
                <select className="input" value={form.color} onChange={(e) => set('color', e.target.value)}>
                  <option value="">Select…</option>
                  {COLORS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="field">
                <label>Fuel Type</label>
                <select className="input" value={form.fuelType} onChange={(e) => set('fuelType', e.target.value)}>
                  {fuels.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
              {isBike && (
                <div className="field">
                  <label>Engine (cc)</label>
                  <input className="input" type="number" min={50} max={500} value={form.engineCc} onChange={(e) => set('engineCc', Number(e.target.value))} placeholder="e.g. 150" />
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 12px' }}>Capacity & Features</h3>

            <div className="grid-2">
              <div className="field">
                <label>Number of Seats (incl. driver)</label>
                <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                  <button type="button" className="btn btn-ghost small" onClick={() => set('seats', Math.max(seatMin, form.seats - 1))}>−</button>
                  <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{form.seats}</span>
                  <button type="button" className="btn btn-ghost small" onClick={() => set('seats', Math.min(seatMax, form.seats + 1))}>+</button>
                </div>
              </div>
              <div className="field">
                <label>Luggage Capacity (kg)</label>
                <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                  <button type="button" className="btn btn-ghost small" onClick={() => set('luggageCapacityKg', Math.max(0, form.luggageCapacityKg - (isBike ? 1 : 2)))}>−</button>
                  <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{form.luggageCapacityKg}</span>
                  <button type="button" className="btn btn-ghost small" onClick={() => set('luggageCapacityKg', Math.min(luggageMax, form.luggageCapacityKg + (isBike ? 1 : 2)))}>+</button>
                  <span className="small muted">kg</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 13 }}>Features</label>
              {isBike ? (
                <>
                  <label className="row" style={{ gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.hasPillionSeat} onChange={(e) => set('hasPillionSeat', e.target.checked)} />
                    <span className="small">Pillion seat (extra rider seat)</span>
                  </label>
                  <label className="row" style={{ gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.hasTopBox} onChange={(e) => set('hasTopBox', e.target.checked)} />
                    <span className="small">Top box (rear luggage box)</span>
                  </label>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Number of Helmets Available</label>
                    <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                      <button type="button" className="btn btn-ghost small" onClick={() => set('helmetCount', Math.max(0, Math.min(3, form.helmetCount - 1)))}>−</button>
                      <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{form.helmetCount}</span>
                      <button type="button" className="btn btn-ghost small" onClick={() => set('helmetCount', Math.max(0, Math.min(3, form.helmetCount + 1)))}>+</button>
                      <span className="small muted">helmets</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <label className="row" style={{ gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.hasStep} onChange={(e) => set('hasStep', e.target.checked)} />
                    <span className="small">Step / Footrest (easy entry & exit)</span>
                  </label>
                  <label className="row" style={{ gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.hasCanopy} onChange={(e) => set('hasCanopy', e.target.checked)} />
                    <span className="small">Rain Canopy / Roof cover</span>
                  </label>
                  <label className="row" style={{ gap: 8, marginBottom: 0, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.hasStorage} onChange={(e) => set('hasStorage', e.target.checked)} />
                    <span className="small">Under-seat storage space</span>
                  </label>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 12px' }}>Validity</h3>
            <div className="field">
              <label>Insurance Valid Until</label>
              <input className="input" type="date" value={form.insuranceUpto} onChange={(e) => set('insuranceUpto', e.target.value)} />
            </div>
            <div className="field">
              <label>Permit Valid Until</label>
              <input className="input" type="date" value={form.permitUpto} onChange={(e) => set('permitUpto', e.target.value)} />
            </div>
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" disabled={saving || !form.vehicleNumber || !form.brand || !form.model} onClick={save}>
              {saving ? 'Saving…' : 'Save Vehicle Details'}
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/driver')}>
              ← Back
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
