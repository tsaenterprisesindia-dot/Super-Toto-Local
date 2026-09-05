import { useState } from 'react';
import { useFace } from '../context/FaceProvider.jsx';
import FaceCapture from './FaceCapture.jsx';

export default function FaceVerifyModal({ open, onClose, onVerified, apiFactory, title }) {
  const face = useFace();
  const [camOpen, setCamOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  if (!open) return null;

  const start = () => {
    setErr('');
    setOk(false);
    setCamOpen(true);
  };

  const abort = () => {
    face.stopStream();
    setCamOpen(false);
    setBusy(false);
    setErr('');
    setOk(false);
  };

  const capture = async () => {
    setBusy(true);
    setErr('');
    const res = await face.captureDescriptor();
    face.stopStream();
    setCamOpen(false);
    if (!res.ok) {
      setErr(res.message || 'Could not capture your face. Try again.');
      setBusy(false);
      return;
    }
    try {
      const { data } = await apiFactory(res.descriptor);
      setOk(true);
      if (onVerified) onVerified(data);
    } catch (e) {
      setErr(e.response?.data?.message || 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => (busy ? null : onClose())}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>{title || 'Verify your identity'}</h3>
        <p className="small muted" style={{ marginBottom: 12 }}>
          For your safety, take a clear selfie facing the camera. It is matched against your enrolled face and never leaves the server.
        </p>

        {camOpen ? (
          <FaceCapture
            open={camOpen}
            onClose={abort}
            onCapture={capture}
            videoRef={face.videoRef}
            startCamera={face.startCamera}
            loading={busy}
            error={err}
            title="Position your face in the frame"
          />
        ) : (
          <>
            {ok ? (
              <div className="alert alert-green" style={{ marginBottom: 0 }}>
                ✅ Face verified successfully.
              </div>
            ) : (
              <>
                {err && <div className="err-box" style={{ marginBottom: 10 }}>{err}</div>}
                <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
                  <button type="button" className="btn" onClick={onClose}>Close</button>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={start}>
                    {busy ? 'Verifying…' : '📷 Verify with selfie'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}