import { useState } from 'react';

export default function AdminCAExports() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7));
  const dl = (path) => {
    window.location.href = '/api/admin' + path + (path.includes('?') ? '&' : '?') + 'month=' + month;
  };
  return (
    <div className="card">
      <h2>CA Exports</h2>
      <p className="muted">GST & Tally CSV exports</p>
      <input type="month" value={month} onChange={e=>setMonth(e.target.value)} />
      <div style={{marginTop:12,display:'flex',gap:8,flexWrap:'wrap'}}>
        <button className="btn" onClick={()=>dl('/export/gst/gstr1')}>Export GSTR-1 (CSV)</button>
        <button className="btn" onClick={()=>dl('/export/gst/summary')}>Export GST Summary (CSV)</button>
        <button className="btn" onClick={()=>dl('/export/accounting/tally')}>Export Tally (CSV)</button>
      </div>
    </div>
  );
}
