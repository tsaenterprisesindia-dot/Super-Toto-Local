import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useFace } from '../context/FaceProvider.jsx';
import FaceCapture from '../components/FaceCapture.jsx';
import logo from '../assets/super-toto-logo.png';

export default function FaceLogin() {
  const { faceLogin } = useAuth();
  const face = useFace();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [faceOpen, setFaceOpen] = useState(false);

  const startScan = (e) => {
    e.preventDefault();
    if (!email) return setError('Enter your email first');
    setError('');
    setInfo('');
    setFaceOpen(true);
  };

  const captureAndLogin = async () => {
    setError('');
    setInfo('');
    setBusy(true);
    const res = await face.captureDescriptor();
    face.stopStream();
    if (!res.ok) {
      setError(res.message);
      setBusy(false);
      return;
    }
    try {
      await faceLogin(email, res.descriptor);
      setFaceOpen(false);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.message;
      if (err.response?.status === 403 && /No face enrolled/i.test(msg || '')) {
        setError('No face enrolled for this account. Log in with password, then register your face in Profile.');
      } else if (err.response?.status === 403 && /Admin/i.test(msg || '')) {
        setError('Admins always log in with password.');
      } else {
        setError(msg || 'Face login failed');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card fade-in">
        <div className="auth-title">
          <img src={logo} alt="Super Toto Local logo" className="auth-logo" /> Face login
        </div>
        <p className="muted">Log in by scanning your face</p>

        {error && <div className="err-box">{error}</div>}
        {info && <div className="alert alert-green mb">{info}</div>}

        {!face.ready ? (
          <div className="alert alert-info">
            {face.loading ? 'Loading the face recognition engine… (models download ~7MB the first time)' : face.loadError || 'Face recognition is not available on this device.'}
          </div>
        ) : (
          <form onSubmit={startScan}>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={!email || busy}>
              Scan my face
            </button>
          </form>
        )}

        <div className="card mt" style={{ background: 'var(--bg)', boxShadow: 'none' }}>
          <p className="small muted mb" style={{ margin: 0 }}>
            Your image stays on this device; only your face descriptor is sent to compare with your stored face.
            Admins always sign in with password.
          </p>
        </div>

        <div className="small muted mt" style={{ textAlign: 'center' }}>
          <Link to="/login">Back to password login</Link>
        </div>
      </div>

      <FaceCapture
        open={faceOpen}
        onClose={() => {
          setFaceOpen(false);
          face.stopStream();
        }}
        videoRef={face.videoRef}
        startCamera={face.startCamera}
        onCapture={captureAndLogin}
        loading={busy}
        title="Look at the camera to log in"
      />
    </div>
  );
}
