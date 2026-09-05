import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { availableTours } from '../tutorial/tutorials.js';

const WATCH_KEY = 'stl_tt_watched';

function getWatched() {
  try {
    return JSON.parse(localStorage.getItem(WATCH_KEY) || '[]');
  } catch {
    return [];
  }
}

function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const vs = window.speechSynthesis.getVoices() || [];
  const en = vs.filter((v) => (v.lang || '').toLowerCase().startsWith('en'));
  return en.find((v) => (v.lang || '').includes('-IN')) || en.find((v) => (v.lang || '').includes('-GB')) || en[0] || null;
}

export default function TutorialPlayer() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [tourId, setTourId] = useState(null);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [watched, setWatched] = useState(getWatched);

  const pausedRef = useRef(paused);
  const mutedRef = useRef(muted);
  const glowNode = useRef(null);
  const tour = tourId ? availableTours(user).find((x) => x.id === tourId) : null;
  const tourLen = tour ? tour.steps.length : 0;

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    if (!tour) return;
    const s = tour.steps[step];
    if (!s) return; // finished -> handled below
    let cancelled = false;
    let interval;
    const cleanupFx = () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      removeGlow();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };

    const advance = () => {
      if (cancelled) return;
      if (pausedRef.current) {
        interval = setInterval(() => {
          if (!pausedRef.current && !cancelled) {
            clearInterval(interval);
            setStep((x) => Math.min(tourLen - 1, x + 1));
          }
        }, 250);
        return;
      }
      setStep((x) => Math.min(tourLen - 1, x + 1));
    };

    (async () => {
      if (s.route && s.route !== location.pathname) {
        navigate(s.route);
        return;
      }
      await new Promise((r) => setTimeout(r, 120));
      if (cancelled) return;
      applyGlow(s.highlight);
      if (!s.text) {
        await new Promise((r) => setTimeout(r, s.wait ?? 800));
        advance();
        return;
      }
      await speakText(s.text);
      if (cancelled) return;
      await new Promise((r) => setTimeout(r, s.wait ?? 900));
      advance();
    })();

    return cleanupFx;
  }, [tourId, step, location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tour finished: mark watched and close.
  useEffect(() => {
    if (tour && step >= tourLen) {
      finishTour();
    }
  }, [step, tourLen]); // eslint-disable-line react-hooks/exhaustive-deps

  function speakText(text) {
    return new Promise((resolve) => {
      if (mutedRef.current || !('speechSynthesis' in window)) return resolve();
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = 0.98;
      u.pitch = 1.02;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }

  function applyGlow(sel) {
    removeGlow();
    if (!sel) return;
    const el = document.querySelector(sel);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('tt-glow');
    glowNode.current = el;
  }

  function removeGlow() {
    if (glowNode.current) {
      glowNode.current.classList.remove('tt-glow');
      glowNode.current = null;
    }
  }

  function finishTour() {
    if (tour) {
      const w = getWatched();
      if (!w.includes(tour.id)) {
        w.push(tour.id);
        try {
          localStorage.setItem(WATCH_KEY, JSON.stringify(w));
        } catch {}
        setWatched(w);
      }
    }
    removeGlow();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setTourId(null);
    setStep(0);
    setPaused(false);
  }

  function startTour(id) {
    setTourId(id);
    setStep(0);
    setPaused(false);
    setOpen(false);
  }

  const tours = availableTours(user);

  return (
    <>
      {!tourId && (
        <button className="tt-fab" onClick={() => setOpen((o) => !o)} aria-label={t('tutorial.fab')} title={t('tutorial.fab')}>
          🎬
        </button>
      )}

      {open && !tourId && (
        <div className="tt-menu">
          <div className="tt-menu-head">
            <b>{t('tutorial.menuTitle')}</b>
            <button className="tt-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>
          <div className="tt-menu-sub">{t('tutorial.menuSub')}</div>
          <div className="tt-tours">
            {tours.map((tr) => (
              <button key={tr.id} className="tt-tour" onClick={() => startTour(tr.id)}>
                <span className="tt-tour-icon">{tr.icon}</span>
                <span className="tt-tour-body">
                  <b>{tr.title}</b>
                  <span className="small muted">{tr.desc}</span>
                  <span className="tt-tour-meta">
                    {tr.steps.length} {t('tutorial.steps')}
                    {watched.includes(tr.id) && <span className="tt-watched">✓ {t('tutorial.watched')}</span>}
                  </span>
                </span>
                <span className="tt-play">▶</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tour && step < tourLen && (
        <div className="tt-panel">
          <div className="tt-head">
            <span className="tt-head-icon">🎬</span>
            <div className="tt-head-text">
              <b>{tour.title}</b>
              <div className="small muted">
                {step + 1} / {tourLen} · {t('tutorial.stepOf')}
              </div>
            </div>
            <button className="tt-close" onClick={finishTour} aria-label={t('tutorial.end')}>{t('tutorial.end')}</button>
          </div>
          <div className="tt-body">
            <div className="tt-speaker">{paused ? '⏸' : '🔊'}</div>
            <div className="tt-text">{tour.steps[step].text}</div>
          </div>
          <div className="tt-progress">
            {tour.steps.map((_, i) => (
              <span key={i} className={`tt-dot${i <= step ? ' filled' : ''}`} />
            ))}
          </div>
          <div className="tt-actions">
            <button className="tt-btn" disabled={step === 0} onClick={() => setStep((x) => Math.max(0, x - 1))} aria-label={t('tutorial.prev')}>⏮</button>
            <button className="tt-btn" onClick={() => setPaused((p) => !p)}>
              {paused ? t('tutorial.resume') : t('tutorial.pause')}
            </button>
            <button className="tt-btn" onClick={() => setMuted((m) => !m)} aria-label={muted ? t('tutorial.mutedOff') : t('tutorial.mutedOn')}>
              {muted ? t('tutorial.mutedOn') : t('tutorial.mutedOff')}
            </button>
            <button className="tt-btn tt-next" onClick={() => setStep((x) => Math.min(tourLen - 1, x + 1))}>{t('tutorial.next')} ⏭</button>
          </div>
        </div>
      )}
    </>
  );
}