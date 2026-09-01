import { useEffect, useState } from 'react';
import client from '../../api/client.js';

const FEEDBACK_DEFAULTS = {
  enabled: true,
  discountAmount: 10,
  requireDriverFeedback: true,
  requireDistanceFeedback: true,
  requireTimeFeedback: true,
  driverFeedbackLabel: 'How was the driver?',
  driverFeedbackPlaceholder: 'Driver behaviour, driving skills, politeness…',
  distanceFeedbackLabel: 'Was the travel distance accurate?',
  distanceFeedbackPlaceholder: 'Was the route taken accurate and shortest?',
  timeFeedbackLabel: 'Was the travel time reasonable?',
  timeFeedbackPlaceholder: 'Was the estimated time accurate?',
  successMessage: 'Thanks for your review!',
  discountMessage: 'Thanks for your review! ₹{amount} discount applied.',
};

const SECTIONS = [
  {
    title: '📍 Distance & Route',
    desc: 'Ride distance limits and driver search area.',
    fields: [
      { key: 'minRideDistanceKm', label: 'Minimum ride distance (km)' },
      { key: 'maxRideDistanceKm', label: 'Maximum ride distance (km)' },
      { key: 'searchRadiusKm', label: 'Driver search radius (km)' },
    ],
  },
  {
    title: '💰 Price & Fare',
    desc: 'Base fare, per km, per minute, minimum fare and cancellation fee.',
    fields: [
      { key: 'base', label: 'Base fare (₹)' },
      { key: 'perKm', label: 'Per kilometre (₹)' },
      { key: 'perMin', label: 'Per minute (₹)' },
      { key: 'minimum', label: 'Minimum fare (₹)' },
      { key: 'cancellationFee', label: 'Cancellation fee (₹)' },
    ],
  },
  {
    title: '⏱ Time & Dispatch',
    desc: 'Average speed for ETA and driver dispatch timeout.',
    fields: [
      { key: 'avgSpeedKmh', label: 'Avg speed for ETA (km/h)' },
      { key: 'dispatchTimeoutSec', label: 'Driver dispatch timeout (sec)' },
    ],
  },
  {
    title: '📈 Surge Pricing',
    desc: 'When demand exceeds supply, fares adjust between floor and ceiling.',
    fields: [
      { key: 'surgeFloor', label: 'Surge floor (×)' },
      { key: 'surgeCeil', label: 'Surge ceiling (×)' },
    ],
  },
  {
    title: '🏛 Taxes & Commission',
    desc: 'GST rate and platform commission deducted from gross fare.',
    fields: [
      { key: 'gstRate', label: 'GST rate (%)', pct: true },
      { key: 'commissionRate', label: 'Platform commission (%)', pct: true },
    ],
  },
  {
    title: '🧳 Luggage',
    desc: 'Free luggage allowance and extra baggage charges per ride.',
    fields: [
      { key: 'freeLuggageItems', label: 'Free luggage items per ride' },
      { key: 'freeLuggageWeightKg', label: 'Free luggage weight limit (kg per item)' },
      { key: 'extraLuggageFee', label: 'Extra luggage fee (₹ per bag)' },
      { key: 'heavyLuggageFee', label: 'Heavy luggage fee (₹ per item)' },
      { key: 'heavyLuggageWeightKg', label: 'Heavy luggage threshold (kg)' },
    ],
  },
  {
    title: '👨‍👩‍👧‍👦 Passengers',
    desc: 'Free child allowance. Children under 7 ride free up to this limit; extra children are charged at adult rate.',
    fields: [
      { key: 'freeChildCount', label: 'Free children per ride (under 7 years)' },
    ],
  },
];

export default function AdminSettings() {
  const [form, setForm] = useState({});
  const [defaults, setDefaults] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [fbForm, setFbForm] = useState({});
  const [fbSaving, setFbSaving] = useState(false);
  const [fbMsg, setFbMsg] = useState('');
  const [upiForm, setUpiForm] = useState({ upiId: 'anilmandal27@okhdfcbank', merchantName: 'Super Toto Local', enabled: true, showQr: true, instructions: 'Scan the QR or tap the button below to pay via any UPI app.' });
  const [upiSaving, setUpiSaving] = useState(false);
  const [upiMsg, setUpiMsg] = useState('');
  const [contactForm, setContactForm] = useState({ helplinePhone: '+919811997286', helplineLabel: '24×7 Helpline', email: 'tsaenterprisesindia@gmail.com', whatsapp: '+919811997286', showHelpline: true });
  const [contactSaving, setContactSaving] = useState(false);
  const [contactMsg, setContactMsg] = useState('');
  const [cbForm, setCbForm] = useState({ enabled: true, botName: 'Toto Assist', greeting: '', fallback: '', helpText: '', quickReplies: [] });
  const [cbSaving, setCbSaving] = useState(false);
  const [cbMsg, setCbMsg] = useState('');
  const [sbForm, setSbForm] = useState({ mode: 'shared', message: '' });
  const [sbSaving, setSbSaving] = useState(false);
  const [sbMsg, setSbMsg] = useState('');

  const allFields = SECTIONS.flatMap((s) => s.fields);
  const toPct = (v, f) => (f?.pct ? Math.round(v * 1000) / 10 : v);

  useEffect(() => {
    client
      .get('/admin/settings')
      .then(({ data }) => {
        setDefaults(data.defaults);
        const init = {};
        for (const f of allFields) init[f.key] = toPct(data.settings[f.key], f);
        setForm(init);
      })
      .catch(() => {});
    client
      .get('/admin/feedback-config')
      .then(({ data }) => {
        setFbForm(data.feedbackConfig || FEEDBACK_DEFAULTS);
      })
      .catch(() => {});
    client
      .get('/admin/upi-config')
      .then(({ data }) => {
        setUpiForm(data.upiConfig || {});
      })
      .catch(() => {});
    client
      .get('/admin/contact-config')
      .then(({ data }) => {
        setContactForm(data.contactConfig || {});
      })
      .catch(() => {});
    client
      .get('/admin/chatbot-config')
      .then(({ data }) => {
        setCbForm(data.chatbotConfig || {});
      })
      .catch(() => {});
    client
      .get('/admin/seat-booking')
      .then(({ data }) => {
        setSbForm(data.seatBookingConfig || { mode: 'shared', message: '' });
      })
      .catch(() => {});
  }, []);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (values) => {
    setSaving(true);
    setMsg('');
    try {
      const payload = {};
      for (const f of allFields) {
        const n = Number(values[f.key]);
        if (!Number.isFinite(n) || n < 0) {
          setMsg(`Invalid value for ${f.label}`);
          setSaving(false);
          return;
        }
        payload[f.key] = f.pct ? n / 100 : n;
      }
      const { data } = await client.put('/admin/settings', payload);
      for (const f of allFields) setField(f.key, toPct(data.settings[f.key], f));
      setMsg('Settings saved — apply immediately to new rides.');
    } catch (e) {
      setMsg(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    const init = {};
    for (const f of allFields) init[f.key] = toPct(defaults[f.key], f);
    submit(init);
  };

  const setFbField = (key, value) => setFbForm((prev) => ({ ...prev, [key]: value }));

  const submitFeedback = async () => {
    setFbSaving(true);
    setFbMsg('');
    try {
      const { data } = await client.put('/admin/feedback-config', fbForm);
      setFbForm(data.feedbackConfig);
      setFbMsg('Feedback settings saved — applies immediately.');
    } catch (e) {
      setFbMsg(e.response?.data?.message || 'Save failed');
    } finally {
      setFbSaving(false);
    }
  };

  const setUpiField = (key, value) => setUpiForm((prev) => ({ ...prev, [key]: value }));

  const submitUpi = async () => {
    setUpiSaving(true);
    setUpiMsg('');
    try {
      const { data } = await client.put('/admin/upi-config', upiForm);
      setUpiForm(data.upiConfig);
      setUpiMsg('UPI settings saved — applies immediately.');
    } catch (e) {
      setUpiMsg(e.response?.data?.message || 'Save failed');
    } finally {
      setUpiSaving(false);
    }
  };

  const setContactField = (key, value) => setContactForm((prev) => ({ ...prev, [key]: value }));

  const submitContact = async () => {
    setContactSaving(true);
    setContactMsg('');
    try {
      const { data } = await client.put('/admin/contact-config', contactForm);
      setContactForm(data.contactConfig);
      setContactMsg('Contact & helpline settings saved — applies immediately.');
    } catch (e) {
      setContactMsg(e.response?.data?.message || 'Save failed');
    } finally {
      setContactSaving(false);
    }
  };

  const setCbField = (key, value) => setCbForm((prev) => ({ ...prev, [key]: value }));

  const submitChatbot = async () => {
    setCbSaving(true);
    setCbMsg('');
    try {
      const { data } = await client.put('/admin/chatbot-config', cbForm);
      setCbForm(data.chatbotConfig);
      setCbMsg('Chatbot settings saved — applies immediately.');
    } catch (e) {
      setCbMsg(e.response?.data?.message || 'Save failed');
    } finally {
      setCbSaving(false);
    }
  };

  const setSbField = (key, value) => setSbForm((prev) => ({ ...prev, [key]: value }));

  const submitSeatBooking = async () => {
    setSbSaving(true);
    setSbMsg('');
    try {
      const { data } = await client.put('/admin/seat-booking', sbForm);
      setSbForm(data.seatBookingConfig);
      setSbMsg('Seat booking settings saved — applies immediately to new rides.');
    } catch (e) {
      setSbMsg(e.response?.data?.message || 'Save failed');
    } finally {
      setSbSaving(false);
    }
  };

  return (
    <div className="fade-in">
      <h2 style={{ marginTop: 0 }}>⚙️ Settings</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Route, pricing, time and surge configuration. Changes apply immediately to new rides.
        Existing rides keep their locked-in fare.
      </p>

      {msg && <div className={`alert mb ${msg.includes('Invalid') ? 'alert-warn' : 'alert-green'}`}>{msg}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
        {SECTIONS.map((sec) => (
          <div className="card" key={sec.title}>
            <h3 style={{ margin: '0 0 2px' }}>{sec.title}</h3>
            <p className="small muted" style={{ margin: '0 0 12px' }}>{sec.desc}</p>
            {sec.fields.map((f) => (
              <div className="field" key={f.key}>
                <label htmlFor={`f-${f.key}`}>{f.label}</label>
                <input
                  id={`f-${f.key}`}
                  className="input"
                  type="number"
                  step="any"
                  min="0"
                  value={form[f.key] ?? ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: 16, maxWidth: 600 }}>
        <button className="btn btn-primary" disabled={saving} onClick={() => submit(form)}>
          {saving ? 'Saving…' : 'Save all settings'}
        </button>
        <button className="btn btn-ghost" disabled={saving} onClick={resetToDefaults}>
          Reset to defaults
        </button>
      </div>

      {/* --- Feedback / Review Configuration --- */}
      <h2 style={{ marginTop: 32 }}>💬 Rider Review & Feedback</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Configure the rider review panel. Enable/disable, set discount amount, choose required fields and customise labels.
      </p>

      {fbMsg && <div className={`alert mb ${fbMsg.includes('fail') ? 'alert-warn' : 'alert-green'}`}>{fbMsg}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
        <div className="card">
          <h3 style={{ margin: '0 0 2px' }}>🎛 General</h3>
          <p className="small muted" style={{ margin: '0 0 12px' }}>Turn the review panel on or off and set the discount reward.</p>
          <div className="field">
            <label htmlFor="fb-enabled">Enable rider review panel</label>
            <select
              id="fb-enabled"
              className="input"
              value={fbForm.enabled ? 'true' : 'false'}
              onChange={(e) => setFbField('enabled', e.target.value === 'true')}
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="fb-discountAmount">Discount amount (₹)</label>
            <input
              id="fb-discountAmount"
              className="input"
              type="number"
              step="1"
              min="0"
              value={fbForm.discountAmount ?? 10}
              onChange={(e) => setFbField('discountAmount', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 2px' }}>📝 Required Fields</h3>
          <p className="small muted" style={{ margin: '0 0 12px' }}>Choose which feedback fields are mandatory. All required fields must be filled to get the discount.</p>
          {[
            { key: 'requireDriverFeedback', label: 'Driver feedback required' },
            { key: 'requireDistanceFeedback', label: 'Travel distance feedback required' },
            { key: 'requireTimeFeedback', label: 'Travel time feedback required' },
          ].map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={`fb-${f.key}`}>{f.label}</label>
              <select
                id={`fb-${f.key}`}
                className="input"
                value={fbForm[f.key] ? 'true' : 'false'}
                onChange={(e) => setFbField(f.key, e.target.value === 'true')}
              >
                <option value="true">Required</option>
                <option value="false">Optional</option>
              </select>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 2px' }}>🏷 Labels & Placeholders</h3>
          <p className="small muted" style={{ margin: '0 0 12px' }}>Customise the text riders see in the review form.</p>
          {[
            { key: 'driverFeedbackLabel', label: 'Driver feedback label' },
            { key: 'driverFeedbackPlaceholder', label: 'Driver feedback placeholder' },
            { key: 'distanceFeedbackLabel', label: 'Distance feedback label' },
            { key: 'distanceFeedbackPlaceholder', label: 'Distance feedback placeholder' },
            { key: 'timeFeedbackLabel', label: 'Time feedback label' },
            { key: 'timeFeedbackPlaceholder', label: 'Time feedback placeholder' },
          ].map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={`fb-${f.key}`}>{f.label}</label>
              <input
                id={`fb-${f.key}`}
                className="input"
                type="text"
                value={fbForm[f.key] ?? ''}
                onChange={(e) => setFbField(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 2px' }}>💬 Messages</h3>
          <p className="small muted" style={{ margin: '0 0 12px' }}>Customise success messages. Use {'{amount}'} for discount amount.</p>
          {[
            { key: 'successMessage', label: 'Success message (no discount)' },
            { key: 'discountMessage', label: 'Discount message (use {amount})' },
          ].map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={`fb-${f.key}`}>{f.label}</label>
              <input
                id={`fb-${f.key}`}
                className="input"
                type="text"
                value={fbForm[f.key] ?? ''}
                onChange={(e) => setFbField(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="row" style={{ marginTop: 16, maxWidth: 600 }}>
        <button className="btn btn-primary" disabled={fbSaving} onClick={submitFeedback}>
          {fbSaving ? 'Saving…' : 'Save feedback settings'}
        </button>
        <button className="btn btn-ghost" disabled={fbSaving} onClick={() => setFbForm(FEEDBACK_DEFAULTS)}>
          Reset to defaults
        </button>
      </div>

      {/* --- UPI Payment Configuration --- */}
      <h2 style={{ marginTop: 32 }}>💳 UPI Payment</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Configure UPI payment collection. Riders will see a QR code and can pay directly via any UPI app.
      </p>

      {upiMsg && <div className={`alert mb ${upiMsg.includes('fail') ? 'alert-warn' : 'alert-green'}`}>{upiMsg}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
        <div className="card">
          <h3 style={{ margin: '0 0 2px' }}>🏦 UPI Details</h3>
          <p className="small muted" style={{ margin: '0 0 12px' }}>Your UPI payment address and display name.</p>
          <div className="field">
            <label htmlFor="upi-enabled">Enable UPI payment</label>
            <select
              id="upi-enabled"
              className="input"
              value={upiForm.enabled ? 'true' : 'false'}
              onChange={(e) => setUpiField('enabled', e.target.value === 'true')}
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="upi-id">UPI ID (VPA)</label>
            <input
              id="upi-id"
              className="input"
              type="text"
              placeholder="yourname@bank"
              value={upiForm.upiId ?? ''}
              onChange={(e) => setUpiField('upiId', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="upi-merchant">Merchant / Display Name</label>
            <input
              id="upi-merchant"
              className="input"
              type="text"
              placeholder="Super Toto Local"
              value={upiForm.merchantName ?? ''}
              onChange={(e) => setUpiField('merchantName', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="upi-showQr">Show QR code on payment screen</label>
            <select
              id="upi-showQr"
              className="input"
              value={upiForm.showQr ? 'true' : 'false'}
              onChange={(e) => setUpiField('showQr', e.target.value === 'true')}
            >
              <option value="true">Show QR</option>
              <option value="false">Hide QR</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="upi-instructions">Payment instructions</label>
            <input
              id="upi-instructions"
              className="input"
              type="text"
              placeholder="Scan the QR or tap the button to pay"
              value={upiForm.instructions ?? ''}
              onChange={(e) => setUpiField('instructions', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 16, maxWidth: 600 }}>
        <button className="btn btn-primary" disabled={upiSaving} onClick={submitUpi}>
          {upiSaving ? 'Saving…' : 'Save UPI settings'}
        </button>
        <button className="btn btn-ghost" disabled={upiSaving} onClick={() => setUpiForm({ upiId: 'anilmandal27@okhdfcbank', merchantName: 'Super Toto Local', enabled: true, showQr: true, instructions: 'Scan the QR or tap the button below to pay via any UPI app.' })}>
          Reset to defaults
        </button>
      </div>

      {/* --- Contact & Helpline Configuration --- */}
      <h2 style={{ marginTop: 32 }}>🆘 Contact & Helpline</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Set the emergency helpline number shown to riders and drivers. The helpline button is always visible in the top bar.
      </p>

      {contactMsg && <div className={`alert mb ${contactMsg.includes('fail') ? 'alert-warn' : 'alert-green'}`}>{contactMsg}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
        <div className="card">
          <h3 style={{ margin: '0 0 2px' }}>📞 Helpline</h3>
          <p className="small muted" style={{ margin: '0 0 12px' }}>Riders/drivers tap this to call you immediately in an emergency.</p>
          <div className="field">
            <label htmlFor="contact-showHelpline">Show helpline button</label>
            <select
              id="contact-showHelpline"
              className="input"
              value={contactForm.showHelpline ? 'true' : 'false'}
              onChange={(e) => setContactField('showHelpline', e.target.value === 'true')}
            >
              <option value="true">Visible</option>
              <option value="false">Hidden</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="contact-helplinePhone">Helpline phone number</label>
            <input
              id="contact-helplinePhone"
              className="input"
              type="text"
              placeholder="+91XXXXXXXXXX"
              value={contactForm.helplinePhone ?? ''}
              onChange={(e) => setContactField('helplinePhone', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="contact-helplineLabel">Helpline label</label>
            <input
              id="contact-helplineLabel"
              className="input"
              type="text"
              placeholder="24×7 Helpline"
              value={contactForm.helplineLabel ?? ''}
              onChange={(e) => setContactField('helplineLabel', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="contact-whatsapp">WhatsApp number</label>
            <input
              id="contact-whatsapp"
              className="input"
              type="text"
              placeholder="+91XXXXXXXXXX"
              value={contactForm.whatsapp ?? ''}
              onChange={(e) => setContactField('whatsapp', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="contact-email">Support email</label>
            <input
              id="contact-email"
              className="input"
              type="text"
              placeholder="support@example.com"
              value={contactForm.email ?? ''}
              onChange={(e) => setContactField('email', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 16, maxWidth: 600 }}>
        <button className="btn btn-primary" disabled={contactSaving} onClick={submitContact}>
          {contactSaving ? 'Saving…' : 'Save contact settings'}
        </button>
        <button className="btn btn-ghost" disabled={contactSaving} onClick={() => setContactForm({ helplinePhone: '+919811997286', helplineLabel: '24×7 Helpline', email: 'tsaenterprisesindia@gmail.com', whatsapp: '+919811997286', showHelpline: true })}>
          Reset to defaults
        </button>
      </div>

      {/* --- Seat Booking Configuration --- */}
      <h2 style={{ marginTop: 32 }}>🪑 Seat Booking (reserved seats)</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Choose how seat booking works. <b>SHARED</b>: riders book 1+ seats on a trip and pay only for
        those seats; other riders can join empty seats. <b>RESERVED</b>: a rider reserves the whole
        vehicle and pays the full trip fare — nobody else can join. <b>OFF</b>: every ride is billed
        as a whole-trip (single passenger) booking.
      </p>

      {sbMsg && <div className={`alert mb ${sbMsg.includes('fail') ? 'alert-warn' : 'alert-green'}`}>{sbMsg}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
        <div className="card">
          <h3 style={{ margin: '0 0 2px' }}>🎛 Status</h3>
          <p className="small muted" style={{ margin: '0 0 12px' }}>Applies immediately to new rides. Existing rides keep their current booking.</p>
          <div className="field">
            <label htmlFor="sb-mode">Seat booking mode</label>
            <select
              id="sb-mode"
              className="input"
              value={sbForm.mode || 'shared'}
              onChange={(e) => setSbField('mode', e.target.value)}
            >
              <option value="shared">SHARED — per-seat booking, riders can join empty seats</option>
              <option value="reserved">RESERVED — whole vehicle, rider pays the full trip fare</option>
              <option value="off">OFF — no seat booking, whole-trip only</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="sb-message">Notice shown to riders (optional)</label>
            <input
              id="sb-message"
              className="input"
              type="text"
              placeholder="Seat booking is under maintenance. Please book a whole trip."
              value={sbForm.message ?? ''}
              onChange={(e) => setSbField('message', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 16, maxWidth: 600 }}>
        <button className="btn btn-primary" disabled={sbSaving} onClick={submitSeatBooking}>
          {sbSaving ? 'Saving…' : 'Save seat booking settings'}
        </button>
        <button className="btn btn-ghost" disabled={sbSaving} onClick={() => setSbForm({ mode: 'shared', message: '' })}>
          Reset to SHARED
        </button>
      </div>

      {/* --- Chatbot Configuration --- */}
      <h2 style={{ marginTop: 32 }}>🤖 Chat Assistant</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Configure the in-app chat assistant (Toto Assist). It answers questions about fares, booking, payments, safety and more — and understands live fare estimates.
      </p>

      {cbMsg && <div className={`alert mb ${cbMsg.includes('fail') ? 'alert-warn' : 'alert-green'}`}>{cbMsg}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
        <div className="card">
          <h3 style={{ margin: '0 0 2px' }}>🎛 General</h3>
          <p className="small muted" style={{ margin: '0 0 12px' }}>Turn the assistant on/off, set its name and default replies.</p>
          <div className="field">
            <label htmlFor="cb-enabled">Enable chat assistant</label>
            <select
              id="cb-enabled"
              className="input"
              value={cbForm.enabled ? 'true' : 'false'}
              onChange={(e) => setCbField('enabled', e.target.value === 'true')}
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="cb-botName">Bot name</label>
            <input
              id="cb-botName"
              className="input"
              type="text"
              placeholder="Toto Assist"
              value={cbForm.botName ?? ''}
              onChange={(e) => setCbField('botName', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="cb-greeting">Greeting message (first message)</label>
            <textarea
              id="cb-greeting"
              className="input"
              rows={2}
              placeholder="Hi! How can I help you?"
              value={cbForm.greeting ?? ''}
              onChange={(e) => setCbField('greeting', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="cb-helpText">Help message (when user types "help")</label>
            <textarea
              id="cb-helpText"
              className="input"
              rows={4}
              placeholder="I can help you with..."
              value={cbForm.helpText ?? ''}
              onChange={(e) => setCbField('helpText', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="cb-fallback">Fallback reply (unknown questions)</label>
            <textarea
              id="cb-fallback"
              className="input"
              rows={2}
              placeholder="Sorry, I don't understand..."
              value={cbForm.fallback ?? ''}
              onChange={(e) => setCbField('fallback', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="cb-quickReplies">Quick reply buttons (comma separated)</label>
            <input
              id="cb-quickReplies"
              className="input"
              type="text"
              placeholder="💰 Fares, 🚕 How to book?, 💳 Payments"
              value={(cbForm.quickReplies || []).join(', ')}
              onChange={(e) => setCbField('quickReplies', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            />
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 16, maxWidth: 600 }}>
        <button className="btn btn-primary" disabled={cbSaving} onClick={submitChatbot}>
          {cbSaving ? 'Saving…' : 'Save chatbot settings'}
        </button>
        <button className="btn btn-ghost" disabled={cbSaving} onClick={() => setCbForm({
          enabled: true,
          botName: 'Toto Assist',
          greeting: 'Hi! 👋 I am Toto Assist, your Super Toto Local helper. Ask me about fares, booking, payments, safety or anything else!',
          fallback: 'I am not sure about that yet 😅. Try asking about fares, booking a ride, payments, safety, or type "help" for options.',
          helpText: 'I can help you with:\n\n💰 Fares & pricing\n🚕 Booking a ride\n🛺 Vehicle types\n💳 Payments (UPI, Cash)\n🛡️ Safety & emergency\n🧳 Luggage & passengers\n❌ Cancellations',
          quickReplies: ['💰 Fares', '🚕 How to book?', '💳 Payments', '🛡️ Safety', '🧳 Luggage', '❌ Cancellation'],
        })}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
