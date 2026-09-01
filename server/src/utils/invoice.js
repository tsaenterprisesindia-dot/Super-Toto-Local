// GST invoice builder (compliance with the Central Goods & Services Tax Act, 2017).
// Produces a readable invoice object from a Ride record + compliance config.
export function buildGstInvoice(ride, compliance = {}) {
  const fb = ride.fareBreakup || {};
  const billed = Math.round(
    ride.payment?.amount || ride.fare || fb.total || 0
  );
  const gross = Math.round(fb.gross || billed - (fb.gst || 0));
  const gst = Math.round(fb.gst || bal(fb, billed - gross));
  const gstRate = gst > 0 ? Math.round((gst / Math.max(gross, 1)) * 10000) / 100 : 5;

  const label = (type) =>
    type === 'cancelled_by_rider' ? 'Cancellation fee' : 'Trip fare';

  return {
    invoiceNo: `STL-${String(ride._id).slice(-8).toUpperCase()}`,
    invoiceDate: new Date(
      ride.completedAt || ride.cancelledAt || ride.updatedAt || Date.now()
    ).toISOString(),
    issuer: {
      name: compliance.legalEntityName || 'TSA Enterprises',
      gstin: compliance.gstin || '—',
      insurancePolicyNo: compliance.insurancePolicyNo || '—',
    },
    trip: {
      id: String(ride._id),
      date: ride.completedAt || ride.cancelledAt || ride.createdAt,
      status: ride.status,
      vehicleType: ride.vehicleType,
      pickup: ride.pickup?.name || 'Pickup',
      drop: ride.drop?.name || 'Drop',
      distanceKm: ride.distanceKm,
      durationMin: ride.durationMin,
    },
    item: label(ride.status),
    breakup: {
      base: fb.base || 0,
      distance: fb.distance || 0,
      time: fb.time || 0,
      luggage: fb.luggage || 0,
      surgeMultiplier: fb.surge || 1,
      subtotal: fb.subtotal || 0,
      gross: fb.gross || gross,
      gstRatePct: gstRate,
      gst: gst,
      commission: fb.commission || 0,
      driverEarnings: fb.driverEarnings || 0,
      total: fb.total || billed,
    },
    billed,
    gstTitle: `GST (${gstRate}%)`,
    passengerInsurance: compliance.passengerInsuranceNote || '',
  };
}

function bal(fb, x) {
  return Math.max(0, Math.round(x));
}