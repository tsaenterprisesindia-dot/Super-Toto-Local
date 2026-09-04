// GST invoice builder (compliance with the Central Goods & Services Tax Act, 2017).
// Produces a readable, GST-compliant invoice object from a Ride record + compliance config.
//
// Model: commission-based ride-hailing aggregator (ECO) under Section 9(5) CGST Act.
//  - The platform is the supplier liable for GST on passenger transport supplied
//    through it (Notification 11/2017-CT(R) & 17/2017-CT(R), reading Sec 9(5)).
//  - GST is charged to the passenger on the fare at 5%:
//      intra-state: CGST 2.5% + SGST 2.5%
//      inter-state: IGST 5%
//  - SAC for road passenger transport: 9964.

const INTRA_CGST_RATE = 0.025; // 2.5% each
const INTRA_SGST_RATE = 0.025;
const INTER_IGST_RATE = 0.05; // 5%

// Map a state NAME ("Delhi") or CODE ("DL") to a canonical CODE for comparison.
const STATE_ALIAS = {
  AP: 'ANDHRA PRADESH', AR: 'ARUNACHAL PRADESH', AS: 'ASSAM', BR: 'BIHAR', CG: 'CHHATTISGARH',
  GA: 'GOA', GJ: 'GUJARAT', HR: 'HARYANA', HP: 'HIMACHAL PRADESH', JH: 'JHARKHAND', KA: 'KARNATAKA',
  KL: 'KERALA', MP: 'MADHYA PRADESH', MH: 'MAHARASHTRA', MN: 'MANIPUR', ML: 'MEGHALAYA', MZ: 'MIZORAM',
  NL: 'NAGALAND', OD: 'ODISHA', PB: 'PUNJAB', RJ: 'RAJASTHAN', SK: 'SIKKIM', TN: 'TAMIL NADU',
  TS: 'TELANGANA', TR: 'TRIPURA', UP: 'UTTAR PRADESH', UK: 'UTTARAKHAND', WB: 'WEST BENGAL',
  AN: 'ANDAMAN & NICOBAR', CH: 'CHANDIGARH', DD: 'DNH & DAMAN-DIU', DL: 'DELHI', JK: 'JAMMU & KASHMIR',
  LA: 'LADAKH', LD: 'LAKSHADWEEP', PY: 'PUDUCHERRY',
};
function stateCode(v) {
  const s = String(v || '').trim().toUpperCase();
  if (!s) return '';
  if (STATE_ALIAS[s]) return s; // already a code
  const hit = Object.entries(STATE_ALIAS).find(([, name]) => name === s);
  return hit ? hit[0] : '';
}

export function buildGstInvoice(ride, compliance = {}) {
  const fb = ride.fareBreakup || {};
  const billed = Math.round(ride.payment?.amount || ride.fare || fb.total || 0);
  const gross = Math.round(fb.gross || billed - (fb.gst || 0));
  const gst = Math.round(fb.gst || gross * INTER_IGST_RATE);

  // Intrastate if the trip's state matches the operator's registered state.
  // Prefer the split stored at calculation time; otherwise recompute from code-normalised states.
  const opCode = stateCode(compliance.operatingState);
  const tripCode = stateCode(ride.stateCode || ride.farePolicy?.stateCode) || stateCode(ride.stateName || ride.farePolicy?.stateName);
  const isIntra =
    fb.supplyType != null
      ? fb.supplyType !== 'inter' // stored value is authoritative
      : !opCode || !tripCode || opCode === tripCode; // unknown trip state => intra

  const cgstRate = INTRA_CGST_RATE;
  const sgstRate = INTRA_SGST_RATE;
  const igstRate = INTER_IGST_RATE;

  // Use the tax split stored at calculation time (automatic), falling back to recompute.
  const cgst = fb.cgst != null ? Math.round(fb.cgst) : isIntra ? Math.round(gst / 2) : 0;
  const sgst = fb.sgst != null ? Math.round(fb.sgst) : gst - cgst;
  const igst = fb.igst != null ? Math.round(fb.igst) : isIntra ? 0 : gst;

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
      address: compliance.legalAddress || '',
      state: compliance.operatingState || '—',
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
      placeOfSupply: ride.stateName || ride.farePolicy?.stateName || ride.stateCode || '—',
    },
    item: label(ride.status),
    supply: {
      isIntra,
      sac: '9964',
      gstRatePct: 5,
      cgstRatePct: INTRA_CGST_RATE * 100,
      sgstRatePct: INTRA_SGST_RATE * 100,
      igstRatePct: INTER_IGST_RATE * 100,
      cgst,
      sgst,
      igst,
      gstTotal: gst,
    },
    breakup: {
      base: fb.base || 0,
      distance: fb.distance || 0,
      time: fb.time || 0,
      luggage: fb.luggage || 0,
      surgeMultiplier: fb.surge || 1,
      subtotal: fb.subtotal || 0,
      gross: fb.gross || gross,
      gstRatePct: fb.gstRatePct || 5,
      gst,
      cgst,
      sgst,
      igst,
      commission: fb.commission || 0,
      driverEarnings: fb.driverEarnings || 0,
      total: fb.total || billed,
    },
    billed,
    gstTitle: isIntra ? 'GST (5%) · CGST 2.5% + SGST 2.5%' : 'GST (5%) · IGST 5%',
    taxSplit: isIntra
      ? [{ label: 'CGST (2.5%)', value: cgst }, { label: 'SGST (2.5%)', value: sgst }]
      : [{ label: 'IGST (5%)', value: igst }],
    passengerInsurance:
      compliance.passengerInsuranceNote ||
      'Every trip includes passenger and third-party insurance coverage as required under the Motor Vehicles Act, 1988.',
    complianceNote:
      'GST payable under Section 9(5) of the CGST Act, 2017 — collected and remitted by the platform on behalf of the driver. Supply of road passenger transport (SAC 9964).',
  };
}