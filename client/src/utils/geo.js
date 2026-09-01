export function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return 0;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function moveToward(from, to, stepKm) {
  if (!from || !to) return from;
  const d = haversineKm(from, to);
  if (d < stepKm) return to;
  const f = stepKm / d;
  return {
    lat: from.lat + (to.lat - from.lat) * f,
    lng: from.lng + (to.lng - from.lng) * f,
  };
}

export function jitter(base, radius = 0.003) {
  const ang = Math.random() * Math.PI * 2;
  const dist = Math.random() * radius;
  return {
    lat: base.lat + dist * Math.cos(ang),
    lng: base.lng + dist * Math.sin(ang),
  };
}

export function formatINR(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

export const PAYMENT_METHODS = [
  { id: 'UPI', label: 'UPI', icon: '📱' },
  { id: 'Cash', label: 'Cash', icon: '💵' },
  { id: 'Card', label: 'Card', icon: '💳' },
];

export function formatTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(d) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const DESTINATIONS = [
  { name: 'Katihar Railway Station', lat: 25.5415, lng: 87.5763 },
  { name: 'Mahavir Colony', lat: 25.5448, lng: 87.5587 },
  { name: 'Kumaripara', lat: 25.5388, lng: 87.5712 },
  { name: 'Bhawanipur', lat: 25.5518, lng: 87.5633 },
  { name: 'Tilak Jyanti Nagar', lat: 25.5298, lng: 87.5641 },
  { name: 'Kadaghat', lat: 25.5333, lng: 87.5812 },
  { name: 'Barari Bazaar', lat: 25.5472, lng: 87.5705 },
  { name: 'Kurji', lat: 25.5568, lng: 87.5778 },
  { name: 'Azimabad', lat: 25.5212, lng: 87.5598 },
  { name: 'Sonbarsa', lat: 25.5602, lng: 87.5642 },
  { name: 'Manihari', lat: 25.3396, lng: 87.6147 },
  { name: 'Korha', lat: 25.4443, lng: 87.4868 },
  { name: 'Balrampur', lat: 25.6103, lng: 87.6492 },
  { name: 'Dandkhora', lat: 25.4782, lng: 87.5374 },
  { name: 'Hasanganj', lat: 25.5802, lng: 87.5298 },
];

export const STATUS_LABELS = {
  reserved: 'Reserved (not dispatched)',
  requested: 'Searching for a toto',
  assigned: 'Driver assigned',
  driver_arrived: 'Driver arrived at pickup',
  in_progress: 'On the way',
  completed: 'Ride completed',
  cancelled_by_rider: 'Cancelled by rider',
  cancelled_by_driver: 'Cancelled by driver',
  no_driver: 'No driver available',
};
