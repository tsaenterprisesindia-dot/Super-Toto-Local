import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client.js';
import logo from '../../assets/super-toto-logo.png';

const VERSION = '1.0';

const SECTIONS = [
  { title: '1. Who we are', body: 'Super Toto Local is operated by TSA Enterprises (GSTIN as published under Disclosures), an App-Based Aggregator connecting riders with local e-rickshaw (toto), auto and cab drivers. We are the data fiduciary in respect of your personal data collected through the Service.' },
  { title: '2. Data we collect', body: 'Account details (name, email, phone); identity data (Aadhaar number — processed for verification only, never stored in plaintext logs; password stored as an irreversible hash); OTP-authenticated mobile; trip data (pickup/drop, route, timestamps, fare); live location during an active ride; optional Face ID descriptor used solely for app sign-in; device & usage analytics.' },
  { title: '3. Purpose of processing', body: 'Enabling bookings, dispatch and navigation; issuing GST invoices; identity verification for safety (Aadhaar) and driver onboarding (documents, police verification); safety features such as SOS, live tracking and helpline; grievance redressal; compliance with the motor vehicle aggregator Guidelines, GST law, and lawful Government data-sharing requests.' },
  { title: '4. Legal basis', body: 'We process personal data for the performance of the Service contract, for compliance with legal obligations (GST, aggregator guidelines, police verification) and based on your consent (DPDP Act, 2023 / IT Rules). Consent given at registration can be withdrawn by deleting your account from Profile — withdrawal will not affect processing already performed.' },
  { title: '5. Sensitive personal data', body: 'Your Aadhaar number and (where you enable it) face descriptor are processed with explicit consent for identity verification. Aadhaar numbers are verified by checksum and, when operational, through UIDAI; we never publish or share them except as required by law.' },
  { title: '6. Location & tracking', body: 'Your live location is collected only during an active ride for routing, safety and live-tracking sharing with trusted contacts. You can revoke location permission at any time in your phone settings; outside active rides we collect location only at coarse level for service statistics.' },
  { title: '7. Sharing of data', body: 'We share data: (a) with the driver for whom your trip is assigned (name & phone, and live pickup location during the trip); (b) with payment processors for digital payments; (c) with Government authorities in compliance with the Aggregator Guidelines 2020 and lawful requests (trip data feeds, enforcement, statistical purposes); (d) with service providers under confidentiality. We never sell your personal data.' },
  { title: '8. Government data sharing', body: 'Under Rule on safety & security and the Aggregator Guidelines, mobility/fare/trip data may be shared with State/Union Government authorities for area development, transport planning, safety and regulatory purposes. Authorised officers can make lawful requests; we log each such disclosure internally.' },
  { title: '9. Data retention', body: 'Your account data is retained while your account is active. Trip records are retained for regulatory and statutory compliance (including GST invoicing obligations). After account deletion, identifiable data is deleted or anonymised within a reasonable period except where retention is mandated by law.' },
  { title: '10. Your rights', body: 'You may access, correct, update, or request deletion of your personal data from Profile. You may withdraw consent at any time. To exercise these rights, write to our Grievance Officer at the details published under "Grievance Officer" below. We will respond within 48 business hours as required.' },
  { title: '11. Children', body: 'The Service is not directed at persons under 18 and we do not knowingly collect data of children without a parent/guardian.' },
  { title: '12. Security', body: 'We use encryption in transit (HTTPS), hashed passwords, minimised storage of Aadhaar, and role-based administrator access. No system is fully immune to attack; we will notify you and the authorities in the event of a confirmed breach affecting your data.' },
  { title: '13. Changes to this policy', body: 'We may update this Privacy Policy. Material changes will be notified in the app and, where required, your consent will be re-obtained. Continued use of the Service after a change is effective constitutes acceptance.' },
  { title: '14. Grievance Officer', body: 'Any grievance concerning this policy or your data may be addressed to the Grievance Officer at the details shown below, or through the in-app Complaint/Suggestions panel under Help. Complaints are redressed within one month as per the IT Rules, 2021.' },
  { title: '15. Contact', body: 'TSA Enterprises India\nEmail: support@supertoto.local\nEmail: tsaenterprisesindia@gmail.com\nPhone: +91 9811997286\nWhatsApp: +91 9811997286' },
];

export default function Privacy() {
  const [officer, setOfficer] = useState(null);

  useEffect(() => {
    client.get('/grievance').then(({ data }) => {
      if (data?.grievanceOfficer) setOfficer(data.grievanceOfficer);
    }).catch(() => {});
  }, []);

  const effective = officer?.name || 'Grievance Officer';

  return (
    <div className="auth-page">
      <div className="card auth-card fade-in" style={{ maxWidth: 720 }}>
        <div className="auth-title">
          <img src={logo} alt="" className="auth-logo" /> Privacy Policy
        </div>
        <div className="small muted" style={{ marginBottom: 12 }}>
          Version {VERSION} · {officer?.name ? 'Compliant with the Digital Personal Data Protection Act, 2023' : 'Last updated 2026'}
        </div>

        {SECTIONS.map((s, i) => (
          <section key={i} style={{ marginBottom: 12 }}>
            <b>{s.title}</b>
            {s.body.split('\n').map((line, j) => (
              <p key={j} style={{ margin: '2px 0', fontSize: 13, lineHeight: 1.6 }}>{line}</p>
            ))}
          </section>
        ))}

        <div className="card" style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: 12, marginTop: 4 }}>
          <b>Grievance Officer</b>
          <p className="small" style={{ margin: '4px 0 0' }}>
            {officer ? (
              <>
                {officer.name} — {officer.designation}<br />
                Email: {officer.email} · Phone: {officer.phone}
                {officer.address && <><br />Address: {officer.address}</>}
              </>
            ) : (
              'Appointed under Rule 3(11), Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and the DPDP Act, 2023.'
            )}
          </p>
        </div>

        <div className="small muted mt" style={{ textAlign: 'center' }}>
          Back to <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}