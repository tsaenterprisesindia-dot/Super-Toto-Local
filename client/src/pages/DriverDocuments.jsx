import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import client from '../api/client.js';
import { apiBase } from '../api/config.js';
import { formatAadhaar } from '../utils/aadhaar.js';

const DOC_TYPES = [
  { key: 'aadhaar', label: 'Aadhaar Card', icon: '🪪', accept: '.pdf', hint: 'Upload a clear PDF scan of your Aadhaar card (front & back)' },
  { key: 'rc', label: 'Vehicle RC', icon: '🚗', accept: '.pdf', hint: 'Upload your vehicle Registration Certificate as PDF' },
  { key: 'license', label: 'Driver License', icon: '🎫', accept: '.pdf', hint: 'Upload your driving license' },
  { key: 'bank', label: 'Bank Account', icon: '🏦', accept: '.pdf', hint: 'Upload a cancelled cheque or bank passbook first page (PDF)' },
  { key: 'photo', label: 'Passport Photo', icon: '📸', accept: '.jpg,.jpeg,.png,.webp', hint: 'Upload a recent passport-size photograph (JPG or PNG)' },
  { key: 'insurance', label: 'Vehicle Insurance', icon: '🛡️', accept: '.pdf', hint: 'Upload your vehicle insurance certificate (PDF)' },
  { key: 'puc', label: 'PUC Certificate', icon: '🌱', accept: '.pdf,.jpg,.jpeg,.png', hint: 'Upload your Pollution Under Control certificate' },
  { key: 'pcc', label: 'Police Clearance', icon: '📜', accept: '.pdf,.jpg,.jpeg,.png', hint: 'Upload your Police Clearance Certificate (PCC)' },
];

const STATUS_CONFIG = {
  pending: { label: 'Under Review', cls: 'badge-amber' },
  approved: { label: 'Approved', cls: 'badge-green' },
  rejected: { label: 'Rejected', cls: 'badge-red' },
};

export default function DriverDocuments() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [missing, setMissing] = useState([]);
  const [uploading, setUploading] = useState({});
  const [previews, setPreviews] = useState({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [requiredMap, setRequiredMap] = useState({ aadhaar: true, rc: true, license: true, bank: true, photo: true, insurance: false, puc: false, pcc: true });

  const isRequired = (key) => requiredMap[key] === true;

  const load = useCallback(async () => {
    try {
      const { data } = await client.get('/driver/documents');
      setDocs(data.documents || []);
      setMissing(data.missing || []);
      setAadhaarNumber(data.aadhaarNumber || '');
      setPhoneVerified(data.phoneVerified || false);
      if (data.requiredMap) setRequiredMap(data.requiredMap);
    } catch (e) {
      setErr('Could not load document status');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getDoc = (type) => docs.find((d) => d.type === type);

  const handleFile = (type, file) => {
    if (!file) return;
    setPreviews((p) => ({ ...p, [type]: file }));
    setErr('');
  };

  const uploadDoc = async (type) => {
    const file = previews[type];
    if (!file) return;
    setUploading((u) => ({ ...u, [type]: true }));
    setErr('');
    setMsg('');
    try {
      const fd = new FormData();
      fd.append(type, file);
      await client.post('/driver/documents', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMsg(`${DOC_TYPES.find((d) => d.key === type)?.label || type} uploaded successfully`);
      setPreviews((p) => { const n = { ...p }; delete n[type]; return n; });
      await load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Upload failed');
    } finally {
      setUploading((u) => ({ ...u, [type]: false }));
    }
  };

  const allRequiredUploaded = DOC_TYPES.filter((d) => isRequired(d.key)).every((d) => {
    const doc = getDoc(d.key);
    return doc && doc.status !== 'rejected';
  });

  const allApproved = DOC_TYPES.filter((d) => isRequired(d.key)).every((d) => {
    const doc = getDoc(d.key);
    return doc && doc.status === 'approved';
  });

  const baseUrl = apiBase();

  return (
    <>
      <Nav />
      <div className="page">
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ marginTop: 0 }}>Upload Documents</h2>
          <p className="small muted mb">
            Please upload all required documents for verification. Your driver account will be activated after admin approval.
          </p>

          {msg && <div className="alert alert-green mb">{msg}</div>}
          {err && <div className="err-box mb">{err}</div>}

          {/* Identity verification status */}
          <div className="card" style={{ padding: 16, marginBottom: 14 }}>
            <div className="spread" style={{ marginBottom: 4 }}>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontSize: 20 }}>📱</span>
                <b style={{ fontSize: 14 }}>Mobile Number</b>
              </div>
              <span className={`badge ${phoneVerified ? 'badge-green' : 'badge-amber'}`}>
                {phoneVerified ? 'Verified ✓' : 'Not Verified'}
              </span>
            </div>
          </div>
          <div className="card" style={{ padding: 16, marginBottom: 14 }}>
            <div className="spread" style={{ marginBottom: 4 }}>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontSize: 20 }}>🪪</span>
                <b style={{ fontSize: 14 }}>Aadhaar Number</b>
              </div>
              <span className="badge badge-green">Validated ✓</span>
            </div>
            {aadhaarNumber && (
              <div className="small muted" style={{ marginTop: 4 }}>
                Registered: <b>{formatAadhaar(aadhaarNumber)}</b> — verified with checksum at registration
              </div>
            )}
          </div>

          {allApproved && (
            <div className="alert alert-green mb">
              All required documents are approved! You can now go online and start receiving rides.
            </div>
          )}

          {!allApproved && allRequiredUploaded && !msg && (
            <div className="alert alert-info mb">
              All documents uploaded. Our team will review them shortly. You'll be notified once approved.
            </div>
          )}

          <div className="stack">
            {DOC_TYPES.map((dt) => {
              const existing = getDoc(dt.key);
              const statusInfo = existing ? STATUS_CONFIG[existing.status] : null;
              const hasNewFile = !!previews[dt.key];
              const isUploading = !!uploading[dt.key];

              return (
                <div key={dt.key} className="card" style={{ padding: 16 }}>
                  <div className="spread" style={{ marginBottom: 8 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{dt.icon}</span>
                      <div>
                        <b style={{ fontSize: 14 }}>{dt.label}</b>
                        {isRequired(dt.key) && <span style={{ color: 'var(--danger)', marginLeft: 4 }}>*</span>}
                        {!isRequired(dt.key) && <span className="small muted" style={{ marginLeft: 6 }}>optional</span>}
                      </div>
                    </div>
                    {statusInfo && (
                      <span className={`badge ${statusInfo.cls}`}>{statusInfo.label}</span>
                    )}
                  </div>

                  <p className="small muted" style={{ margin: '0 0 10px' }}>{dt.hint}</p>

                  {existing && existing.status === 'rejected' && existing.rejectionReason && (
                    <div className="err-box mb" style={{ fontSize: 12 }}>
                      Rejected: {existing.rejectionReason}
                    </div>
                  )}

                  {existing && existing.status !== 'rejected' && (
                    <div className="small muted mb">
                      Uploaded: {existing.originalName || existing.filename}
                      {existing.status === 'approved' && existing.reviewedAt && (
                        <> — reviewed {new Date(existing.reviewedAt).toLocaleDateString('en-IN')}</>
                      )}
                    </div>
                  )}

                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <label className="btn btn-ghost" style={{ cursor: 'pointer', fontSize: 13 }}>
                      {existing?.status === 'rejected' ? 'Re-upload' : existing ? 'Replace' : 'Choose file'}
                      <input
                        type="file"
                        accept={dt.accept}
                        style={{ display: 'none' }}
                        onChange={(e) => handleFile(dt.key, e.target.files?.[0])}
                      />
                    </label>
                    {hasNewFile && (
                      <>
                        <span className="small muted" style={{ alignSelf: 'center' }}>
                          {previews[dt.key]?.name?.substring(0, 30)}
                        </span>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: 13 }}
                          disabled={isUploading}
                          onClick={() => uploadDoc(dt.key)}
                        >
                          {isUploading ? 'Uploading…' : 'Upload'}
                        </button>
                      </>
                    )}
                  </div>

                  {existing && existing.status !== 'rejected' && (
                    <a
                      href={`${baseUrl}/uploads/${existing.filename}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="small"
                      style={{ display: 'inline-block', marginTop: 8 }}
                    >
                      View uploaded file ↗
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => navigate('/driver')}>
              ← Back to Dashboard
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/driver/vehicle')}>
              🚗 Vehicle Details
            </button>
            {allApproved && (
              <button className="btn btn-primary" onClick={() => navigate('/driver')}>
                Go to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
