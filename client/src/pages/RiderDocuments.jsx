import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import client from '../api/client.js';
import { formatAadhaar } from '../utils/aadhaar.js';

export default function RiderDocuments() {
  const navigate = useNavigate();
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await client.get('/rider/documents');
      setAadhaarNumber(data.aadhaarNumber || '');
      setPhoneVerified(data.phoneVerified || false);
      setAadhaarVerified(data.aadhaarVerified || false);
    } catch (e) {
      setErr('Could not load verification status');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const allVerified = phoneVerified && aadhaarVerified;

  return (
    <>
      <Nav />
      <div className="page">
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ marginTop: 0 }}>Identity Verification</h2>

          {err && <div className="err-box mb">{err}</div>}

          {/* Mobile Verification */}
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
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              Verified via OTP during registration.
            </p>
          </div>

          {/* Aadhaar Number */}
          <div className="card" style={{ padding: 16, marginBottom: 14 }}>
            <div className="spread" style={{ marginBottom: 4 }}>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontSize: 20 }}>🪪</span>
                <b style={{ fontSize: 14 }}>Aadhaar Number</b>
              </div>
              <span className={`badge ${aadhaarVerified ? 'badge-green' : 'badge-amber'}`}>
                {aadhaarVerified ? 'Verified ✓' : 'Not Verified'}
              </span>
            </div>
            {aadhaarNumber && (
              <p className="small muted" style={{ margin: '4px 0 0' }}>
                <b>{formatAadhaar(aadhaarNumber)}</b> — validated at registration via checksum
              </p>
            )}
          </div>

          {allVerified ? (
            <div className="alert alert-green mb">
              Your identity is verified! You can book rides now.
            </div>
          ) : (
            <div className="alert alert-info mb">
              Your identity is not fully verified yet. Please contact support.
            </div>
          )}

          <button className="btn btn-primary" onClick={() => navigate('/ride')}>
            ← Go to Ride Booking
          </button>
        </div>
      </div>
    </>
  );
}
