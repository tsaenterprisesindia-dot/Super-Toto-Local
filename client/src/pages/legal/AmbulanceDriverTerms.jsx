import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import client from '../../api/client.js';
import logo from '../../assets/super-toto-logo.png';

const TERMS_VERSION = '1.0';

const sections = [
  {
    title: '1. Introduction',
    body: `Welcome to the Super Toto Local Ambulance Service ("the Service"), an app-based aggregator of Basic Life Support (BLS) and Advanced Life Support (ALS) ambulance operations. These Ambulance Terms & Conditions ("Terms") govern your use of the Service as an ambulance operator/ driver partner. By staying active on the ambulance module or registering any ambulance, you agree to be bound by these Terms.

The Service is operated by TSA Enterprises India ("we", "us", or "our") in accordance with the MoHFW National Ambulance Code, the Motor Vehicle Aggregator Guidelines (MoRTH, GoI), applicable State ambulance policies and transport permits, the Motor Vehicles Act and Rules, and the DPDP Act, 2023. We reserve the right to modify these Terms at any time. Material changes will be notified through the App, and continued use after notification constitutes acceptance.`,
  },
  {
    title: '2. Ambulance Operator Eligibility & Onboarding',
    body: `To register an ambulance on the Service you must:

• Be at least 18 years of age and hold a valid Indian driving licence for the applicable vehicle class.
• Operate a dedicated ambulance (BLS or ALS) with a valid registration certificate (RC) in your name or a legitimate authorisation to operate the vehicle.
• Hold a valid State transport permit and route/paratransit authorisation for the operating State.
• Submit to identity verification (Aadhaar) and police verification (Police Clearance Certificate).
• Certify your medical equipment fit-out against the National Ambulance Code (see Section 3) and, for ALS, the required advanced equipment and crew certification.
• For each enabled State in which you operate, register a compliance record with the required documents (permit, fitness, insurance, road tax, PUC, driving licence, and EMT/crew certification). Each record is verified by our administrators before dispatch eligibility is granted.

We reserve the right to reject any registration without stating reasons and to suspend eligibility at any time if criteria cease to be met. You must keep all documents valid and up to date; expired documents result in automatic suspension of the affected compliance record (and thus dispatch eligibility for that State) until valid renewals are uploaded.`,
  },
  {
    title: '3. Vehicle & Equipment Standards (National Ambulance Code)',
    body: `Every ambulance registered on the Service must comply with the National Ambulance Code and be maintained to the following minimum standards:

• Dedicated ambulance body with appropriate markings, emergency lights and siren, and the Red Cross insignia as applicable.
• Medical equipment per service level — BLS: stretcher/cot, oxygen cylinder with regulator, suction unit, splints, and first-aid kit; ALS: additionally, cardiac monitor/defibrillator (AED) and the ALS equipment set as listed in your compliance record.
• Valid registration, third-party/comprehensive insurance, fitness certificate, road tax and PUC as declared in your compliance record.
• Working headlights, indicators, brakes, mirrors, seatbelts for crew, and safe patient restraint.
• A clean, sanitised patient compartment before each shift, especially for emergency and hospital-transfer trips.

We may require photographic evidence of vehicle and equipment condition or conduct random inspections. Failure to maintain standards may result in suspension of compliance records and removal from dispatch.`,
  },
  {
    title: '4. Operator Conduct & Patient Care',
    body: `As an ambulance operator on the Service you agree to:

• Provide safe, professional, and compassionate care to every patient and attendant.
• Respond to emergency calls promptly and follow traffic laws; use the siren/emergency light only when warranted.
• Never refuse a trip on the basis of destination, distance, patient condition, or payment method where the trip is within the operating State.
• Not discriminate against any patient on the basis of race, religion, gender, age, disability, medical condition, sexual orientation, national origin, or any other protected characteristic.
• Not solicit patients, payments, or personal information outside the Platform.
• Not transport more than the rated capacity; carry the patient and a maximum of one attendant, subject to the vehicle rating.
• Not tamper with ride-tracking, fare calculation, consent, or safety features of the App.
• Not consume alcohol, drugs, or any impairing substance while on duty.

Violations may result in warnings, suspension of compliance records, or permanent termination of your registration.`,
  },
  {
    title: '5. Patient Consent & Transport',
    body: `Consent: For patients who are conscious and able, the patient (or the booking rider acting on their behalf) must provide consent for the ambulance trip and service level requested. The App records this consent when required.

Emergency trips: In genuine emergencies we dispatch the nearest eligible ambulance. Surge pricing is never applied to emergency trips; the emergency fare is published in the App.

Trip transportation: You must transport the patient to the destination requested by the rider/patient, complete the trip, and follow hospital handover protocols (or the patient's instructions) as applicable. Waiting time at the pickup agreed with the rider is honoured before the trip proceeds.

Disputes: Any disagreement over the patient, destination, or safety of transport should be reported through the App rather than resolved by abandoning the patient.`,
  },
  {
    title: '6. Fares, Commission & Payments',
    body: `Fare calculation: Ambulance fares are calculated by the Platform on a whole-trip basis (the entire journey is booked; no per-seat sharing), using the published pricing for the selected State and service level (BLS/ALS). Drivers do not set their own fares.

No surge on emergency: Emergency trips are charged at the published emergency fare with no surge multiplier, in compliance with State fare caps and the National Ambulance Code.

Commission: We retain a disclosed platform commission on each completed ambulance trip. The rate is displayed in the driver dashboard and may be updated with 14 days' notice.

Payouts: Driver earnings (fare minus commission) are credited to your in-app wallet and transferred to your linked bank account per the settlement schedule shown in the Earnings dashboard.

Cancellations: If a booking is cancelled after dispatch assignment under the applicable policy, the applicable cancellation fee (if any) is passed to you as compensation.

Disputes: Raise any fare or commission dispute through the driver dashboard within 7 days. Late disputes may not be entertained.`,
  },
  {
    title: '7. Dispatch Eligibility & Availability',
    body: `Dispatch is aggregated across eligible operators for the requesting State. To receive ambulance dispatch you must:

• Have at least one active (admin-verified, non-expired) compliance record for the State of the request, matching the required service level.
• Be online and within a reasonable serviceable radius, with your live location shared for nearest-vehicle dispatch.
• Maintain a live and accurate compliance status; any expired document is flagged by the daily compliance sweep, which automatically suspends the affected record until renewals are verified.

Being online and eligible does not guarantee a minimum number of trips. We may prioritise by proximity, rating, and compliance health. You may decline requests, but persistent low acceptance may reduce your dispatch visibility.`,
  },
  {
    title: '8. Safety, Insurance & Incident Reporting',
    body: `Patient and road safety is paramount. We maintain aggregate passenger insurance for ambulance trips booked through the Platform (policy number published under Disclosures) as required by the National Ambulance Code. Your own third-party and comprehensive vehicle insurance must remain valid at all times; expiry is tracked and reported.

In the event of an accident or patient incident you must: (a) ensure the safety of the patient, attendant and crew; (b) call emergency services if needed; (c) report the incident through the App within 24 hours; and (d) file a police report if required by law. Your compliance record may be suspended while an investigation is pending.`,
  },
  {
    title: '9. Privacy & Data',
    body: `We process your name, phone, government-issued ID details, vehicle and compliance information, location, earnings, and trip history. During trips, patient-related and location data is processed only as necessary for the Service.

Live location is tracked while you are online and dispatched to the rider and (during trips) to the patient's trusted contacts for safety. Location data is retained for 90 days for dispute resolution and may be shared with law enforcement upon valid legal process. Personal data is processed under the Privacy Policy; drivers may view privacy consent status in Profile. We do not sell your personal data.`,
  },
  {
    title: '10. Warnings, Suspension & Termination',
    body: `Enforcement actions may be taken for violations of these Terms, at our sole discretion and final:

1. Warning — a recorded formal notice; accumulation may escalate to suspension. Warnings remain on record for 12 months.
2. Temporary Suspension — your ambulance module is blocked for a defined period; you cannot receive dispatch during this period.
3. Permanent Termination — your ambulance registration (and, where applicable, the operator account) is deactivated; re-registration requires our express written consent.

Grounds include, but are not limited to: safety violations, expired or fraudulent documents, patient misconduct, discrimination, fraud, dishonesty, breaking consent rules, criminal activity, and material breach of these Terms. You may appeal within 14 days; appeals are reviewed by an independent compliance officer.`,
  },
  {
    title: '10A. Financial Settlement Before Suspension',
    body: `Before any suspension or termination of your ambulance module, all outstanding financial matters are settled from both sides:

• Driver earnings (pending payout) are transferred to your linked bank account before suspension takes effect (processing may take 3–5 business days).
• Any amounts owed to the Platform must be cleared or agreed upon.
• Pending fare disputes, damage claims, and insurance claims are resolved before permanent closure.

We will not suspend or terminate an account with unresolved financial matters without first notifying you and providing a reasonable settlement window (minimum 7 days for temporary suspension, 30 days for permanent suspension).`,
  },
  {
    title: '11. Dispute Resolution',
    body: `Governing law: These Terms are governed by the laws of India.

Disputes concerning these Terms shall first be referred to the Aggregator's Grievance Officer (published under Disclosures) and resolved within 30 days. Unresolved disputes are subject to binding arbitration under the Arbitration and Conciliation Act, 1996, and the courts of competent jurisdiction in the operating State.

Class action waiver: You agree to resolve disputes on an individual basis and waive any right to participate in class-action lawsuits or class-wide arbitrations.`,
  },
  {
    title: '12. Modifications & Termination',
    body: `We may update these Terms from time to time. Material changes will be communicated through the App with at least 14 days' notice. Continued use after the effective date of changes constitutes acceptance.

You may deregister any ambulance at any time via the App. We may terminate your ambulance registration at any time with or without cause, upon reasonable notice, including but not limited to cases of fraud, safety concerns, or material breach of these Terms.`,
  },
  {
    title: '13. Limitation of Liability',
    body: `To the maximum extent permitted by applicable law:

• The Service is provided "as is" and "as available" without warranties of any kind.
• We do not guarantee a minimum number of dispatch requests or minimum earnings.
• Our total liability to you for any claim arising from or related to the Service shall not exceed the total commission earned by you in the 30 days preceding the event giving rise to the claim, or ₹10,000, whichever is less.
• We are not liable for indirect, incidental, special, consequential, or punitive damages.

Nothing in these Terms excludes liability for death, personal injury, or fraud caused by our negligence.`,
  },
  {
    title: '14. Contact',
    body: `For questions, complaints, or support:

TSA Enterprises India
Email: driver-support@supertoto.local
Email: tsaenterprisesindia@gmail.com
Phone: +91 9811997286
WhatsApp: +91 9811997286
App: Driver Dashboard > Help & Support

We aim to respond to all operator queries within 24 business hours.`,
  },
];

export default function AmbulanceDriverTerms() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const boxRef = useRef(null);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 60) setAccepted(true);
  };

  const acceptTerms = async () => {
    setBusy(true);
    setErr('');
    try {
      await client.post('/auth/accept-ambulance-terms', { version: TERMS_VERSION });
      await refreshUser();
      navigate('/driver/ambulance');
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not save acceptance. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="terms-page">
      <div className="terms-header">
        <img src={logo} alt="Super Toto Local" className="terms-logo" />
        <h2>Terms &amp; Conditions — Ambulance Operator</h2>
        <p className="small muted">Please read carefully. Scroll to the bottom to accept. (v{TERMS_VERSION})</p>
      </div>

      {err && <div className="alert alert-warn" style={{ margin: '0 16px' }}>{err}</div>}

      <div className="terms-body" ref={boxRef} onScroll={handleScroll}>
        {sections.map((s, i) => (
          <section key={i}>
            <h4 className="terms-heading">{s.title}</h4>
            {s.body.split('\n').map((line, j) => (
              <p key={j}>{line}</p>
            ))}
          </section>
        ))}
      </div>

      <div className="terms-footer">
        {!accepted && (
          <p className="small muted" style={{ textAlign: 'center', margin: '0 0 8px' }}>
            Scroll to the bottom to enable the accept button.
          </p>
        )}
        <button
          className="btn btn-primary"
          disabled={busy || !accepted}
          onClick={acceptTerms}
        >
          {busy ? 'Saving…' : 'I have read and accept the Ambulance Terms'}
        </button>
      </div>
    </div>
  );
}