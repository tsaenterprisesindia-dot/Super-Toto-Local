import { useEffect, useState, useCallback } from 'react';
import client from '../../api/client.js';
import { apiBase } from '../../api/config.js';
import Modal from '../../components/Modal.jsx';
import { formatAadhaar } from '../../utils/aadhaar.js';

const SUSPEND_DURATIONS = [
  { label: '7 days', ms: 7 * 86400000 },
  { label: '14 days', ms: 14 * 86400000 },
  { label: '30 days', ms: 30 * 86400000 },
  { label: 'Permanent', ms: null },
];

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState('');

  // warn modal
  const [warnTarget, setWarnTarget] = useState(null);
  const [warnMsg, setWarnMsg] = useState('');

  // suspend modal
  const [suspTarget, setSuspTarget] = useState(null);
  const [suspReason, setSuspReason] = useState('');
  const [suspDuration, setSuspDuration] = useState(null);
  const [suspFinance, setSuspFinance] = useState(null); // financial summary
  const [settlementConfirmed, setSettlementConfirmed] = useState(false);

  // warnings viewer
  const [viewWarnTarget, setViewWarnTarget] = useState(null);

  // document review
  const [docTarget, setDocTarget] = useState(null);
  const [docList, setDocList] = useState([]);
  const [docBusy, setDocBusy] = useState(false);
  const [rejectDocId, setRejectDocId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [docDriverInfo, setDocDriverInfo] = useState(null);

  const load = useCallback(() => {
    client.get('/admin/drivers').then(({ data }) => setDrivers(data.drivers)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const openDocs = async (driver) => {
    setDocTarget(driver);
    setDocList([]);
    setDocDriverInfo(null);
    setDocBusy(true);
    try {
      const { data } = await client.get(`/admin/drivers/${driver._id}/documents`);
      setDocList(data.documents || []);
      setDocDriverInfo(data.driver || null);
    } catch {
      setDocList([]);
    } finally {
      setDocBusy(false);
    }
  };

  const reviewDoc = async (docId, action, reason) => {
    if (!docTarget) return;
    setDocBusy(true);
    try {
      await client.patch(`/admin/drivers/${docTarget._id}/documents/${docId}`, { action, rejectionReason: reason });
      const { data } = await client.get(`/admin/drivers/${docTarget._id}/documents`);
      setDocList(data.documents || []);
      setDocDriverInfo(data.driver || null);
      load();
    } catch (e) {
      setMsg(e.response?.data?.message || 'Failed');
    } finally {
      setDocBusy(false);
      setRejectDocId(null);
      setRejectReason('');
    }
  };

  // Fetch financial summary when the suspend modal opens.
  useEffect(() => {
    if (suspTarget) {
      setSuspFinance(null);
      setSettlementConfirmed(false);
      client.get(`/admin/financial-summary/${suspTarget._id}`)
        .then(({ data }) => setSuspFinance(data))
        .catch(() => setSuspFinance({ error: true }));
    }
  }, [suspTarget]);

  const actOnDriver = async (id, action) => {
    setBusyId(id); setMsg('');
    try {
      await client.patch(`/admin/drivers/${id}`, { action });
      load();
      const labels = { approve: 'approved', block: 'blocked', unblock: 'unblocked', hide: 'hidden', unhide: 'restored', reinstate: 'reinstated' };
      setMsg(`Driver ${labels[action] || action}`);
    } catch (e) {
      setMsg(e.response?.data?.message || 'Update failed');
    } finally { setBusyId(null); }
  };

  const issueWarn = async () => {
    if (!warnTarget || !warnMsg.trim()) return;
    setBusyId(warnTarget._id); setMsg('');
    try {
      await client.post(`/admin/warn/${warnTarget._id}`, { message: warnMsg.trim() });
      setWarnTarget(null); setWarnMsg('');
      load();
      setMsg('Warning issued');
    } catch (e) {
      setMsg(e.response?.data?.message || 'Failed');
    } finally { setBusyId(null); }
  };

  const issueSuspend = async () => {
    if (!suspTarget) return;
    setBusyId(suspTarget._id); setMsg('');
    try {
      const body = { reason: suspReason.trim() || 'Violations of terms', settlementConfirmed };
      if (suspDuration) body.until = new Date(Date.now() + suspDuration.ms).toISOString();
      await client.post(`/admin/suspend/${suspTarget._id}`, body);
      setSuspTarget(null); setSuspReason(''); setSuspDuration(null);
      load();
      setMsg('Driver suspended');
    } catch (e) {
      const data = e.response?.data;
      if (data?.requiresSettlement) {
        setMsg(`Cannot suspend: ₹${data.outstandingAmount?.toLocaleString('en-IN')} outstanding. Settle finances first.`);
      } else {
        setMsg(data?.message || 'Failed');
      }
    } finally { setBusyId(null); }
  };

  const clearWarnings = async (userId) => {
    setBusyId(userId); setMsg('');
    try {
      await client.delete(`/admin/warnings/${userId}`);
      load();
      setMsg('Warnings cleared');
    } catch (e) {
      setMsg(e.response?.data?.message || 'Failed');
    } finally { setBusyId(null); }
  };

  const suspended = (d) => d.suspension?.active;
  const suspendedUntil = (d) => suspended(d) && d.suspension.until
    ? new Date(d.suspension.until).toLocaleDateString('en-IN')
    : null;
  const warnCount = (d) => (d.warnings || []).length;

  const docStatus = (d, type) => (d.documents || []).find((x) => x.type === type)?.status || null;

  const docBadge = (d, type, label) => {
    const st = docStatus(d, type);
    const cls = st === 'approved' ? 'badge-green' : st === 'pending' ? 'badge-amber' : st === 'rejected' ? 'badge-red' : 'badge-gray';
    return <span className={`badge ${cls}`} style={{ marginRight: 4, marginTop: 2 }}>{st === 'approved' ? `${label} ✓` : st ? `${label}: ${st}` : `${label}: —`}</span>;
  };

  const expiryBadge = (d, key, label) => {
    const v = d.vehicleDetails?.[key];
    if (!v) return null;
    const dt = new Date(v);
    if (isNaN(dt.getTime())) return null;
    const days = Math.ceil((dt - Date.now()) / 86400000);
    const cls = days < 0 ? 'badge-red' : days <= 30 ? 'badge-amber' : 'badge-green';
    const txt = days < 0 ? `${label} expired` : `${label} ${dt.toLocaleDateString('en-IN')} (${days}d left)`;
    return <span className={`badge ${cls}`} style={{ marginRight: 4, marginTop: 2 }}>{txt}</span>;
  };

  const filtered = drivers.filter((d) => {
    if (filter === 'hidden') return d.isHidden;
    if (filter === 'active') return !d.isHidden && !suspended(d);
    if (filter === 'suspended') return suspended(d);
    return true;
  });

  const hiddenCount = drivers.filter((d) => d.isHidden).length;
  const suspCount = drivers.filter((d) => suspended(d)).length;

  return (
    <div className="fade-in">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ marginTop: 0 }}>Drivers</h2>
        <span className="small muted">{hiddenCount} hidden · {suspCount} suspended</span>
      </div>
      {msg && <div className="alert alert-green mb">{msg}</div>}

      <div className="tab-row" style={{ maxWidth: 480 }}>
        {[['all', `All (${drivers.length})`], ['active', `Active (${drivers.length - hiddenCount - suspCount})`], ['hidden', `Hidden (${hiddenCount})`], ['suspended', `Suspended (${suspCount})`]].map(([k, label]) => (
          <button key={k} className={`tab${filter === k ? ' active' : ''}`} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Driver</th>
              <th>Vehicle</th>
              <th>Rides</th>
              <th>Docs</th>
              <th>Status</th>
              <th>Warnings</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const status = d.driverStatus;
              return (
                <tr key={d._id}>
                  <td>
                    <b>{d.name}</b>
                    <div className="small muted">{d.email || d.phone}</div>
                  </td>
                  <td>{d.vehicleType}<div className="small muted">{d.vehicleNumber || '—'}</div>
                    <div className="row wrap" style={{ gap: 2 }}>{expiryBadge(d, 'insuranceUpto', 'Insurance')}{expiryBadge(d, 'permitUpto', 'Permit')}</div>
                  </td>
                  <td>{d.rideCount || 0}</td>
                  <td>
                    {d.documents && d.documents.length > 0 ? (
                      <button className="badge badge-blue btn-ghost" style={{ cursor: 'pointer', border: 'none' }} onClick={() => openDocs(d)}>
                        {d.documents.length} doc{d.documents.length > 1 ? 's' : ''}
                      </button>
                    ) : (
                      <span className="muted small">No docs</span>
                    )}
                    <div className="row wrap" style={{ gap: 2 }}>{docBadge(d, 'pcc', 'PCC')}</div>
                    {d.aadhaarNumber && <div className="small muted" style={{ marginTop: 2 }}>Aadhaar: {formatAadhaar(d.aadhaarNumber)}</div>}
                  </td>
                  <td>
                    <span className={`badge ${status === 'approved' ? 'badge-green' : status === 'pending' ? 'badge-amber' : 'badge-red'}`}>
                      {status}
                    </span>
                    {d.isHidden && <span className="badge badge-gray" style={{ marginLeft: 4 }}>hidden</span>}
                    {suspended(d) && <span className="badge badge-suspended" style={{ marginLeft: 4 }}>
                      {suspendedUntil(d) ? `susp. till ${suspendedUntil(d)}` : 'permanently suspended'}
                    </span>}
                  </td>
                  <td>
                    {warnCount(d) > 0 ? (
                      <button className="badge badge-warned btn-ghost" style={{ cursor: 'pointer', border: 'none' }} onClick={() => setViewWarnTarget(d)}>
                        {warnCount(d)} warning{warnCount(d) > 1 ? 's' : ''}
                      </button>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td>
                    <div className="row wrap" style={{ gap: 4 }}>
                      {d.isHidden || suspended(d) ? (
                        <button className="btn btn-primary small" disabled={busyId === d._id} onClick={() => actOnDriver(d._id, 'reinstate')}>
                          Reinstate
                        </button>
                      ) : (
                        <>
                          {status === 'pending' && (
                            <button className="btn btn-primary small" disabled={busyId === d._id} onClick={() => actOnDriver(d._id, 'approve')}>Approve</button>
                          )}
                          <button className="btn btn-ghost small" disabled={busyId === d._id} onClick={() => setWarnTarget(d)}>
                            Warn
                          </button>
                          <button className="btn btn-danger small" disabled={busyId === d._id} onClick={() => setSuspTarget(d)}>
                            Suspend
                          </button>
                          <button className="btn btn-ghost small" disabled={busyId === d._id} onClick={() => actOnDriver(d._id, 'hide')}>
                            Hide
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="muted center">No drivers in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- Warn modal --- */}
      <Modal open={!!warnTarget} onClose={() => setWarnTarget(null)}>
        <h3>Warn {warnTarget?.name}</h3>
        <p className="small muted mb">The user will see this as an in-app warning banner.</p>
        <textarea
          className="input"
          rows={3}
          placeholder="Describe the breach…"
          value={warnMsg}
          onChange={(e) => setWarnMsg(e.target.value)}
        />
        <div className="modal-actions">
          <button className="btn btn-primary" disabled={busyId === warnTarget?._id || !warnMsg.trim()} onClick={issueWarn}>
            {busyId === warnTarget?._id ? 'Sending…' : 'Issue Warning'}
          </button>
          <button className="btn btn-ghost" onClick={() => setWarnTarget(null)}>Cancel</button>
        </div>
      </Modal>

      {/* --- Suspend modal --- */}
      <Modal open={!!suspTarget} onClose={() => setSuspTarget(null)}>
        <h3>Suspend {suspTarget?.name}</h3>
        <div className="field">
          <label>Reason</label>
          <textarea
            className="input"
            rows={2}
            placeholder="Reason for suspension…"
            value={suspReason}
            onChange={(e) => setSuspReason(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Duration</label>
          <div className="seg-row" style={{ flexWrap: 'wrap' }}>
            {SUSPEND_DURATIONS.map((d) => (
              <button
                key={d.label}
                className={`seg${suspDuration === d.ms ? ' active' : ''}`}
                onClick={() => setSuspDuration(d.ms)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <p className="small muted">
          {suspDuration === null
            ? 'Permanent: the account stays blocked until an admin manually reinstates it.'
            : `Auto-expires after ${SUSPEND_DURATIONS.find(d => d.ms === suspDuration)?.label || '…'}.`}
        </p>

        {/* --- Financial settlement summary --- */}
        {suspFinance && !suspFinance.error && (
          <div className="card" style={{ background: 'var(--bg)', padding: 12, marginTop: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Financial Summary</div>
            <div className="spread mb"><span className="muted">Completed rides</span><b>{suspFinance.completedRides || 0}</b></div>
            <div className="spread mb"><span className="muted">Total earned</span><b>₹{(suspFinance.totalEarned || 0).toLocaleString('en-IN')}</b></div>
            <div className="spread mb"><span className="muted">Platform commission</span><b>₹{(suspFinance.totalCommission || 0).toLocaleString('en-IN')}</b></div>
            <div className="spread mb"><span className="muted">Wallet balance (pending payout)</span><b style={{ color: suspFinance.pendingPayout > 0 ? 'var(--amber)' : undefined }}>₹{(suspFinance.pendingPayout || 0).toLocaleString('en-IN')}</b></div>
            {suspFinance.pendingPayout > 0 && (
              <div className="alert alert-warn" style={{ marginTop: 6 }}>
                This driver has a pending payout of <b>₹{suspFinance.pendingPayout.toLocaleString('en-IN')}</b>.
                Ensure the payout is processed before permanent suspension.
              </div>
            )}
          </div>
        )}
        {suspFinance?.error && <p className="small muted mt">Could not load financial summary.</p>}

        {suspFinance && !suspFinance.error && suspFinance.pendingPayout > 0 && (
          <label className="row mt" style={{ gap: 8, cursor: 'pointer', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={settlementConfirmed} onChange={(e) => setSettlementConfirmed(e.target.checked)} style={{ marginTop: 3 }} />
            <span className="small">I confirm all financial matters (pending payout of ₹{suspFinance.pendingPayout.toLocaleString('en-IN')}) have been settled or will be handled separately.</span>
          </label>
        )}

        <div className="modal-actions">
          <button
            className="btn btn-danger"
            disabled={busyId === suspTarget?._id || (suspFinance && !suspFinance.error && suspFinance.pendingPayout > 0 && !settlementConfirmed)}
            onClick={issueSuspend}
          >
            {busyId === suspTarget?._id ? 'Suspending…' : 'Confirm Suspension'}
          </button>
          <button className="btn btn-ghost" onClick={() => setSuspTarget(null)}>Cancel</button>
        </div>
      </Modal>

      {/* --- View warnings modal --- */}
      <Modal open={!!viewWarnTarget} onClose={() => setViewWarnTarget(null)}>
        <h3>Warnings — {viewWarnTarget?.name}</h3>
        {viewWarnTarget?.warnings?.length === 0 && <p className="muted">No warnings.</p>}
        {viewWarnTarget?.warnings?.map((w) => (
          <div key={w._id} className="warning-banner" style={{ marginBottom: 8 }}>
            <div className="warning-msg">{w.message}</div>
            <div className="small muted mt">{new Date(w.issuedAt).toLocaleDateString('en-IN')}</div>
          </div>
        ))}
        {viewWarnTarget?.warnings?.length > 0 && (
          <button
            className="btn btn-danger small mt"
            disabled={busyId === viewWarnTarget?._id}
            onClick={() => { clearWarnings(viewWarnTarget._id); setViewWarnTarget(null); }}
          >
            Clear all warnings
          </button>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setViewWarnTarget(null)}>Close</button>
        </div>
      </Modal>

      {/* --- Document review modal --- */}
      <Modal open={!!docTarget} onClose={() => { setDocTarget(null); setRejectDocId(null); setRejectReason(''); }}>
        <h3>Documents — {docTarget?.name}</h3>
        {docDriverInfo?.aadhaarNumber && (
          <div className="card" style={{ background: 'var(--bg)', padding: 10, marginBottom: 10 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 18 }}>🪪</span>
              <div>
                <div className="small bold">Aadhaar Number (registered)</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{formatAadhaar(docDriverInfo.aadhaarNumber)}</div>
                <div className="small muted">Validated via Verhough checksum at registration</div>
              </div>
            </div>
          </div>
        )}
        {docBusy && <p className="muted">Loading documents…</p>}
        {!docBusy && docList.length === 0 && <p className="muted">No documents uploaded yet.</p>}
        {!docBusy && docList.map((doc) => {
          const DOC_LABELS = { aadhaar: 'Aadhaar Card', rc: 'Vehicle RC', license: 'Driver License', bank: 'Bank Account Details', photo: 'Passport Photo', insurance: 'Insurance Certificate', puc: 'PUC Certificate', pcc: 'Police Clearance Certificate' };
          const STATUS_CONFIG = { pending: { label: 'Under Review', cls: 'badge-amber' }, approved: { label: 'Approved', cls: 'badge-green' }, rejected: { label: 'Rejected', cls: 'badge-red' } };
          const st = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
          const baseUrl = apiBase();
          return (
            <div key={doc._id} className="card" style={{ background: 'var(--bg)', padding: 12, marginBottom: 10 }}>
              <div className="spread" style={{ marginBottom: 6 }}>
                <b style={{ fontSize: 13 }}>{DOC_LABELS[doc.type] || doc.type}</b>
                <span className={`badge ${st.cls}`}>{st.label}</span>
              </div>
              <div className="small muted" style={{ marginBottom: 6 }}>
                {doc.originalName || doc.filename} — uploaded {new Date(doc.uploadedAt).toLocaleDateString('en-IN')}
              </div>
              {doc.status === 'rejected' && doc.rejectionReason && (
                <div className="err-box mb" style={{ fontSize: 12 }}>Reason: {doc.rejectionReason}</div>
              )}
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <a href={`${baseUrl}/uploads/${doc.filename}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost small">
                  View ↗
                </a>
                {doc.status !== 'approved' && (
                  <button className="btn btn-primary small" disabled={docBusy} onClick={() => reviewDoc(doc._id, 'approve')}>
                    Approve
                  </button>
                )}
                {doc.status !== 'rejected' && (
                  rejectDocId === doc._id ? (
                    <div className="row" style={{ gap: 4, flex: 1 }}>
                      <input className="input" style={{ flex: 1, fontSize: 12, padding: '6px 8px' }} placeholder="Rejection reason…" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                      <button className="btn btn-danger small" disabled={docBusy} onClick={() => reviewDoc(doc._id, 'reject', rejectReason)}>Confirm</button>
                      <button className="btn btn-ghost small" onClick={() => { setRejectDocId(null); setRejectReason(''); }}>Cancel</button>
                    </div>
                  ) : (
                    <button className="btn btn-danger small" disabled={docBusy} onClick={() => setRejectDocId(doc._id)}>
                      Reject
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => { setDocTarget(null); setRejectDocId(null); setRejectReason(''); }}>Close</button>
        </div>
      </Modal>
    </div>
  );
}
