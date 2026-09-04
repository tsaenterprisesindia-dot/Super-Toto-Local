import { formatINR } from './geo.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}

function row(label, value, bold) {
  return `<div class="row"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
}

export function printInvoice(invoice) {
  if (!invoice) return;
  const b = invoice.breakup || {};
  const rows = [
    row('Base fare', formatINR(b.base)),
    row(`Distance (${invoice.trip?.distanceKm || 0} km)`, formatINR(b.distance)),
    row(`Time (${invoice.trip?.durationMin || 0} min)`, formatINR(b.time)),
  ];
  if (b.luggage > 0) rows.push(row('Luggage', formatINR(b.luggage)));
  if ((b.gross || 0) - (b.subtotal || 0) > 0) {
    rows.push(row(`Surge x${b.surgeMultiplier || 1}`, formatINR((b.gross || 0) - (b.subtotal || 0))));
  }
  rows.push(row('Subtotal', formatINR(b.subtotal)));
  if (invoice.gstTitle) rows.push(row(invoice.gstTitle, ''));
  if ((invoice.supply?.cgst || 0) > 0) rows.push(row('CGST (2.5%)', formatINR(b.cgst || invoice.supply.cgst)));
  if ((invoice.supply?.sgst || 0) > 0) rows.push(row('SGST (2.5%)', formatINR(b.sgst || invoice.supply.sgst)));
  if ((invoice.supply?.igst || 0) > 0) rows.push(row('IGST (5%)', formatINR(b.igst || invoice.supply.igst)));
  rows.push(row('Total GST', formatINR(b.gst)));
  rows.push(row('Grand total', formatINR((b.gross || 0) + (b.gst || 0)), true));
  if (invoice.billed && invoice.billed !== (b.gross || 0) + (b.gst || 0)) {
    rows.push(row(invoice.item === 'Cancellation fee' ? 'Cancellation fee' : 'Amount paid', formatINR(invoice.billed)));
  }

  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) {
    alert('Please allow pop-ups to download the invoice');
    return;
  }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(invoice.invoiceNo)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; padding: 24px; font-size: 14px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; }
  h1 { font-size: 18px; }
  .muted { color: #555; font-size: 12px; }
  .box { border: 1px solid #ccc; border-radius: 8px; padding: 14px; margin-top: 16px; }
  .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted #ddd; }
  .row b { font-weight: 700; }
  .total { border-bottom: none; border-top: 2px solid #111; margin-top: 6px; font-size: 15px; }
  .badge { display: inline-block; background: #e8f5e9; color: #1e7d32; border-radius: 10px; padding: 2px 10px; font-size: 12px; }
  .foot { margin-top: 20px; font-size: 11px; color: #777; text-align: center; }
  @media print { body { padding: 8px; } }
</style></head><body>
  <div class="head">
    <div>
      <h1>GST Invoice</h1>
      <div class="muted">${esc(invoice.issuer?.name)}</div>
      <div class="muted">GSTIN: ${esc(invoice.issuer?.gstin || '—')}</div>
      <div class="muted">Place of supply: ${esc(invoice.trip?.placeOfSupply || '—')} · SAC ${esc(invoice.supply?.sac || '9964')}</div>
      <div class="muted">Registered state: ${esc(invoice.issuer?.state || '—')}</div>
      <div class="muted">Insurance Policy: ${esc(invoice.issuer?.insurancePolicyNo || '—')}</div>
    </div>
    <div style="text-align:right">
      <span class="badge">${esc(invoice.invoiceNo)}</span>
      <div class="muted" style="margin-top:6px">${new Date(invoice.invoiceDate).toLocaleString('en-IN')}</div>
      <div class="muted">${esc(invoice.item || 'Trip fare')}</div>
    </div>
  </div>
  <div class="box">
    <div class="row"><span>Route</span><b>${esc(invoice.trip?.pickup)} → ${esc(invoice.trip?.drop)}</b></div>
    <div class="row"><span>Vehicle</span><b>${esc(invoice.trip?.vehicleType || 'Toto')}</b></div>
    <div class="row"><span>Distance</span><b>${invoice.trip?.distanceKm || 0} km</b></div>
    <div class="row"><span>Duration</span><b>~${invoice.trip?.durationMin || 0} min</b></div>
    <div class="row"><span>Status</span><b>${esc(invoice.trip?.status)}</b></div>
    ${rows.join('')}
  </div>
  ${invoice.passengerInsurance ? `<div class="muted" style="margin-top:10px">🛡️ ${esc(invoice.passengerInsurance)}</div>` : ''}
  ${invoice.complianceNote ? `<div class="muted" style="margin-top:8px;font-style:italic">${esc(invoice.complianceNote)}</div>` : ''}
  <div class="foot">This is a system-generated invoice. Trip ID: ${esc(invoice.trip?.id)}</div>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 350); };</script>
</body></html>`);
  w.document.close();
}
