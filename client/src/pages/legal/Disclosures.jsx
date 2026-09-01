import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client.js';
import logo from '../../assets/super-toto-logo.png';

export default function Disclosures() {
  const [d, setD] = useState(null);
  const [g, setG] = useState(null);

  useEffect(() => {
    client.get('/disclosures').then(({ data }) => setD(data)).catch(() => {});
    client.get('/grievance').then(({ data }) => setG(data?.grievanceOfficer)).catch(() => {});
  }, []);

  const row = (label, value, fallback = '—') => (
    <div className="spread" key={label}>
      <span className="muted">{label}</span>
      <b style={{ textAlign: 'right' }}>{value || fallback}</b>
    </div>
  );

  return (
    <div className="auth-page">
      <div className="card auth-card fade-in" style={{ maxWidth: 640 }}>
        <div className="auth-title">
          <img src={logo} alt="" className="auth-logo" /> Mandatory Disclosures
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Published under the Consumer Protection (E-Commerce) Rules, 2020, the Motor Vehicle Aggregator Guidelines (MoRTH) and the IT Rules, 2021.
        </p>

        <h4 style={{ marginBottom: 4 }}>Company &amp; GST</h4>
        {row('Legal entity', d?.legalEntityName)}
        {row('GSTIN', d?.gstin)}
        {row('Operating state', d?.operatingState)}

        <h4 style={{ marginBottom: 4 }}>Fares &amp; cancellations</h4>
        {row('Max surge multiplier (cap)', d?.surgeCap != null ? `×${d.surgeCap}` : null)}
        {row('Cancellation fee', d?.cancellationFee != null ? `₹${d.cancellationFee}` : null)}
        {d?.cancellationPolicy && (
          <div className="small muted" style={{ marginTop: 2 }}>{d.cancellationPolicy}</div>
        )}

        <h4 style={{ marginBottom: 4 }}>Insurance</h4>
        {row('Passenger insurance policy no.', d?.insurancePolicyNo)}
        {d?.passengerInsuranceNote && (
          <div className="small muted" style={{ marginTop: 2 }}>{d.passengerInsuranceNote}</div>
        )}

        <h4 style={{ marginBottom: 4 }}>Grievance Officer</h4>
        <div className="card" style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: 12 }}>
          <b>{g?.name || 'Grievance Officer'}</b>
          <div className="small muted">{(g?.designation || 'Grievance Officer')} · IT Rules 2021</div>
          {g?.email && <div className="small">Email: {g.email}</div>}
          {g?.phone && <div className="small">Phone: {g.phone}</div>}
          {g?.address && <div className="small">Address: {g.address}</div>}
        </div>
        <p className="small muted">Complaints are redressed within one month; grievances concerning personal data within 48 business hours.</p>

        <div className="small muted mt" style={{ textAlign: 'center' }}>
          <Link to="/login">Log in</Link> · <Link to="/legal/privacy">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}