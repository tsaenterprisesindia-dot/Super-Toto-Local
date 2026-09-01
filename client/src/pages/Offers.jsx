import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import Nav from '../components/Nav.jsx';
import AdBanner from '../components/AdBanner.jsx';
import { formatINR } from '../utils/geo.js';

const OFFERS = [
  {
    id: 1,
    title: 'First Ride Free!',
    subtitle: 'New to Super Toto Local?',
    description: 'Get ₹50 off on your very first ride. Just sign up, book a toto and the discount is applied automatically.',
    badge: 'NEW',
    badgeColor: '#16a34a',
    gradient: 'linear-gradient(135deg, #d7f5e9 0%, #a7f3d0 100%)',
    emoji: '🎉',
    code: 'FIRST50',
    validTill: '31 Dec 2026',
  },
  {
    id: 2,
    title: 'Refer & Earn ₹20',
    subtitle: 'Share the ride, share the savings',
    description: 'Invite a friend to Super Toto Local. When they complete their first ride, you both get ₹20 off your next trip.',
    badge: 'POPULAR',
    badgeColor: '#f59e0b',
    gradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    emoji: '👥',
    code: 'REFER20',
    validTill: '31 Dec 2026',
  },
  {
    id: 3,
    title: 'Review & Save ₹10',
    subtitle: 'Your feedback matters!',
    description: 'Share your experience about the driver, travel distance and travel time after every ride and get an instant ₹10 discount.',
    badge: 'ACTIVE',
    badgeColor: '#0e9f6e',
    gradient: 'linear-gradient(135deg, #e0ecff 0%, #bfdbfe 100%)',
    emoji: '⭐',
    code: null,
    validTill: 'Ongoing',
  },
  {
    id: 4,
    title: 'Weekend Ride 15% Off',
    subtitle: 'Ride more on weekends',
    description: 'Enjoy 15% off on all rides booked on Saturday and Sunday. Perfect for weekend outings with family and friends.',
    badge: 'WEEKEND',
    badgeColor: '#7c3aed',
    gradient: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
    emoji: '🗓️',
    code: 'WEEKEND15',
    validTill: '31 Dec 2026',
  },
  {
    id: 5,
    title: 'Heavy Luggage Free',
    subtitle: 'Travelling with bags?',
    description: 'Book a Toto or Taxi with 3+ passengers and get your first heavy luggage item handled free of charge.',
    badge: 'SAVINGS',
    badgeColor: '#0369a1',
    gradient: 'linear-gradient(135deg, #cffafe 0%, #a5f3fc 100%)',
    emoji: '🧳',
    code: null,
    validTill: '31 Oct 2026',
  },
  {
    id: 6,
    title: 'Early Bird ₹15 Off',
    subtitle: 'Ride between 6 AM – 8 AM',
    description: 'Book your ride in the early morning window and save ₹15 on every trip. Stay punctual, save more!',
    badge: 'MORNING',
    badgeColor: '#ea580c',
    gradient: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
    emoji: '🌅',
    code: 'EARLY15',
    validTill: '31 Dec 2026',
  },
];

function OfferCard({ offer, index }) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    if (!offer.code) return;
    navigator.clipboard?.writeText(offer.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="offer-card animate-slide-up"
      style={{
        background: offer.gradient,
        animationDelay: `${index * 0.1}s`,
      }}
    >
      <div className="offer-card-inner">
        <div className="offer-badge" style={{ background: offer.badgeColor }}>
          {offer.badge}
        </div>
        <div className="offer-emoji">{offer.emoji}</div>
        <h3 className="offer-title">{offer.title}</h3>
        <p className="offer-subtitle">{offer.subtitle}</p>
        <p className="offer-desc">{offer.description}</p>
        <div className="offer-footer">
          {offer.code && (
            <button className="offer-code-btn" onClick={copyCode}>
              {copied ? '✓ Copied!' : `Code: ${offer.code}`}
            </button>
          )}
          <span className="offer-valid">Valid till: {offer.validTill}</span>
        </div>
      </div>
    </div>
  );
}

export default function Offers() {
  const [fbCfg, setFbCfg] = useState({ enabled: true, discountAmount: 10 });

  useEffect(() => {
    client.get('/feedback-config').then(({ data }) => setFbCfg(data.feedbackConfig || {})).catch(() => {});
  }, []);

  return (
    <div>
      <Nav />
      <div className="page">
        {/* Hero Banner */}
        <div className="offers-hero animate-fade-in">
          <div className="offers-hero-content">
            <div className="offers-hero-icon animate-bounce-in">🏷️</div>
            <h1 className="offers-hero-title">
              Offers & <span style={{ color: 'var(--brand)' }}>Rewards</span>
            </h1>
            <p className="offers-hero-subtitle">
              Save more on every ride! Check out our latest deals and promotions.
            </p>
          </div>
          <div className="offers-hero-wave">
            <svg viewBox="0 0 600 60" preserveAspectRatio="none">
              <path d="M0,30 C150,60 350,0 600,30 L600,60 L0,60 Z" fill="var(--bg)" />
            </svg>
          </div>
        </div>

        {/* Feedback CTA */}
        {fbCfg.enabled && fbCfg.discountAmount > 0 && (
          <div className="feedback-cta animate-slide-up" style={{ animationDelay: '0.05s' }}>
            <div className="feedback-cta-inner">
              <div className="feedback-cta-left">
                <span className="feedback-cta-emoji">💬</span>
                <div>
                  <div className="feedback-cta-title">Get {formatINR(fbCfg.discountAmount)} off — just share your feedback!</div>
                  <div className="feedback-cta-sub">
                    After every ride, tell us about your driver, the distance &amp; time. Instant discount!
                  </div>
                </div>
              </div>
              <Link to="/ride" className="btn btn-primary feedback-cta-btn">
                Book now →
              </Link>
            </div>
          </div>
        )}

        {/* Offer Cards */}
        <div className="offers-grid">
          {OFFERS.map((offer, i) => (
            <OfferCard key={offer.id} offer={offer} index={i} />
          ))}
        </div>

        {/* How it works */}
        <div className="how-it-works animate-slide-up" style={{ animationDelay: '0.6s' }}>
          <h2 className="section-title">How to use offers?</h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <div className="step-icon">📱</div>
              <div className="step-title">Open the app</div>
              <div className="step-desc">Log in to your rider account</div>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-number">2</div>
              <div className="step-icon">🛺</div>
              <div className="step-title">Book a ride</div>
              <div className="step-desc">Select pickup & drop, choose vehicle</div>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-number">3</div>
              <div className="step-icon">💰</div>
              <div className="step-title">Save more</div>
              <div className="step-desc">Offers are applied or use a code at checkout</div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="offers-contact animate-slide-up" style={{ animationDelay: '0.7s' }}>
          <p>Have questions about an offer? <Link to="/ride">Book a ride</Link> or contact us at <b>+91 9811997286</b></p>
        </div>
      </div>
      <AdBanner />
    </div>
  );
}
