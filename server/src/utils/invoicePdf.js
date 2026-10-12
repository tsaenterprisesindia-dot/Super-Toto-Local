export function renderInvoiceHtml(invoice){
  const b = invoice.breakup || {};
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fmtINR = (n) => { if (n == null || isNaN(n)) return '₹0'; return '₹' + Number(n).toLocaleString('en-IN'); };
  const row = (l,v,bold=false)=> '<div class="row"><span>'+esc(l)+'</span><b>'+(bold?'<strong>'+esc(v)+'</strong>':esc(v))+'</b></div>';
  const rows = [];
  rows.push(row('Base fare', fmtINR(b.base)));
  rows.push(row('Distance ('+(invoice.trip?.distanceKm||0)+' km)', fmtINR(b.distance)));
  rows.push(row('Time ('+(invoice.trip?.durationMin||0)+' min)', fmtINR(b.time)));
  if (b.luggage>0) rows.push(row('Luggage', fmtINR(b.luggage)));
  if ((b.gross||0)-(b.subtotal||0)>0) rows.push(row('Surge x'+(b.surgeMultiplier||1), fmtINR((b.gross||0)-(b.subtotal||0))));
  rows.push(row('Subtotal', fmtINR(b.subtotal)));
  if (invoice.gstTitle) rows.push('<div class="muted">'+esc(invoice.gstTitle)+'</div>');
  if ((invoice.supply?.cgst||0)>0) rows.push(row('CGST (2.5%)', fmtINR(b.cgst||invoice.supply.cgst)));
  if ((invoice.supply?.sgst||0)>0) rows.push(row('SGST (2.5%)', fmtINR(b.sgst||invoice.supply.sgst)));
  if ((invoice.supply?.igst||0)>0) rows.push(row('IGST (5%)', fmtINR(b.igst||invoice.supply.igst)));
  rows.push(row('Total GST', fmtINR(b.gst)));
  rows.push(row('Grand total', fmtINR((b.gross||0)+(b.gst||0)), true));
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+esc(invoice.invoiceNo)+'</title><style>*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:24px;font-size:14px;color:#111}.head{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:12px}.muted{color:#555;font-size:12px}.box{border:1px solid #ccc;border-radius:8px;padding:14px;margin-top:16px}.row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dotted #ddd}.badge{background:#e8f5e9;color:#1e7d32;border-radius:10px;padding:2px 10px;font-size:12px}.foot{margin-top:20px;font-size:11px;color:#777;text-align:center}@media print{body{padding:8px}}</style></head><body><div class="head"><div><h1>GST Invoice</h1><div class="muted">'+esc(invoice.issuer?.name)+'</div><div class="muted">GSTIN: '+esc(invoice.issuer?.gstin||'-')+'</div><div class="muted">POS: '+esc(invoice.trip?.placeOfSupply||'-')+' SAC '+esc(invoice.supply?.sac||'9964')+'</div></div><div style="text-align:right"><span class="badge">'+esc(invoice.invoiceNo)+'</span><div class="muted" style="margin-top:6px">'+(invoice.invoiceDate?new Date(invoice.invoiceDate).toLocaleString('en-IN'):'')+'</div></div></div><div class="box">'+rows.join('')+'</div><div class="foot">System generated. Trip ID: '+esc(invoice.trip?.id)+'</div><script>window.onload=function(){setTimeout(function(){window.print();},300);}</script></body></html>';
}
