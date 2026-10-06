// Telephony gateway — outbound SMS + voice bridge for safety alerts.
//
// Provider-agnostic scaffold with two pluggable backends:
//   - "mock"   : no network; every call/SMS is logged and journaled so the
//                SOS flow can be tested end-to-end without an account.
//   - "twilio" : talks to the Twilio REST API over fetch (no SDK dependency).
//
// Credentials come from env vars (never commit them):
//   TELEPHONY_ENABLED            'true' / 'mock'     turn on the gateway
//   TELEPHONY_PROVIDER           'twilio' (default) | 'mock'
//   TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN
//   TELEPHONY_FROM  (or TWILIO_FROM)   the purchased DID/toll-free number
//   TELEPHONY_OPS_PHONE                monitoring-team number for the bridge
//   TELEPHONY_EMERGENCY_CONTACTS       comma-separated extra numbers to alert
//   TELEPHONY_TWIML_URL / TELEPHONY_TWIML   TwiML for the outbound voice call
//   PUBLIC_URL                            site root used in SMS track links
//
// IMPORTANT: India's emergency numbers (112/100/108) are carrier-controlled
// and CANNOT be dialed programmatically. The gateway alerts humans (ops /
// emergency contacts) — riders still use the in-app tel: one-tap dial buttons
// for the emergency numbers themselves.

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || '';
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || '';
const fromNumber = process.env.TELEPHONY_FROM || process.env.TWILIO_FROM || '';
const opsPhone = (process.env.TELEPHONY_OPS_PHONE || '').replace(/[\s-]/g, '');
const extraContacts = (process.env.TELEPHONY_EMERGENCY_CONTACTS || '')
  .split(',')
  .map((n) => n.trim().replace(/[\s-]/g, ''))
  .filter(Boolean);
const twimlUrl = process.env.TELEPHONY_TWIML_URL || '';
const twiml = process.env.TELEPHONY_TWIML || '';
export const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

// In-memory journal of everything emitted while the provider is "mock".
export const mockOutbox = [];

export function telephonyProvider() {
  if (process.env.TELEPHONY_ENABLED === 'mock') return 'mock';
  if (process.env.TELEPHONY_ENABLED === 'true' || process.env.TELEPHONY_ENABLED === '1') {
    return process.env.TELEPHONY_PROVIDER === 'mock' ? 'mock' : 'twilio';
  }
  if (process.env.TELEPHONY_PROVIDER === 'mock') return 'mock';
  if (process.env.TELEPHONY_PROVIDER) return 'twilio';
  return '';
}

export function telephonyEnabled() {
  return !!telephonyProvider();
}

function twilioHeaders() {
  const cred = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
  return {
    Authorization: `Basic ${cred}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

// Everything below is wrapped so a gateway failure NEVER breaks a request:
// callers just receive { ok:false, error }.
async function twilioPost(path, params) {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/${path}.json`, {
    method: 'POST',
    headers: twilioHeaders(),
    body: new URLSearchParams(params),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Twilio ${res.status}`);
  return json;
}

/**
 * Send an SMS. Mock mode never fails.
 * @returns {Promise<{ok:boolean, provider:string, id:string, to:string, error?:string}>}
 */
export async function sendSms({ to, body }) {
  to = String(to || '').trim();
  if (!to || !body) {
    return { ok: false, provider: telephonyProvider(), id: null, to, error: 'missing to/body' };
  }
  const provider = telephonyProvider();
  if (provider === 'mock') {
    const id = `SM-mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    mockOutbox.push({ kind: 'sms', id, to, body, at: new Date().toISOString() });
    console.log(`[telephony:mock] SMS -> ${to}: ${body.slice(0, 120)}`);
    return { ok: true, provider, id, to };
  }
  if (!twilioAccountSid || !twilioAuthToken || !fromNumber) {
    return { ok: false, provider, id: null, to, error: 'TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM not configured' };
  }
  try {
    const json = await twilioPost('Messages', { From: fromNumber, To: to, Body: body });
    return { ok: true, provider, id: json.sid, to, status: json.status };
  } catch (e) {
    console.error('[telephony] SMS failed:', e.message);
    return { ok: false, provider, id: null, to, error: e.message };
  }
}

/**
 * Place an outbound voice call (e.g. to the ops bridge). Twilio needs either a
 * TwiML URL or inline TwiML. Mock mode always succeeds.
 * @returns {Promise<{ok:boolean, provider:string, id:string, to:string, error?:string}>}
 */
export async function startCall({ to, message = 'Super Toto Local SOS. Please respond urgently.' }) {
  to = String(to || '').trim();
  if (!to) {
    return { ok: false, provider: telephonyProvider(), id: null, to, error: 'missing to' };
  }
  const provider = telephonyProvider();
  if (provider === 'mock') {
    const id = `CA-mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    mockOutbox.push({ kind: 'call', id, to, at: new Date().toISOString() });
    console.log(`[telephony:mock] CALL -> ${to} (${message.slice(0, 80)})`);
    return { ok: true, provider, id, to };
  }
  if (!twilioAccountSid || !twilioAuthToken || !fromNumber) {
    return { ok: false, provider, id: null, to, error: 'TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM not configured' };
  }
  const params = { From: fromNumber, To: to };
  if (twimlUrl) params.Url = twimlUrl;
  else if (twiml) params.Twiml = twiml;
  else if (message) {
    params.Twiml = `<Response><Say language="en-IN" voice="alice">${message.replace(/[<>&]/g, '')}</Say></Response>`;
  } else {
    return { ok: false, provider, id: null, to, error: 'no TwiML URL/body configured for voice' };
  }
  try {
    const json = await twilioPost('Calls', params);
    return { ok: true, provider, id: json.sid, to, status: json.status };
  } catch (e) {
    console.error('[telephony] CALL failed:', e.message);
    return { ok: false, provider, id: null, to, error: e.message };
  }
}

/**
 * Orchestrates an SOS alert: SMS the monitoring/emergency contacts and place a
 * voice call to the ops bridge. Fire-and-forget, never throws.
 *
 * @param {object} opts
 * @param {string} opts.riderName   rider display name
 * @param {string} [opts.riderPhone]  rider phone (bridged to ops)
 * @param {string} [opts.trackLink]   public tracking link included in SMS
 * @param {string} [opts.message]     optional rider note
 * @param {Array}  [opts.contacts]    phone numbers to alert (defaults to env)
 * @returns {Promise<{provider:string, sms:Array, calls:Array, detail:string}>}
 */
export async function sendEmergencyAlerts({ riderName = 'A rider', riderPhone, trackLink = '', message = '', contacts = [] }) {
  const provider = telephonyProvider();
  const targets = [...new Set([...(contacts || []), ...extraContacts, ...(opsPhone ? [opsPhone] : [])])]
    .map((n) => String(n).trim())
    .filter(Boolean);
  if (!provider) {
    return { provider: '', sms: [], calls: [], detail: 'telephony disabled' };
  }

  const body = [
    '🚨 SOS — Super Toto Local',
    `${riderName} pressed the emergency button during a ride.`,
    message ? `Note: ${message}` : null,
    trackLink ? `Live tracking: ${trackLink}` : null,
  ].filter(Boolean).join('\n');

  const sms = [];
  for (const to of targets) {
    if (to === opsPhone) continue; // the ops number gets the live call, not SMS noise
    const r = await sendSms({ to, body });
    if (r.ok) sms.push({ to, id: r.id });
  }

  const calls = [];
  if (opsPhone) {
    const c = await startCall({ to: opsPhone, message: `Super Toto Local SOS. ${riderName} pressed the emergency button. Please respond urgently.` });
    if (c.ok) calls.push({ to: opsPhone, id: c.id });
  }

  const detail = [
    `${targets.length} contact(s) targeted`,
    sms.length ? `${sms.length} SMS queued` : 'no SMS queued',
    calls.length ? `${calls.length} call initiated` : 'no call (ops number unset)',
  ].join(', ');
  return { provider, sms, calls, detail };
}

export default { telephonyEnabled, telephonyProvider, sendSms, startCall, sendEmergencyAlerts, mockOutbox, publicUrl };