import { getPricingConfig, getVehicleRatesConfig, getContactConfig, getSeatBookingConfig, SEAT_MODES } from '../services/settings.js';
import { VEHICLE_TYPES, computeFare, estimate } from './pricing.js';

const VEHICLE_KEYWORDS = {
  toto: ['toto', 'e-rickshaw', 'electric rickshaw', 'rickshaw'],
  auto: ['auto', 'autos', 'auto-rickshaw'],
  taxi: ['taxi', 'car'],
  bike: ['bike', 'bike taxi', 'motorcycle'],
};

function norm(text = '') {
  return text.toLowerCase().replace(/[^a-z0-9\s+@.]/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasAny(text, words) {
  return words.some((w) => text.includes(w));
}

function detectVehicle(text) {
  for (const [vid, words] of Object.entries(VEHICLE_KEYWORDS)) {
    if (hasAny(text, words)) return vid;
  }
  return null;
}

function detectDistance(text) {
  // patterns like "5 km", "3.5km", "ten km"
  const match = text.match(/(\d+(?:\.\d+)?)\s*km/);
  if (match) return Math.max(0.5, Number(match[1]));
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  for (const [w, n] of Object.entries(words)) {
    if (text.includes(`${w} km`)) return n;
  }
  return null;
}

export async function handleChatbotMessage(text, role = 'rider', config = {}) {
  const t = norm(text);
  const cfgs = await Promise.all([getPricingConfig(), getVehicleRatesConfig(), getContactConfig(), getSeatBookingConfig()]);
  const [pricing, vehicleRates, contact, seatCfg] = cfgs;
  const seatMode = SEAT_MODES.includes(seatCfg.mode) ? seatCfg.mode : 'shared';
  const botName = config.botName || 'Toto Assist';
  const vehicle = detectVehicle(t);
  const distance = detectDistance(t);

  const reply = (message, quickReplies = null) => ({ reply: message, quickReplies: quickReplies || config.quickReplies || [] });

  // ---------- Greetings ----------
  if (/^(hi|hello|hey|hola|namaste|greetings|good\s*(morning|afternoon|evening))/.test(t)) {
    return reply(`Hello! 👋 ${config.greeting || `I am ${botName}, your Super Toto Local helper.`}`);
  }
  if (hasAny(t, ['bye', 'goodbye', 'see you', 'thank', 'thanks', 'thank you so much', 'great thanks'])) {
    return reply('You are welcome! 😊 Have a safe ride! 🛺');
  }

  // ---------- Driver-specific BEFORE generic fare ----------
  if (role === 'driver' && hasAny(t, ['earning', 'earn', 'salary', 'money', 'commission', 'settle', 'wallet', 'balance', 'payout', 'withdraw'])) {
    return reply(
      `💰 **Driver earnings:**\n\n` +
        `• You get the fare minus a ${(pricing.commissionRate * 100).toFixed(0)}% platform commission\n` +
        `• 100% cash collected stays with you (settle online)\n` +
        `• Track your net earnings on the dashboard & My Rides\n\n` +
        `Keep your status online to get more ride requests!`,
      ['🛡️ Safety', '📞 Help']
    );
  }

  // ---------- Doc upload (driver) ----------
  if (role === 'driver' && hasAny(t, ['document', 'upload', 'verify', 'insurance', 'puc', 'aadhaar', 'license'])) {
    return reply(
      '🗂 **Driver documents:**\n\n' +
        'Upload these in **My profile → Documents**:\n' +
        '• Aadhaar (auto-verified)\n' +
        '• RC / Registration\n' +
        '• Driving License\n' +
        '• Bank details\n' +
        '• Photo\n' +
        '• Insurance & PUC (for bike taxi)\n\n' +
        'Documents are reviewed by the admin before you can take rides.'
    );
  }

  // ---------- Help ----------
  if ((t === 'help') || hasAny(t, ['what can you do', 'options', 'menu', 'commands'])) {
    return reply(config.helpText || 'Try asking about fares, booking, payments, safety, luggage or cancellations.');
  }

  // ---------- Helpline / contact ----------
  if (hasAny(t, ['helpline', 'call', 'contact', 'support', 'help line', 'reach you', 'phone', 'emergency', 'sos', 'complaint', 'problem', 'issue', 'not working', 'assistance', 'human'])) {
    return reply(
      `🆘 **Helpline & Support:**\n\n` +
        `• Helpline: **${contact.helplinePhone}**\n` +
        `• WhatsApp: **${contact.whatsapp}**\n` +
        `• Email: **${contact.email}**\n\n` +
        `Tap the 🆘 button in the top bar to call us immediately in an emergency.`,
      ['🛡️ Safety', '💰 Fares']
    );
  }

  // ---------- Fare / Pricing ----------
  if (hasAny(t, ['fare', 'price', 'cost', 'charge', 'how much', 'rate', 'expensive', 'pricing', 'estimate', 'estimate fare', 'bill'])) {
    const vid = vehicle || 'toto';
    const rates = vehicleRates[vid];
    let msg = '';
    if (distance) {
      const est = computeFare(distance, estimate(distance, { avgSpeedKmh: rates.avgSpeedKmh }).durationMin, 1, {
        base: rates.base,
        perKm: rates.perKm,
        perMin: rates.perMin,
        minimum: rates.minimum,
        gstRate: pricing.gstRate,
        commissionRate: pricing.commissionRate,
      }, 0, 1);
      const vtLabel = VEHICLE_TYPES.find((x) => x.id === vid)?.label || vid;
      const timeMin = estimate(distance, { avgSpeedKmh: rates.avgSpeedKmh }).durationMin;
      const seatCount = Math.max(1, Math.round(rates.seatCount || 1));
      const perSeat = Math.max(1, Math.round(est.total / seatCount));
      if (seatMode === 'reserved') {
        msg = `🚕 Estimated fare for a ${distance} km ride by **${vtLabel}** (reserved):\n\n` +
          `• The ${vtLabel} has ${seatCount} seat${seatCount > 1 ? 's' : ''}\n` +
          `• **Whole vehicle: ₹${est.total}**\n` +
          `• You reserve the whole vehicle — you pay the full trip fare\n\n` +
          `Prices may vary with surge and luggage. Want me to estimate another distance?`;
      } else {
        msg = `🚕 Estimated fare for a ${distance} km ride by **${vtLabel}** (shared trip):\n\n` +
          `• Trip fare (whole vehicle): ₹${est.total}\n` +
          `• The vehicle has ${seatCount} seat${seatCount > 1 ? 's' : ''}\n` +
          `• **Per seat: ₹${perSeat}**\n` +
          `• You only pay for the seats you book\n\n` +
          `Example: 2 seats = ₹${perSeat * 2}. Prices may vary with surge and luggage. Want me to estimate another distance?`;
      }
    } else {
      const vtLabel = VEHICLE_TYPES.find((x) => x.id === vid)?.label || vid;
      msg = `💰 **${vtLabel} fares:**\n` +
        `• Base fare: ₹${rates.base}\n` +
        `• Per km: ₹${rates.perKm}\n` +
        `• Per min: ₹${rates.perMin}\n` +
        `• Minimum fare: ₹${rates.minimum}\n\n` +
        `Tell me a distance (e.g. "fare for 5 km") and I will estimate the total for you!`;
    }
    return reply(msg, ['💰 Fare for 5 km', '💰 Auto fare', '💰 Bike fare']);
  }

  // ---------- Vehicle types ----------
  if (hasAny(t, ['vehicle', 'what vehicles', 'types', 'kind', 'vehicle type', 'available']) || vehicle) {
    const lines = VEHICLE_TYPES.map((vt) => {
      const r = vehicleRates[vt.id];
      return `• ${vt.label}: ₹${r.base} base, ₹${r.perKm}/km, ₹${r.minimum} min`;
    });
    return reply(`🛺 We have these vehicles:\n\n${lines.join('\n')}\n\nTap a vehicle to see details.`, ['💰 Fares', '🚕 How to book?']);
  }

  // ---------- Booking ----------
  if (hasAny(t, ['book', 'booking', 'ride', 'how to book', 'request', 'find toto', 'get a ride', 'order', 'cab', 'pickup', 'pick up'])) {
    if (role === 'driver') return reply('You are a driver! 🛺 To accept rides, just keep your status online on your dashboard and ride requests will pop up automatically.');
    if (role === 'admin') return reply('You are an admin! 📊 Use the admin console to manage drivers, riders, rides and settings.');
    return reply(
      '🚕 Booking a ride is easy:\n\n' +
        '1️⃣ Go to **Book a toto**\n' +
        '2️⃣ Choose your pickup location & destination\n' +
        '3️⃣ Select vehicle type (Toto, Auto, Taxi, Bike)\n' +
        '4️⃣ Tap **Request** — nearby drivers get your request\n' +
        '5️⃣ Your driver arrives. Enjoy the ride!\n\n' +
        'You can pay by UPI, Cash or Card after the trip.'
    );
  }

  // ---------- Payments / UPI ----------
  if (hasAny(t, ['pay', 'payment', 'upi', 'cash', 'cashless', 'card', 'money', 'payments', 'qr', 'scan'])) {
    if (hasAny(t, ['upi', 'qr', 'scan'])) {
      return reply(
        `💳 **UPI Payment:**\n\n` +
          `After your trip, choose **UPI** and a QR code + UPI link will appear on screen.\n\n` +
          `1️⃣ Open the QR with any UPI app\n` +
          `2️⃣ Or tap "Open UPI App"\n` +
          `3️⃣ Complete the payment\n` +
          `4️⃣ Tap "I've paid"\n\n` +
          `UPI ID: **${contact.helplinePhone || 'anilmandal27@okhdfcbank'}** (or as shown on the QR)`,
        ['💳 Payments', '💰 Fares']
      );
    }
    return reply(
      '💳 We accept **UPI**, **Cash** and **Card**:\n\n' +
        '• **UPI** — Scan the QR or tap the UPI link in the app (GPay, PhonePe, Paytm)\n' +
        '• **Cash** — Hand over cash to your driver, they confirm collection\n' +
        '• **Card** — Simulated in the current demo\n\n' +
        'Cash is a great option for a quick local toto ride!'
    );
  }

  // ---------- Helpline / contact ----------
  if (hasAny(t, ['helpline', 'call', 'contact', 'support', 'help line', 'reach you', 'phone', 'emergency', 'sos', 'complaint', 'problem', 'issue', 'not working', 'assistance'])) {
    return reply(
      `🆘 **Helpline & Support:**\n\n` +
        `• Helpline: **${contact.helplinePhone}**\n` +
        `• WhatsApp: **${contact.whatsapp}**\n` +
        `• Email: **${contact.email}**\n\n` +
        `Tap the 🆘 button in the top bar to call us immediately in an emergency.`,
      ['🛡️ Safety', '💰 Fares']
    );
  }

  // ---------- Safety ----------
  if (hasAny(t, ['safe', 'safety', 'secure', 'track', 'live location', 'emergency'])) {
    return reply(
      '🛡️ **Your safety matters:**\n\n' +
        '• 🆘 Emergency helpline is one tap away in the top bar\n' +
        '• 📍 Your ride is tracked live throughout the trip\n' +
        '• 🧑‍🦱 Drivers are verified with Aadhaar & documents\n' +
        '• ⭐ You can rate and review your driver after every trip\n' +
        '• 🪖 Check our Safety Tips section for more\n\n' +
        'Always check the vehicle & driver details before boarding.'
    );
  }

  // ---------- Luggage & passengers ----------
  if (hasAny(t, ['luggage', 'bag', 'suitcase', 'heavy', 'carry', 'load'])) {
    return reply(
      `🧳 **Luggage policy:**\n\n` +
        `• ${pricing.freeLuggageItems} item(s) free per ride\n` +
        `• Up to ${pricing.freeLuggageWeightKg} kg per item free\n` +
        `• Extra bag: ₹${pricing.extraLuggageFee}\n` +
        `• Heavy item (>${pricing.heavyLuggageWeightKg} kg): ₹${pricing.heavyLuggageFee}\n\n` +
        `You can add luggage when booking the ride.`,
      ['💰 Fares', '🧳 Luggage']
    );
  }
  if (hasAny(t, ['passenger', 'child', 'kid', 'children', 'people', 'person', 'how many', 'seat'])) {
    return reply(
      `👨‍👩‍👧‍👦 **Passengers:**\n\n` +
        `• Adults are charged the base fare\n` +
        `• Children under 7 ride **free** (up to ${pricing.freeChildCount} per ride)\n` +
        `• Max 6 adults per ride\n\n` +
        `Select passenger count when booking.`,
      ['🚕 How to book?', '💰 Fares']
    );
  }

  // ---------- Cancellation ----------
  if (hasAny(t, ['cancel', 'cancellation', 'cancel ride'])) {
    return reply(
      `❌ **Cancellation policy:**\n\n` +
        `• Free to cancel **before** a driver accepts\n` +
        `• After a driver accepts: ₹${pricing.cancellationFee} fee applies\n` +
        `• Pay the fee from My Rides\n\n` +
        `Only cancel if really needed — your driver may already be on the way!`,
      ['🚕 How to book?', '💰 Fares']
    );
  }

  // ---------- Admin-specific ----------
  if (role === 'admin') {
    if (hasAny(t, ['report', 'stat', 'analytics', 'overview', 'dashboard', 'earnings', 'revenue', 'user', 'driver count'])) {
      return reply(
        '📊 **Admin console:**\n\n' +
          '• **Overview** — revenue, payments, active stats\n' +
          '• **Drivers/Riders** — manage & verify users\n' +
          '• **Rides** — track all trips & payments\n' +
          '• **Reports** — financial summaries & exports\n' +
          '• **Vehicle Rates / Settings** — configure fares & policies\n\n' +
          'Use the left sidebar to navigate.'
      );
    }
  }

  // ---------- Fallback ----------
  return reply(config.fallback || `I am not sure about that yet 😅. Try "help" to see what I can do.`);
}