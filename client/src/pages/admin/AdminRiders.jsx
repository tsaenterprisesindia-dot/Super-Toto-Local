import { useEffect, useState, useCallback } from 'react';
import client from '../../api/client.js';
import { apiBase } from '../../api/config.js';
import Modal from '../../components/Modal.jsx';
import { timeAgo } from '../../utils/geo.js';

const SUSPEND_DURATIONS = [
  { label: '7 days', ms: 7 * 86400000 },
  { label: '14 days', ms: 14 * 86400000 },
  { label: '30 days', ms: 30 * 86400000 },
  { label: 'Permanent', ms: null },
];

export default function AdminRiders() {
  const [riders, setRiders] = useState([]);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState('');

  const [warnTarget, setWarnTarget] = useState(null);
  const [warnMsg, setWarnMsg] = useState('');
  const [suspTarget, setSuspTarget] = useState(null);
  const [suspReason, setSuspReason] = useState('');
  const [suspDuration, setSuspDuration] = useState(null);
  const [suspFinance, setSuspFinance] = useState(null);
  const [settlementConfirmed, setSettlementConfirmed] = useState(false);
  const [viewWarnTarget, setViewWarnTarget] = useState(null);

  // document review
  const [docTarget, setDocTarget] = useState(null);
  const [docList, setDocList] = useState([]);
  const [docInfo, setDocInfo] = useState(null);
  const [docBusy, setDocBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectDocId, setRejectDocId] = useState(null);

  const load = useCallback(() => {
    client.get('/admin/riders').then(({ data }) => setRiders(data.riders)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const openDocs = async (rider) => {
    setDocTarget(rider);
    setDocList([]);
    setDocInfo(null);
    setDocBusy(true);
    try {
      const { data } = await client.get(`/admin/riders/${rider._id}/documents`);
      setDocList(data.documents || []);
      setDocInfo(data.rider || null);
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
      await client.patch(`/admin/riders/${docTarget._id}/documents/${docId}`, { action, rejectionReason: reason });
      const { data } = await client.get(`/admin/riders/${docTarget._id}/documents`);
      setDocList(data.documents || []);
      setDocInfo(data.rider || null);
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

  const actOnRider = async (id, action) => {
    setBusyId(id); setMsg('');
    try {
      await client.patch(`/admin/riders/${id}`, { action });
      load();
      const labels = { hide: 'hidden', unhide: 'restored', reinstate: 'reinstated' };
      setMsg(`Rider ${labels[action] || action}`);
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
      load(); setMsg('Warning issued');
    } catch (e) { setMsg(e.response?.data?.message || 'Failed'); }
    finally { setBusyId(null); }
  };

  const issueSuspend = async () => {
    if (!suspTarget) return;
    setBusyId(suspTarget._id); setMsg('');
    try {
      const body = { reason: suspReason.trim() || 'Violations of terms', settlementConfirmed };
      if (suspDuration) body.until = new Date(Date.now() + suspDuration.ms).toISOString();
      await client.post(`/admin/suspend/${suspTarget._id}`, body);
      setSuspTarget(null); setSuspReason(''); setSuspDuration(null);
      load(); setMsg('Rider suspended');
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
      load(); setMsg('Warnings cleared');
    } catch (e) { setMsg(e.response?.data?.message || 'Failed'); }
    finally { setBusyId(null); }
  };

  const suspended = (r) => r.suspension?.active;
  const suspendedUntil = (r) => suspended(r) && r.suspension.until
    ? new Date(r.suspension.until).toLocaleDateString('en-IN') : null;
  const warnCount = (r) => (r.warnings || []).length;

  const filtered = riders.filter((r) => {
    if (filter === 'hidden') return r.isHidden;
    if (filter === 'active') return !r.isHidden && !suspended(r);
    if (filter === 'suspended') return suspended(r);
    return true;
  });
  const hiddenCount = riders.filter((r) => r.isHidden).length;
  const suspCount = riders.filter((r) => suspended(r)).length;

  return (
    <div className="fade-in">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ marginTop: 0 }}>Riders</h2>
        <span className="small muted">{hiddenCount} hidden · {suspCount} suspended</span>
      </div>
      {msg && <div className="alert alert-green mb">{msg}</div>}

      <div className="tab-row" style={{ maxWidth: 480 }}>
        {[['all', `All (${riders.length})`], ['active', `Active (${riders.length - hiddenCount - suspCount})`], ['hidden', `Hidden (${hiddenCount})`], ['suspended', `Suspended (${suspCount})`]].map(([k, label]) => (
          <button key={k} className={`tab${filter === k ? ' active' : ''}`} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Joined</th>
              <th>Docs</th>
              <th>Status</th>
              <th>Warnings</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r._id}>
                <td>
                  <b>{r.name}</b>
                  <div className="small muted">{r.email || r.phone}</div>
                </td>
                <td>{r.phone || '—'}</td>
                <td className="small">{timeAgo(r.createdAt)}</td>
                <td>
                  {r.documents && r.documents.length > 0 ? (
                    <button className="badge badge-blue btn-ghost" style={{ cursor: 'pointer', border: 'none' }} onClick={() => openDocs(r)}>
                      {r.documents.length} doc{r.documents.length > 1 ? 's' : ''}
                    </button>
                  ) : (
                    <span className="muted small">No docs</span>
                  )}
                </td>
                <td>
                  {r.isHidden ? <span className="badge badge-gray">hidden</span> : suspended(r)
                    ? <span className="badge badge-suspended">{suspendedUntil(r) ? `susp. till ${suspendedUntil(r)}` : 'permanently suspended'}</span>
                    : <span className="badge badge-green">active</span>}
                </td>
                <td>
                  {warnCount(r) > 0 ? (
                    <button className="badge badge-warned btn-ghost" style={{ cursor: 'pointer', border: 'none' }} onClick={() => setViewWarnTarget(r)}>
                      {warnCount(r)} warning{warnCount(r) > 1 ? 's' : ''}
                    </button>
                  ) : <span className="muted">—</span>}
                </td>
                <td>
                  <div className="row wrap" style={{ gap: 4 }}>
                    {r.isHidden || suspended(r) ? (
                      <button className="btn btn-primary small" disabled={busyId === r._id} onClick={() => actOnRider(r._id, 'reinstate')}>
                        Reinstate
                      </button>
                    ) : (
                      <>
                        <button className="btn btn-ghost small" disabled={busyId === r._id} onClick={() => setWarnTarget(r)}>Warn</button>
                        <button className="btn btn-danger small" disabled={busyId === r._id} onClick={() => setSuspTarget(r)}>Suspend</button>
                        <button className="btn btn-ghost small" disabled={busyId === r._id} onClick={() => actOnRider(r._id, 'hide')}>Hide</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="muted center">No riders in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!warnTarget} onClose={() => setWarnTarget(null)}>
        <h3>Warn {warnTarget?.name}</h3>
        <p className="small muted mb">The user will see this as an in-app warning banner.</p>
        <textarea className="input" rows={3} placeholder="Describe the breach…" value={warnMsg} onChange={(e) => setWarnMsg(e.target.value)} />
        <div className="modal-actions">
          <button className="btn btn-primary" disabled={busyId === warnTarget?._id || !warnMsg.trim()} onClick={issueWarn}>
            {busyId === warnTarget?._id ? 'Sending…' : 'Issue Warning'}
          </button>
          <button className="btn btn-ghost" onClick={() => setWarnTarget(null)}>Cancel</button>
        </div>
      </Modal>

      <Modal open={!!suspTarget} onClose={() => setSuspTarget(null)}>
        <h3>Suspend {suspTarget?.name}</h3>
        <div className="field">
          <label>Reason</label>
          <textarea className="input" rows={2} placeholder="Reason for suspension…" value={suspReason} onChange={(e) => setSuspReason(e.target.value)} />
        </div>
        <div className="field">
          <label>Duration</label>
          <div className="seg-row" style={{ flexWrap: 'wrap' }}>
            {SUSPEND_DURATIONS.map((d) => (
              <button key={d.label} className={`seg${suspDuration === d.ms ? ' active' : ''}`} onClick={() => setSuspDuration(d.ms)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <p className="small muted">
          {suspDuration === null
            ? 'Permanent: stays blocked until an admin reinstates.'
            : `Auto-expires after ${SUSPEND_DURATIONS.find(d => d.ms === suspDuration)?.label || '…'}.`}
        </p>

        {suspFinance && !suspFinance.error && (
          <div className="card" style={{ background: 'var(--bg)', padding: 12, marginTop: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Financial Summary</div>
            <div className="spread mb"><span className="muted">Total rides taken</span><b>{suspFinance.outstandingRides || 0} unpaid</b></div>
            <div className="spread mb"><span className="muted">Outstanding amount</span><b style={{ color: suspFinance.totalOutstanding > 0 ? 'var(--danger)' : undefined }}>₹{(suspFinance.totalOutstanding || 0).toLocaleString('en-IN')}</b></div>
            <div className="spread mb"><span className="muted">Total spent (paid)</span><b>₹{(suspFinance.totalSpent || 0).toLocaleString('en-IN')}</b></div>
            {suspFinance.totalOutstanding > 0 && (
              <div className="alert alert-warn" style={{ marginTop: 6 }}>
                This rider owes <b>₹{suspFinance.totalOutstanding.toLocaleString('en-IN')}</b> from {suspFinance.outstandingRides} unpaid ride(s).
                Ensure outstanding dues are recovered before permanent suspension.
              </div>
            )}
          </div>
        )}
        {suspFinance?.error && <p className="small muted mt">Could not load financial summary.</p>}

        {suspFinance && !suspFinance.error && suspFinance.totalOutstanding > 0 && (
          <label className="row mt" style={{ gap: 8, cursor: 'pointer', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={settlementConfirmed} onChange={(e) => setSettlementConfirmed(e.target.checked)} style={{ marginTop: 3 }} />
            <span className="small">I confirm all outstanding dues (₹{suspFinance.totalOutstanding.toLocaleString('en-IN')}) have been settled or will be recovered separately.</span>
          </label>
        )}

        <div className="modal-actions">
          <button
            className="btn btn-danger"
            disabled={busyId === suspTarget?._id || (suspFinance && !suspFinance.error && suspFinance.totalOutstanding > 0 && !settlementConfirmed)}
            onClick={issueSuspend}
          >
            {busyId === suspTarget?._id ? 'Suspending…' : 'Confirm Suspension'}
          </button>
          <button className="btn btn-ghost" onClick={() => setSuspTarget(null)}>Cancel</button>
        </div>
      </Modal>

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
          <button className="btn btn-danger small mt" disabled={busyId === viewWarnTarget?._id}
            onClick={() => { clearWarnings(viewWarnTarget._id); setViewWarnTarget(null); }}>
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
        {docInfo && (
          <div className="card" style={{ background: 'var(--bg)', padding: 10, marginBottom: 10 }}>
            <div className="spread mb"><span className="muted small">Aadhaar Number</span><b style={{ fontSize: 13 }}>{docInfo.aadhaarNumber ? `${docInfo.aadhaarNumber.slice(0,4)} ${docInfo.aadhaarNumber.slice(4,8)} ${docInfo.aadhaarNumber.slice(8)}` : '—'}</b></div>
            <div className="spread mb"><span className="muted small">Mobile Verified</span><span className={`badge ${docInfo.phoneVerified ? 'badge-green' : 'badge-amber'}`}>{docInfo.phoneVerified ? 'Yes' : 'No'}</span></div>
            <div className="spread"><span className="muted small">Aadhaar Verified</span><span className={`badge ${docInfo.aadhaarVerified ? 'badge-green' : 'badge-amber'}`}>{docInfo.aadhaarVerified ? 'Yes' : 'No'}</span></div>
          </div>
        )}
        {docBusy && <p className="muted">Loading documents…</p>}
        {!docBusy && docList.length === 0 && <p className="muted">No documents uploaded yet.</p>}
        {!docBusy && docList.map((doc) => {
          const DOC_LABELS = { aadhaar: 'Aadhaar Card (PDF)' };
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
