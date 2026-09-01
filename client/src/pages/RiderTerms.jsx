import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client.js';
import logo from '../assets/super-toto-logo.png';

const TERMS_VERSION = '1.0';

const sections = [
  {
    title: '1. Introduction',
    body: `Welcome to Super Toto Local ("the Platform", "the App", "the Service"), a technology platform that connects independent e-mobility drivers with riders seeking local transportation. By creating an account, logging in, or using the Service, you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service.

Super Toto Local is operated by TSA Enterprises India (referred to below as "we", "us", or "our"). We reserve the right to modify these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms.`,
  },
  {
    title: '2. Eligibility & Account',
    body: `You must be at least 18 years old to use the Service. You must provide accurate, current, and complete information during registration and keep your account information up to date.

You may not share your account credentials with anyone or allow multiple persons to use the same account. You are responsible for all activity that occurs under your account.

You may register using your email address and password, or via mobile OTP verification. One account per person is strictly enforced.`,
  },
  {
    title: '3. Service Description',
    body: `Super Toto Local provides a technology platform to facilitate ride-booking between riders and independent e-mobility drivers. We are NOT a transportation carrier. We do not employ drivers, own vehicles, or control the manner in which drivers operate.

A driver accepting your ride request is an independent contractor, not an employee, agent, or partner of Super Toto Local.

Service availability depends on driver supply in your area and may vary by time of day, weather, and demand.`,
  },
  {
    title: '4. Booking, Fares & Payment',
    body: `Fare estimation: The App provides an estimated fare before you confirm a booking. The estimate includes base fare, distance charge, time charge, and applicable surge pricing.

Surge pricing: During periods of high demand, fares may increase by up to 60% (multiplier 1.0 – 1.6) above the base rate. The surge multiplier is displayed before you confirm.

Taxes: A 5% GST is applicable on all completed rides as required by Indian law.

Payment methods: You may pay via UPI, credit/debit card, or cash. Digital payments are processed through secure third-party payment gateways. We do not store your card details.

Cancellation fee: A ₹20 cancellation fee applies if you cancel after a driver has been assigned and is en route to your pickup location. This fee compensates the driver for time and distance already incurred.

Price disputes: If you believe a fare is incorrect, contact support within 48 hours of the ride. We will investigate and adjust if warranted.

Promotional credits: Any promotional credits or discounts applied to your account are non-transferable, have no cash value, and may expire or be revoked at our discretion.`,
  },
  {
    title: '5. Rider Conduct',
    body: `By using the Service, you agree to:

• Provide accurate pickup and drop-off locations.
• Treat drivers with respect and courtesy.
• Not request rides while under the influence of alcohol or controlled substances that impair judgment.
• Not carry prohibited items including hazardous materials, illegal substances, weapons, or live animals (except service animals with prior arrangement).
• Not smoke, eat messy food, or engage in conduct that soils or damages the vehicle during the ride.
• Remain seated and wear available seatbelts or handrails throughout the ride.
• Not solicit drivers for services outside the Platform.
• Not attempt to circumvent the Platform's fare calculation or payment systems.
• Not misrepresent your identity, location, or number of passengers.`,
  },
  {
    title: '6. Safety',
    body: `Your safety is our priority. Every driver is required to hold a valid driving licence, complete a background verification, and maintain a roadworthy vehicle.

You are encouraged to share your live trip status with a trusted contact via the App's sharing feature.

In an emergency during a ride, use the in-app SOS button to alert local authorities and our safety team.

Riders must not interfere with the driver's operation of the vehicle, open doors while moving, or distract the driver.

Super Toto Local is not liable for any injury, loss, or damage arising from the conduct of riders or drivers during a ride, except to the extent caused by our gross negligence or wilful misconduct.`,
  },
  {
    title: '7. Cancellations & Refunds',
    body: `You may cancel a ride before the driver arrives at your pickup location without penalty.

Once a driver is assigned and has started travelling to you, a ₹20 cancellation fee applies.

No-show: If you are not at the pickup location within 5 minutes of the driver's arrival, the driver may cancel the ride and the cancellation fee will apply.

Refunds: If you were charged incorrectly due to a technical error, contact support within 48 hours. Approved refunds are credited within 5–7 business days.

Repeated cancellations: Habitual cancellation (more than 3 in a week) may result in a temporary restriction on your ability to book rides.`,
  },
  {
    title: '8. Privacy & Data',
    body: `We collect and process personal information including your name, phone number, email, location data, payment information, and ride history as described in our Privacy Policy.

Location data: Your device location is shared with the assigned driver only for the duration of the trip. Trip routes may be recorded for safety and quality purposes.

We do not sell your personal data to third parties. Data is shared only as necessary to provide the Service (e.g., with payment processors, drivers for trip fulfilment, or as required by law).

You may request deletion of your account and associated data by contacting support. Certain data may be retained for legal, regulatory, or dispute-resolution purposes.

Data security: We implement industry-standard encryption and access controls. However, no system is completely secure. You are responsible for keeping your login credentials safe.`,
  },
  {
    title: '9. Intellectual Property',
    body: `All trademarks, logos, design elements, software, and content within the App are the intellectual property of TSA Enterprises India or its licensors. You are granted a limited, non-exclusive, revocable licence to use the App for personal, non-commercial use only.

You may not copy, modify, distribute, sell, or reverse-engineer any part of the App, or use the App to build a competing service.

User-generated content (ratings, reviews, feedback) grants us a non-exclusive, royalty-free licence to use, display, and modify such content for service improvement and promotional purposes.`,
  },
  {
    title: '10. Ratings & Reviews',
    body: `After each ride you may rate the driver and provide feedback. Ratings are used to maintain service quality.

Ratings must be honest and based on your actual ride experience. Ratings submitted with malicious intent, retaliatory motive, or in exchange for compensation (other than legitimate promotions) may be removed.

Drivers may also rate riders. Consistently low rider ratings may result in restricted access to the Service.`,
  },
  {
    title: '11. Dispute Resolution',
    body: `Governing law: These Terms are governed by the laws of India.

Arbitration: Any dispute arising out of or relating to these Terms or the Service shall be resolved by binding arbitration under the Arbitration and Conciliation Act, 1996. The seat of arbitration shall be the jurisdiction where TSA Enterprises India is registered.

Class action waiver: You agree to resolve disputes on an individual basis and waive any right to participate in class-action lawsuits or class-wide arbitrations.

Before initiating formal proceedings, you agree to first contact us at the address below and attempt to resolve the dispute informally for a period of 30 days.`,
  },
  {
    title: '12. Modifications & Termination',
    body: `We may update these Terms from time to time. When material changes are made, we will notify you through the App and request re-acceptance.

You may terminate your account at any time by contacting support or using the in-app account deletion option. Outstanding balances must be settled before termination.

We reserve the right to suspend or terminate your access to the Service at our sole discretion, with or without cause, upon reasonable notice, including but not limited to cases of fraud, safety concerns, or material breach of these Terms.`,
  },
  {
    title: '13. Warnings, Suspension & Termination',
    body: `Violations of these Terms may result in the following enforcement actions:

1. Warning: A formal notice alerting you to the violation. Repeated warnings may escalate to suspension.
2. Temporary Suspension: Your account is blocked for a defined period (e.g., 7 days, 30 days). You cannot log in, book rides, or use any part of the Service during this period.
3. Permanent Suspension: Your account is permanently deactivated. You may not create a new account without our written consent.

Enforcement is at our sole discretion and is final. Warnings and suspension history are retained on your account record.

You may appeal an enforcement action by contacting support within 14 days of the action. Appeals are reviewed by an independent compliance officer.`,
  },
  {
    title: '14. Financial Settlement',
    body: `Before any account suspension or termination can take effect, all outstanding financial matters must be settled:

Outstanding dues: If you have unpaid ride fares or cancellation fees, these must be cleared before your account can be suspended or terminated.

Pending refunds: Any approved refunds for cancelled or disputed rides will be processed within 5–7 business days before account closure.

Digital payment disputes: If a ride payment was processed via UPI or card and is under dispute, the dispute must be resolved before permanent account closure.

Cash payments: If you owe cash payment for a completed ride, this must be settled before any enforcement action.

Account closure: Upon account closure (voluntary or enforced), any remaining credit balance or promotional credits will be forfeited and are non-transferable.

Super Toto Local reserves the right to delay account suspension or termination until financial settlement is confirmed by the platform.`,
  },
  {
    title: '14. Limitation of Liability',
    body: `To the maximum extent permitted by applicable law:

• The Service is provided "as is" and "as available" without warranties of any kind.
• We do not guarantee uninterrupted, timely, or error-free operation of the App.
• Our total liability to you for any claim arising from or related to the Service shall not exceed the fare amount of the ride giving rise to the claim, or ₹5,000, whichever is less.
• We are not liable for indirect, incidental, special, consequential, or punitive damages.

Nothing in these Terms excludes liability for death, personal injury, or fraud caused by our negligence, or any other liability that cannot be excluded by law.`,
  },
  {
    title: '15. Contact',
    body: `For questions, complaints, or support requests regarding these Terms or the Service:

TSA Enterprises India
Email: support@supertoto.local
Email: tsaenterprisesindia@gmail.com
Phone: +91 9811997286
WhatsApp: +91 9811997286 (chat with us directly)
App: Use the in-app Help & Support section.

We aim to respond to all queries within 48 business hours.`,
  },
];

export default function RiderTerms() {
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
      navigate('/ride');
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
        <h2>Terms &amp; Conditions — Rider</h2>
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
          {busy ? 'Saving…' : 'I have read and accept the Terms'}
        </button>
      </div>
    </div>
  );
}
