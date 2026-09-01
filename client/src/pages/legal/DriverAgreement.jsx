import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import client from '../../api/client.js';
import logo from '../../assets/super-toto-logo.png';

const VERSION = '1.0';

const SECTIONS = [
  { title: '1. Parties & Scope', body: 'This Motor Vehicle Aggregator Agreement ("Agreement") is between you (the Driver, enrolled on the Super Toto Local platform) and TSA Enterprises India ("Aggregator", GSTIN published under Disclosures), operating as an App-Based Aggregator of e-rickshaw (toto), auto and cab services in the operating State. It governs your use of the platform, dispatch, and payouts.' },
  { title: '2. Statute & Applicability', body: 'This Agreement gives effect to the Motor Vehicle Aggregator Guidelines issued by the Ministry of Road Transport & Highways (MoRTH / GoI), the applicable State policy, the Motor Vehicles Act and Rules, GST law, and the DPDP Act, 2023. In case of conflict with the Aggregator Guidelines, the Guidelines govern.' },
  { title: '3. Driver Obligations & Onboarding', body: 'You must hold a valid driving licence for the motor class, own or legitimately operate a registered, insured vehicle with a valid PUC, upload identity documents (Aadhaar), and submit to police verification (Police Clearance Certificate). You must maintain a professional standard, comply with traffic rules, and keep your documents and vehicle insurance current at all times.' },
  { title: '4. Non-Exclusivity', body: 'You are an independent driver-partner, not an employee of the Aggregator. You may use other platforms simultaneously. The Aggregator does not control your working hours; you may go online or offline at your discretion.' },
  { title: '5. Commissions & Payouts', body: 'Each trip is billed to the rider with an agreed fare computed per the published pricing (including applicable GST). The Aggregator deducts a disclosed platform commission and the applicable taxes, and the balance (Driver Earnings) is credited to your registered bank account as per the settlement schedule shown in your Earnings dashboard. Estimates remain estimates; the final fare follows the completed trip.' },
  { title: '6. Compliance with Fare & Surge Rules', body: 'The Aggregator enforces a maximum surge multiplier cap (as published) to comply with State fare caps. You accept that the platform may not charge riders above the applicable cap and that your earnings reflect the capped fare.' },
  { title: '7. Safety & Data', body: 'You must complete the platform safety and road-etiquette training modules. Live location is shared with the rider and trusted contacts during trips for safety. Personal data is processed under the Privacy Policy; drivers may access privacy consent status in Profile.' },
  { title: '8. Insurance', body: 'The Aggregator maintains passenger insurance coverage for trips booked through the platform (policy number published under Disclosures). Your own third-party and comprehensive vehicle insurance must remain valid; the expiry is tracked and reported to you. An aggregate insurance cover is maintained as required by the Aggregator Guidelines.' },
  { title: '9. Termination', body: 'Either party may terminate this Agreement with effect on not less than 7 days\' written notice, without prejudice to amounts due. The Aggregator may suspend a driver immediately for proven violations of safety, conduct, or mandatory statutory documents, subject to the in-app warning and appeal process.' },
  { title: '10. Dispute Redressal', body: 'Disputes concerning this Agreement shall first be referred to the Aggregator\'s Grievance Officer (published under Disclosures) and resolved within 30 days. Unresolved disputes are subject to courts of competent jurisdiction in the operating State under the laws of India.' },
];

export default function DriverAgreement() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const alreadySigned = !!user?.aggregatorAgreementAcceptedAt;
  const isDriver = user?.role === 'driver';

  const sign = async () => {
    setBusy(true);
    setErr('');
    try {
      const { data } = await client.post('/auth/accept-agreement', { version: VERSION });
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
          <img src={logo} alt="" className="auth-logo" /> Motor Vehicle Aggregator Agreement
        </div>
        <div className="small muted" style={{ marginBottom: 12 }}>Version {VERSION} · issued under the Motor Vehicle Aggregator Guidelines (MoRTH, GoI)</div>

        {alreadySigned && (
          <div className="alert alert-green mb">
            Signed on {new Date(user.aggregatorAgreementAcceptedAt).toLocaleDateString('en-IN')} ✓ Version {user.aggregatorAgreementVersion || VERSION}
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
            <Link to={isDriver ? '/driver' : '/profile'} className="btn btn-primary btn-block">
              Return to {isDriver ? 'Driver' : 'Profile'}
            </Link>
          ) : (
            <button className="btn btn-primary btn-block btn-lg" onClick={sign} disabled={busy}>
              {busy ? 'Signing…' : 'Sign this agreement'}
            </button>
          )}
          <Link to={isDriver ? '/driver' : '/ride'} className="btn btn-ghost btn-block">Later</Link>
        </div>
      </div>
    </div>
  );
}