import { useEffect, useRef, useState } from 'react';
import Modal from './Modal.jsx';

// Generic webcam capture used for the pickup safety photo (driver + riders).
// Only the captured JPEG blob leaves this component; the caller decides where
// to send it.
export default function CameraCapture({ open, onClose, onUse, title, busy = false, error = '', facingMode = 'user' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [mode, setMode] = useState(facingMode);
  const [shot, setShot] = useState(null);
  const [err, setErr] = useState('');
  const [starting, setStarting] = useState(false);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (facing) => {
    setErr('');
    stopStream();
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr('Camera is not available in this browser. You can still upload a photo.');
      return;
    }
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => {
          videoRef.current.onplaying = resolve;
        });
      }
    } catch (e) {
      const name = e?.name;
      const msg =
        name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access and try again.'
          : name === 'NotFoundError'
            ? 'No camera was found on this device.'
            : name === 'NotReadableError'
              ? 'The camera is busy in another app.'
              : 'Could not start the camera.';
      setErr(msg);
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!open) {
      stopStream();
      setShot(null);
      setErr('');
      return undefined;
    }
    startCamera(mode);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setErr('The camera is still starting — try again in a moment.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob) {
      setErr('Could not capture the photo. Try again.');
      return;
    }
    stopStream();
    setShot({ blob, url: URL.createObjectURL(blob) });
  };

  const retake = () => {
    if (shot?.url) URL.revokeObjectURL(shot.url);
    setShot(null);
    startCamera(mode);
  };

  const flip = () => setMode((m) => (m === 'user' ? 'environment' : 'user'));

  const confirm = () => {
    if (shot) onUse?.(shot.blob);
  };

  const close = () => {
    stopStream();
    if (shot?.url) URL.revokeObjectURL(shot.url);
    setShot(null);
    onClose?.();
  };

  if (!open) return null;

  const shownError = err || error;

  return (
    <Modal open={open} onClose={busy ? () => {} : close}>
      <div className="fade-in">
        <h3 style={{ marginTop: 0 }}>{title || 'Photo with riders'}</h3>
        <p className="small muted" style={{ marginBottom: 12 }}>
          Make sure you and every rider are clearly visible, then capture. The photo is stored securely and used only for
          trip safety.
        </p>
        {shownError && <div className="err-box mb">{shownError}</div>}

        {shot ? (
          <img src={shot.url} alt="Captured trip" style={{ width: '100%', borderRadius: 10, background: '#000' }} />
        ) : (
          <video ref={videoRef} style={{ width: '100%', borderRadius: 10, background: '#000' }} playsInline muted autoPlay />
        )}

        {!shot && (
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={flip} disabled={starting || busy}>
              🔄 Flip
            </button>
            <span className="small muted" style={{ alignSelf: 'center' }}>
              {mode === 'user' ? 'Front camera' : 'Back camera'}
            </span>
          </div>
        )}

        <div className="modal-actions" style={{ justifyContent: 'space-between', marginTop: 12 }}>
          <button type="button" className="btn" onClick={close} disabled={busy}>
            Cancel
          </button>
          {shot ? (
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={retake} disabled={busy}>
                ↺ Retake
              </button>
              <button type="button" className="btn btn-primary" onClick={confirm} disabled={busy}>
                {busy ? 'Saving…' : '✅ Use photo'}
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-primary" onClick={capture} disabled={busy || starting}>
              {starting ? 'Starting camera…' : '📷 Capture'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
