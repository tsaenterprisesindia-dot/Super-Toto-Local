import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client.js';
import logo from '../assets/super-toto-logo.png';

const TERMS_VERSION = '1.0';

const sections = [
  {
    title: '1. Introduction',
    body: `Welcome to Super Toto Local ("the Platform", "the App", "the Service"). These Driver Terms of Service ("Terms") govern your use of the Platform as a driver partner. By creating an account, going online, or accepting ride requests, you agree to be bound by these Terms.

Super Toto Local is operated by TSA Enterprises India ("we", "us", or "our"). We reserve the right to modify these Terms at any time. Material changes will be notified through the App, and continued use after notification constitutes acceptance.`,
  },
  {
    title: '2. Driver Eligibility & Onboarding',
    body: `To register as a driver you must:

• Be at least 18 years of age.
• Hold a valid Indian driving licence for the applicable vehicle class (electric three-wheeler / e-rickshaw).
• Provide proof of vehicle registration (RC), third-party insurance, and any local permits required for commercial passenger service.
• Complete the background verification process, which includes identity verification, criminal record check, and address verification.
• Have no pending criminal charges for offences involving violence, fraud, sexual misconduct, or dangerous driving.

Super Toto Local reserves the right to reject any application without stating reasons and to revoke approval at any time if eligibility criteria cease to be met.

You must keep all documents valid and up to date. Expired documents will result in automatic suspension of your account until valid copies are uploaded.`,
  },
  {
    title: '3. Vehicle Standards',
    body: `Your vehicle must meet the following minimum requirements at all times:

• Type: Electric three-wheeler (E-Rickshaw) or such other category as approved by Super Toto Local.
• Registration: Valid RC in the driver's name (or authorisation letter if vehicle is owned by a family member or employer).
• Insurance: Active third-party liability insurance as mandated by the Motor Vehicles Act, 1988.
• Fitness: Valid fitness certificate from the Regional Transport Office (RTO) if applicable.
• Safety: Working headlights, tail lights, indicators, mirrors, seatbelts or handrails (as applicable), and a first-aid kit.
• Cleanliness: Vehicle must be clean, odour-free, and in good mechanical condition before each shift.

We may conduct random vehicle inspections or require photographic evidence of vehicle condition. Failure to meet standards may result in temporary or permanent removal from the Platform.`,
  },
  {
    title: '4. Driver Conduct & Service Standards',
    body: `As a driver on the Platform you agree to:

• Provide a safe, courteous, and professional service at all times.
• Follow all traffic laws and regulations.
• Not drive under the influence of alcohol, drugs, or any substance that impairs driving ability.
• Not use a mobile phone while the vehicle is in motion (use hands-free only for navigation).
• Not discriminate against any rider on the basis of race, religion, gender, disability, sexual orientation, national origin, age, or any other protected characteristic.
• Not solicit rides, payments, or personal information from riders outside the Platform.
• Not accept additional passengers beyond the vehicle's rated capacity.
• Not refuse a ride request on the basis of the rider's destination within the defined service area.
• Keep your vehicle fuelled/charged sufficiently to complete accepted rides.
• Maintain a professional appearance and personal hygiene.
• Use the in-app navigation or a navigation app for route guidance unless the rider requests an alternative route.
• Not tamper with or disable the ride-tracking, fare-calculation, or safety features of the App.

Violations may result in warnings, temporary suspension, or permanent termination of your account.`,
  },
  {
    title: '5. Fares, Commission & Payments',
    body: `Fare calculation: Fares are calculated by the Platform based on distance, time, and applicable surge multiplier. Drivers do not set their own fares.

Commission: Super Toto Local retains a commission on each completed ride. The commission rate is displayed in the driver dashboard and may be updated with 14 days' notice.

Payouts: Driver earnings (fare minus commission) are credited to the driver's in-app wallet. Wallet balance can be transferred to the linked bank account subject to a minimum withdrawal threshold and processing times.

Cancellation fee: The ₹20 cancellation fee paid by the rider when cancelling after driver assignment is passed entirely to the driver as compensation for time and distance incurred.

Surge pricing: Surge multipliers are applied automatically during periods of high demand. Drivers receive the full surge-adjusted fare minus commission.

GST: Where applicable, GST on driver earnings is the driver's responsibility. Super Toto Local will provide earnings statements for tax-filing purposes.

Disputes: If you believe a fare adjustment or commission charge is incorrect, raise a dispute through the driver dashboard within 7 days. Late disputes may not be entertained.`,
  },
  {
    title: '6. Ride Acceptance & Cancellation',
    body: `You are free to accept or decline ride requests. However, persistent low acceptance rates (below 70%) may result in reduced visibility in the dispatch algorithm and, ultimately, account review.

Once you accept a ride request, you are committed to:

• Arrive at the pickup location within the estimated time.
• Complete the ride unless a safety emergency or rider misconduct requires cancellation.

Driver-initiated cancellation: If you must cancel after accepting, do so promptly and provide a reason. Repeated cancellations after acceptance may result in warnings or temporary suspension.

No-show compensation: If the rider does not appear within 5 minutes of your arrival, you may cancel with "Rider no-show" and claim the cancellation fee.`,
  },
  {
    title: '7. Safety & Insurance',
    body: `Your safety and the safety of your passengers is paramount.

You are required to:

• Wear a seatbelt where available.
• Drive at safe speeds appropriate to road and weather conditions.
• Not overtake dangerously or engage in reckless driving.
• Pull over immediately if you feel your safety or the rider's safety is at risk.

Insurance: You must maintain your own personal accident insurance and third-party liability insurance. Super Toto Local does not provide insurance coverage for drivers, except as may be required by applicable law.

Accidents: In the event of an accident, you must: (a) ensure the safety of all passengers, (b) call emergency services if needed, (c) report the incident to Super Toto Local within 24 hours via the App or support channels, and (d) file a police report if required by law.

We may temporarily suspend your account while an accident investigation is pending.`,
  },
  {
    title: '8. Ratings & Quality',
    body: `Riders will rate their experience after each trip on a 1–5 star scale. Your average rating is displayed on your dashboard and affects your visibility in the dispatch algorithm.

Minimum rating: Drivers must maintain an average rating of at least 3.5 out of 5. Drivers whose average falls below 3.5 will receive a warning and may be required to complete corrective training. Continued low ratings may result in account suspension.

Rating manipulation: Any attempt to manipulate ratings (e.g., pressuring riders for 5 stars, offering incentives for ratings, retaliating against low ratings) is strictly prohibited and may result in immediate suspension.

Quality monitoring: Super Toto Local may review ride data, route recordings, and (where legally permissible) audio or video for quality assurance and dispute resolution.`,
  },
  {
    title: '9. Privacy & Data',
    body: `We collect and process personal information including your name, phone number, email, government-issued ID details, vehicle information, location data, earnings, and ride history.

Location tracking: Your device location is tracked while you are online for the purposes of ride dispatch and safety. Location data is retained for 90 days for dispute resolution and may be shared with law enforcement upon valid legal process.

Performance data: We collect data on your acceptance rate, cancellation rate, average rating, and ride completion rate. This data is used to manage your standing on the Platform.

We do not sell your personal data to third parties. Data is shared only as necessary to provide the Service or as required by law.

You may request access to your personal data or request correction of inaccurate data by contacting support. Data deletion requests will be processed in accordance with applicable law, subject to any mandatory retention requirements.`,
  },
  {
    title: '10. Intellectual Property',
    body: `The App, its software, design, trademarks, and content are the intellectual property of TSA Enterprises India or its licensors. You are granted a limited, non-exclusive, revocable licence to use the App solely for the purpose of providing rides on the Platform.

You may not: copy, modify, distribute, sell, or reverse-engineer any part of the App; use the App to provide services on competing platforms; or remove any proprietary notices from the App.`,
  },
  {
    title: '11. Warnings, Suspension & Termination',
    body: `Enforcement actions may be taken against your account for violations of these Terms. Enforcement is at our sole discretion and is final.

1. Warning: A formal notice alerting you to the violation. Warnings are recorded on your account. Accumulation of warnings may escalate to suspension. Warnings remain on your record for 12 months.

2. Temporary Suspension: Your account is blocked for a defined period (e.g., 7 days, 14 days, 30 days). You cannot go online, accept rides, or earn during this period. Automatic reinstatement occurs at the end of the suspension period.

3. Permanent Suspension: Your account is permanently deactivated. You may not re-register without our express written consent. Outstanding earnings will be settled subject to any withholdings for unresolved disputes or liabilities.

Grounds for enforcement include but are not limited to: safety violations, discrimination, fraud, dishonesty, rating manipulation, document fraud, criminal activity, and material breach of these Terms.

You may appeal an enforcement action by contacting support within 14 days. Appeals are reviewed by an independent compliance officer.`,
  },
  {
    title: '11A. Financial Settlement Before Suspension',
    body: `Before any account suspension or termination, all outstanding financial matters must be properly settled from both sides:

Driver earnings: Your accumulated wallet balance (pending payout) will be transferred to your linked bank account before any suspension takes effect. Processing may take 3–5 business days.

Outstanding dues: If you owe any amounts to the platform (e.g., advance payments, penalty deductions, or incorrect overpayments), these must be settled or agreed upon before suspension.

Ride disputes: Any pending fare disputes or damage claims related to your rides must be resolved before permanent account closure.

Insurance claims: If an insurance claim arising from your rides is pending, the claim must be resolved before account closure.

Vehicle-related dues: Any platform charges related to your vehicle (e.g., maintenance deductions, promotional charges) must be cleared.

Incomplete rides: If you have a ride in progress or pending completion, it must be completed or formally cancelled before suspension can take effect.

Super Toto Local will not suspend or terminate an account with unresolved financial matters without first notifying you and providing a reasonable settlement window (minimum 7 days for temporary suspension, 30 days for permanent suspension).`,
  },
  {
    title: '12. Dispute Resolution',
    body: `Governing law: These Terms are governed by the laws of India.

Arbitration: Disputes shall be resolved by binding arbitration under the Arbitration and Conciliation Act, 1996. The seat of arbitration shall be the jurisdiction where TSA Enterprises India is registered.

Class action waiver: You agree to resolve disputes on an individual basis and waive any right to participate in class-action lawsuits or class-wide arbitrations.

Informal resolution: Before initiating formal proceedings, you agree to first contact us and attempt to resolve the dispute informally for a period of 30 days.`,
  },
  {
    title: '13. Modifications & Termination',
    body: `We may update these Terms from time to time. Material changes will be communicated through the App with at least 14 days' notice. Continued use after the effective date of changes constitutes acceptance.

You may terminate your account at any time by contacting support or using the in-app option. Outstanding earnings will be settled subject to applicable deductions.

We may terminate your account at any time with or without cause, upon reasonable notice, including but not limited to cases of fraud, safety concerns, or material breach of these Terms.`,
  },
  {
    title: '14. Limitation of Liability',
    body: `To the maximum extent permitted by applicable law:

• The Service is provided "as is" and "as available" without warranties of any kind.
• We do not guarantee a minimum number of ride requests or minimum earnings.
• Our total liability to you for any claim arising from or related to the Service shall not exceed the total commission earned by you in the 30 days preceding the event giving rise to the claim, or ₹10,000, whichever is less.
• We are not liable for indirect, incidental, special, consequential, or punitive damages.

Nothing in these Terms excludes liability for death, personal injury, or fraud caused by our negligence.`,
  },
  {
    title: '15. Contact',
    body: `For questions, complaints, or support:

TSA Enterprises India
Email: driver-support@supertoto.local
Email: tsaenterprisesindia@gmail.com
Phone: +91 9811997286
WhatsApp: +91 9811997286 (chat with us directly)
App: Driver Dashboard > Help & Support

We aim to respond to all driver queries within 24 business hours.`,
  },
];

export default function DriverTerms() {
  const { user, refreshUser } = useAuth();
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
      await client.post('/auth/accept-terms', { version: TERMS_VERSION });
      await refreshUser();
      navigate('/driver/documents');
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
        <h2>Terms &amp; Conditions — Driver</h2>
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
          {busy ? 'Saving…' : 'I have read and accept the Driver Terms'}
        </button>
      </div>
    </div>
  );
}
