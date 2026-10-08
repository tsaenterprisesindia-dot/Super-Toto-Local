import { Link } from 'react-router-dom';
import logo from '../../assets/super-toto-logo.png';

const VERSION = '1.0';

const SECTIONS = [
  { title: '1. Introduction', body: 'Welcome to the Super Toto Local Ambulance Service ("the Service"). These Ambulance Service Terms apply when you book a Basic Life Support (BLS) or Advanced Life Support (ALS) ambulance through the Super Toto Local app ("the App"). They supplement the general Terms of Service and Privacy Policy of Super Toto Local, operated by TSA Enterprises India ("we", "us", or "our"). We are an app-based aggregator that connects you with independently licensed and verified ambulance operators. For genuine medical emergencies, always call the national emergency number (108 / 102) or local emergency services as appropriate before or while using the App.' },
  { title: '2. Service Availability', body: 'Ambulance service is available only in States where the Service is enabled and where licensed ambulance operators with active, admin-verified compliance records are online. Current enabled States are published in the App. Bookings are matched to the nearest eligible ambulance for your location and requested service level. If no ambulance is available, the App will let you know and you may try again shortly or use other means to seek transport.' },
  { title: '3. Booking & Consent', body: 'You can book an ambulance for the whole journey (the entire trip from pickup to destination — no per-seat sharing). You will be asked to confirm the pickup location, destination, and, where applicable, whether the trip is an emergency. For patients who are conscious and able, the patient or the booking rider must provide consent for the service level requested; the App records this consent before dispatch where required.' },
  { title: '4. Fares & Billing', body: 'Ambulance trips are billed on a whole-trip basis using the published fare for the State and service level (BLS/ALS), including applicable GST. The fare shown before confirming your request is an estimate; the final fare follows the completed trip. Emergency trips are charged at the published emergency fare. Surge pricing is never applied to emergency trips, in compliance with State fare caps and the National Ambulance Code. Please pay any due fare through the App at the end of the trip.' },
  { title: '5. Cancellation', body: 'You may cancel a request before dispatch or shortly after, subject to the cancellation policy shown at the time of booking. If the ambulance has already been dispatched to reach you, a cancellation fee may apply to compensate the operator for the trip. Repeated no-shows or cancellations may affect your ability to book.' },
  { title: '6. Patient Safety & Conduct', body: 'Ambulance operators registered with the Service follow the National Ambulance Code, including BLS/ALS equipment standards, crew certification, and patient-care conduct. Please follow the crew\u2019s instructions during transport. Operators may only provide emergency medical care within their level of certification. If your medical needs exceed the selected service level, the crew may advise a different level of care or route.' },
  { title: '7. Your Responsibilities', body: 'Provide an accurate pickup location, a reachable contact during the trip, and, where relevant, share critical medical information that could affect transport (e.g., mobility needs, contagious conditions) so the crew can prepare. Ensure someone reliable is present at the pickup if the patient cannot receive the crew themselves. Do not request transport of prohibited items, hazardous material, or more people than the vehicle\u2019s rated capacity.' },
  { title: '8. Insurance', body: 'We maintain aggregate passenger insurance coverage for ambulance trips booked through the Service, as required by the National Ambulance Code (policy number published under Disclosures). This coverage is additional to the operator\u2019s statutory vehicle insurance. Nothing in these terms limits your statutory rights.' },
  { title: '9. Privacy', body: 'When you book an ambulance, the operator receives your name, phone, and pickup location to complete the trip. During a trip, your live location and trip route are shared with the dispatched operator and with the trusted contacts the App May identify (where applicable) for safety. Patient-related information shared with the crew is used solely for your care and transport. Data is processed under the Privacy Policy and the DPDP Act, 2023. We do not sell your personal data.' },
  { title: '10. Contact', body: 'For questions, complaints, or support about ambulance bookings:\n\nTSA Enterprises India\nEmail: support@supertoto.local\nEmail: tsaenterprisesindia@gmail.com\nPhone: +91 9811997286\nApp: Profile > Help & Support or the SOS button in the App\n\nWe aim to respond within 24 business hours. For life-threatening emergencies, immediately call 108 / 102 or the local emergency number.' },
];

export default function AmbulanceRiderTerms() {
  return (
    <div className="terms-page">
      <div className="terms-header">
        <img src={logo} alt="Super Toto Local" className="terms-logo" />
        <h2>Ambulance Service Terms — Rider</h2>
        <p className="small muted">Version {VERSION} · Ambulance bookings through the Super Toto Local app</p>
      </div>

      <div className="terms-body">
        {SECTIONS.map((s, i) => (
          <section key={i}>
            <h4 className="terms-heading">{s.title}</h4>
            {s.body.split('\n').map((line, j) => (
              <p key={j}>{line}</p>
            ))}
          </section>
        ))}
      </div>

      <div className="terms-footer">
        <Link to="/ride" className="btn btn-primary">Back to Ride</Link>
      </div>
    </div>
  );
}