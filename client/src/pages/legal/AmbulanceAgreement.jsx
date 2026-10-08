import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import client from '../../api/client.js';
import logo from '../../assets/super-toto-logo.png';

const VERSION = '1.0';

const SECTIONS = [
  { title: '1. Parties & Scope', body: 'This Ambulance Aggregator Agreement ("Agreement") is between you (the Ambulance Operator, enrolled on the Super Toto Local platform) and TSA Enterprises India ("Aggregator", GSTIN published under Disclosures), operating as an App-Based Aggregator of Basic Life Support (BLS) and Advanced Life Support (ALS) ambulance services in the operating State(s). It governs your use of the ambulance platform, dispatch, care standards, and payouts.' },
  { title: '2. Statute & Applicability', body: 'This Agreement gives effect to the MoHFW National Ambulance Code, the Motor Vehicle Aggregator Guidelines issued by the Ministry of Road Transport & Highways (MoRTH / GoI), the applicable State ambulance policy and transport permits, the Motor Vehicles Act and Rules, GST law, and the DPDP Act, 2023. In case of conflict with the National Ambulance Code or the Aggregator Guidelines, those instruments govern.' },
  { title: '3. Operator Obligations & Onboarding', body: 'You must hold a valid driving licence for the vehicle class, operate a dedicated, registered ambulance with valid insurance, fitness, road tax and PUC, upload identity documents (Aadhaar), and submit to police verification (Police Clearance Certificate). For each State in which you seek dispatch, you must hold an active, admin-verified ambulance compliance record covering your State transport permit and crew (EMT) certification at the declared service level (BLS/ALS). You must maintain your vehicle, medical equipment, and documents current at all times; expiry leads to automatic suspension of the affected record.' },
  { title: '4. Non-Exclusivity', body: 'You are an independent ambulance operator, not an employee or agent of the Aggregator. You may operate with other platforms simultaneously. The Aggregator does not control your hours; you may go online or offline and register or deregister ambulances at your discretion, subject to active compliance.' },
  { title: '5. Fares, Commissions & Payouts', body: 'Each ambulance trip is billed to the rider on a whole-trip basis with an agreed fare computed per the published pricing for the State and service level (including applicable GST). The Aggregator deducts a disclosed platform commission and applicable taxes, and the balance (Operator Earnings) is credited to your registered bank account per the settlement schedule in your Earnings dashboard. Estimates remain estimates; the final fare follows the completed trip.' },
  { title: '6. Compliance with Fare & Surge Rules', body: 'The Aggregator enforces a maximum surge multiplier cap (as published) to comply with State fare caps and the National Ambulance Code. Surge pricing is never applied to emergency trips — the published emergency fare applies. You accept that the platform may not charge riders above the applicable cap and that your earnings reflect the capped fare.' },
  { title: '7. Patient Consent, Safety & Data', body: 'Patient consent is recorded in the App where required and must be honoured. You must complete the platform patient-care, safety, and road-etiquette training modules, comply with the National Ambulance Code equipment and conduct standards, and preserve patient dignity and clinical confidentiality. Live location is shared with the rider and the patient\u2019s trusted contacts during trips for safety. Personal and trip data is processed under the Privacy Policy; operators may view privacy consent status in Profile.' },
  { title: '8. Insurance', body: 'The Aggregator maintains aggregate passenger insurance coverage for ambulance trips booked through the platform (policy number published under Disclosures), as required by the National Ambulance Code. Your own third-party and comprehensive vehicle insurance must remain valid; the expiry is tracked and reported to you.' },
  { title: '9. Termination', body: 'Either party may terminate this Agreement with effect on not less than 7 days\u2019 written notice, without prejudice to amounts due. The Aggregator may suspend an ambulance immediately for proven violations of safety, patient care, or mandatory statutory documents (including compliance expiry), subject to the in-app warning and appeal process. All outstanding financial matters are settled before suspension or termination takes effect.' },
  { title: '10. Dispute Redressal', body: 'Disputes concerning this Agreement shall first be referred to the Aggregator\u2019s Grievance Officer (published under Disclosures) and resolved within 30 days. Unresolved disputes are subject to binding arbitration under the Arbitration and Conciliation Act, 1996, and the courts of competent jurisdiction in the operating State under the laws of India.' },
];

export default function AmbulanceAgreement() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const alreadySigned = !!user?.ambulanceAgreementAcceptedAt;

  const sign = async () => {
    setBusy(true);
    setErr('');
    try {
      const { data } = await client.post('/auth/accept-ambulance-agreement', { version: VERSION });
      setUser((u) => ({ ...u, ...data.user }));
      setDone(true);
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not sign the agreement. Is the server running?');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card fade-in" style={{ maxWidth: 720 }}>
        <div className="auth-title">
          <img src={logo} alt="" className="auth-logo" /> Ambulance Aggregator Agreement
        </div>
        <div className="small muted" style={{ marginBottom: 12 }}>Version {VERSION} · issued under the National Ambulance Code (MoHFW) &amp; the Motor Vehicle Aggregator Guidelines (MoRTH, GoI)</div>

        {alreadySigned && (
          <div className="alert alert-green mb">
            Signed on {new Date(user.ambulanceAgreementAcceptedAt).toLocaleDateString('en-IN')} ✓ Version {user.ambulanceAgreementVersion || VERSION}
          </div>
        )}
        {done && !alreadySigned && <div className="alert alert-green mb">Agreement accepted ✓</div>}
        {err && <div className="err-box">{err}</div>}

        {SECTIONS.map((s, i) => (
          <section key={i} style={{ marginBottom: 12 }}>
            <b>{s.title}</b>
            <p style={{ margin: '2px 0', fontSize: 13, lineHeight: 1.6 }}>{s.body}</p>
          </section>
        ))}

        <div className="mt" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alreadySigned ? (
            <Link to="/driver/ambulance" className="btn btn-primary btn-block">
              Return to Ambulance
            </Link>
          ) : (
            <button className="btn btn-primary btn-block btn-lg" onClick={sign} disabled={busy}>
              {busy ? 'Signing…' : 'Sign this agreement'}
            </button>
          )}
          <Link to="/driver/ambulance" className="btn btn-ghost btn-block">Later</Link>
        </div>
      </div>
    </div>
  );
}