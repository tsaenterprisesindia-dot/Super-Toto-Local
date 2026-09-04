import { useEffect, useState } from 'react';
import client from '../../api/client.js';

const DRIVER_DOC_TYPES = [
  { key: 'aadhaar', label: 'Aadhaar Card' },
  { key: 'rc', label: 'Vehicle RC' },
  { key: 'license', label: 'Driver License' },
  { key: 'bank', label: 'Bank Account Details' },
  { key: 'photo', label: 'Passport Photo' },
  { key: 'insurance', label: 'Insurance Certificate' },
  { key: 'puc', label: 'PUC Certificate' },
  { key: 'pcc', label: 'Police Clearance (PCC)' },
];

export default function AdminCompliance() {
  const [tab, setTab] = useState('compliance');
  const [comp, setComp] = useState({});
  const [train, setTrain] = useState({ modules: [] });
  const [form, setForm] = useState({});
  const [trainForm, setTrainForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [csvBusy, setCsvBusy] = useState(false);

  const load = () => {
    client.get('/admin/compliance').then(({ data }) => {
      setComp(data.compliance || {});
      setForm(data.compliance || {});
    }).catch((e) => setErr(e.response?.data?.message || 'Failed to load compliance'));
    client.get('/admin/training').then(({ data }) => {
      setTrain(data.training || { modules: [] });
      setTrainForm(data.training || { modules: [] });
    }).catch(() => {});
  };

  useEffect(load, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setGo = (k) => (e) => setForm((f) => ({ ...f, grievanceOfficer: { ...(f.grievanceOfficer || {}), [k]: e.target.value } }));
  const setDocReq = (key) => (e) =>
    setForm((f) => ({ ...f, driverDocs: { ...(f.driverDocs || {}), [key]: e.target.checked } }));
  const setMod = (id, k) => (e) =>
    setTrainForm((t) => ({
      ...t,
      modules: (t.modules || []).map((m) => (m.id === id ? { ...m, [k]: e.target.value } : m)),
    }));

  const saveComp = async () => {
    setSaving(true); setMsg(''); setErr('');
    try {
      const { data } = await client.put('/admin/compliance', form);
      setComp(data.compliance);
      setMsg('Compliance settings saved ✓');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to save compliance');
    } finally {
      setSaving(false);
    }
  };

  const saveTrain = async () => {
    setSaving(true); setMsg(''); setErr('');
    try {
      const { data } = await client.put('/admin/training', trainForm);
      setTrain(data.training);
      setTrainForm(data.training);
      setMsg('Training modules saved ✓');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to save training');
    } finally {
      setSaving(false);
    }
  };

  const exportTrips = async () => {
    setCsvBusy(true); setErr(''); setMsg('');
    try {
      const res = await client.get('/admin/export/trips', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `supertoto_trips_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg('Govt. trips CSV downloaded ✓');
    } catch (e) {
      setErr('Could not export trips');
    } finally {
      setCsvBusy(false);
    }
  };

  const field = (label, val, onChange, opts = {}) => (
    <div className="field" key={label}>
      <label>{label}</label>
      {opts.area ? (
        <textarea className="input" value={val} onChange={onChange} rows={opts.rows || 3} />
      ) : opts.select ? (
        <select className="input" value={val} onChange={onChange}>{opts.options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
      ) : (
        <input className="input" value={val} onChange={onChange} type={opts.type || 'text'} placeholder={opts.placeholder} />
      )}
    </div>
  );

  return (
    <div className="page">
      <div className="spread">
        <h2>🗂️ Compliance & Governance</h2>
        <button className="btn btn-ghost" onClick={exportTrips} disabled={csvBusy}>
          {csvBusy ? 'Exporting…' : '⬇️ Govt. trips CSV'}
        </button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Mandatory disclosures & policies under the Motor Vehicle Aggregator Guidelines, DPDP Act 2023, GST law and IT Rules 2021.
      </p>

      {err && <div className="err-box">{err}</div>}
      {msg && <div className="alert alert-green">{msg}</div>}

      <div className="tab-row">
        <button className={`tab${tab === 'compliance' ? ' active' : ''}`} onClick={() => { setTab('compliance'); setMsg(''); setErr(''); }}>Company & fares</button>
        <button className={`tab${tab === 'training' ? ' active' : ''}`} onClick={() => { setTab('training'); setMsg(''); setErr(''); }}>Driver training</button>
      </div>

      {tab === 'compliance' && (
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Company & mandatory disclosures</h4>
          {field('Legal entity name', form.legalEntityName || '', set('legalEntityName'))}
          {field('GSTIN (for invoices)', form.gstin || '', set('gstin'), { placeholder: '07AAAAA0000A1Z5' })}
          {field('Registered address', form.legalAddress || '', set('legalAddress'), { area: true, rows: 2, placeholder: 'Registered office / billing address' })}
          {field('Operating state', form.operatingState || '', set('operatingState'), { placeholder: 'e.g. Sikkim' })}
          <div className="spread">
            {field('Max surge multiplier (cap)', Number(form.surgeCap) || 1, set('surgeCap'), { type: 'number', placeholder: '1.5' })}
            {field('Cancellation fee (₹)', Number(form.cancellationFee) || 0, set('cancellationFee'), { type: 'number', placeholder: '20' })}
          </div>
          <div className="field">
            <label>Aadhaar verification mode</label>
            <select className="input" value={form.aadhaarUidaiMode ? 'uidai' : 'checksum'} onChange={(e) => setForm((f) => ({ ...f, aadhaarUidaiMode: e.target.value === 'uidai' }))}>
              <option value="checksum">Checksum validation (demo)</option>
              <option value="uidai">UIDAI offline KYC</option>
            </select>
          </div>

          <h4 style={{ marginBottom: 4 }}>Cancellation policy</h4>
          {field('Policy text', form.cancellationPolicy || '', set('cancellationPolicy'), { area: true, rows: 4 })}

          <h4 style={{ marginBottom: 4 }}>Insurance</h4>
          {field('Passenger insurance policy no.', form.insurancePolicyNo || '', set('insurancePolicyNo'))}
          {field('Insurance note (shown in-app)', form.passengerInsuranceNote || '', set('passengerInsuranceNote'), { area: true, rows: 2 })}

          <h4 style={{ marginBottom: 4 }}>Grievance Officer (IT Rules 2021)</h4>
          <div className="spread">
            {field('Name', form.grievanceOfficer?.name || '', setGo('name'))}
            {field('Designation', form.grievanceOfficer?.designation || '', setGo('designation'))}
          </div>
          <div className="spread">
            {field('Email', form.grievanceOfficer?.email || '', setGo('email'))}
            {field('Phone', form.grievanceOfficer?.phone || '', setGo('phone'))}
          </div>
          {field('Address', form.grievanceOfficer?.address || '', setGo('address'))}

          <h4 style={{ marginBottom: 4, marginTop: 18 }}>Driver onboarding documents</h4>
          <p className="small muted" style={{ marginTop: 0 }}>
            Choose which documents a driver must upload and get approved before they can go online. Unchecked = optional.
            Applies to every driver; already-approved drivers are unaffected until they re-verify.
          </p>
          <div className="grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {DRIVER_DOC_TYPES.map((d) => (
              <label key={d.key} className="checkbox-row" style={{ justifyContent: 'space-between', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }}>
                <span className="small">{d.label}</span>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span className="small muted">{form.driverDocs?.[d.key] ? 'Required' : 'Optional'}</span>
                  <input type="checkbox" checked={!!form.driverDocs?.[d.key]} onChange={setDocReq(d.key)} />
                </div>
              </label>
            ))}
          </div>

          <button className="btn btn-primary mt" onClick={saveComp} disabled={saving}>
            {saving ? 'Saving…' : 'Save compliance settings'}
          </button>
        </div>
      )}

      {tab === 'training' && (
        <div className="card">
          <div className="spread">
            <h4 style={{ marginTop: 0 }}>Driver safety & service training</h4>
            <label className="checkbox-row" style={{ justifyContent: 'flex-start', gap: 8 }}>
              <input type="checkbox" checked={trainForm.enabled} onChange={(e) => setTrainForm((t) => ({ ...t, enabled: e.target.checked }))} />
              <span className="small">Require before going online</span>
            </label>
          </div>
          <div className="field">
            <label>Acknowledgement text</label>
            <textarea className="input" rows={2} value={trainForm.certificateText || ''} onChange={(e) => setTrainForm((t) => ({ ...t, certificateText: e.target.value }))} />
          </div>
          {(trainForm.modules || []).map((m) => (
            <div key={m.id} className="card" style={{ background: 'var(--bg)', padding: 10, marginBottom: 8 }}>
              <div className="spread">
                <b>{m.icon} {m.title}</b>
              </div>
              <div className="field" style={{ marginTop: 6 }}>
                <input className="input" value={m.title} onChange={setMod(m.id, 'title')} placeholder="Module title" />
              </div>
              <textarea className="input" rows={2} value={m.text} onChange={setMod(m.id, 'text')} placeholder="Training content shown to drivers" />
            </div>
          ))}
          <button className="btn btn-primary mt" onClick={saveTrain} disabled={saving}>
            {saving ? 'Saving…' : 'Save training modules'}
          </button>
        </div>
      )}
    </div>
  );
}