import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Nav from '../components/Nav.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client.js';

const CATEGORY_OPTIONS = [
  { value: 'ride', icon: '🚕', labelKey: 'feedback.catRide' },
  { value: 'driver', icon: '🛺', labelKey: 'feedback.catDriver' },
  { value: 'fare', icon: '💰', labelKey: 'feedback.catFare' },
  { value: 'payment', icon: '💳', labelKey: 'feedback.catPayment' },
  { value: 'app', icon: '📱', labelKey: 'feedback.catApp' },
  { value: 'safety', icon: '🛡️', labelKey: 'feedback.catSafety' },
  { value: 'vehicle', icon: '🚗', labelKey: 'feedback.catVehicle' },
  { value: 'other', icon: '📝', labelKey: 'feedback.catOther' },
];

const STATUS_STYLES = {
  open: 'badge-amber',
  'under-review': 'badge-blue',
  resolved: 'badge-green',
  closed: 'badge-gray',
};

export default function Feedback() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [tab, setTab] = useState('submit');
  const [type, setType] = useState('complaint');
  const [category, setCategory] = useState('other');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [mine, setMine] = useState([]);
  const [loadingMine, setLoadingMine] = useState(false);

  const loadMine = async () => {
    setLoadingMine(true);
    let items = [];
    try {
      const { data } = await client.get('/feedback/mine');
      items = data.feedback || [];
    } catch {
      items = [];
    }
    setMine(items);
    setLoadingMine(false);
  };

  useEffect(() => {
    if (tab === 'mine' && mine.length === 0) loadMine();
  }, [tab]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!message.trim()) {
      setError(t('feedback.errMessage'));
      return;
    }
    setSubmitting(true);
    try {
      await client.post('/feedback', { type, category, subject, message, priority });
      setSuccess(type === 'complaint' ? t('feedback.complaintSent') : t('feedback.suggestionSent'));
      setSubject('');
      setMessage('');
      setType('complaint');
      setCategory('other');
    } catch (e) {
      setError(e.response?.data?.message || t('feedback.errSubmit'));
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      <Nav />
      <div className="page" style={{ maxWidth: 720 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{t('feedback.title')}</h2>
          <span className="muted small">{user?.name}</span>
        </div>

        <div className="seg-row" style={{ maxWidth: 360, marginBottom: 16 }}>
          <button className={`seg${tab === 'submit' ? ' active' : ''}`} onClick={() => setTab('submit')} type="button">
            {t('feedback.tabSubmit')}
          </button>
          <button className={`seg${tab === 'mine' ? ' active' : ''}`} onClick={() => setTab('mine')} type="button">
            {t('feedback.tabMine')}
          </button>
        </div>

        {tab === 'submit' ? (
          <form onSubmit={submit} className="card">
            <div className="seg-row mb">
              <button type="button" className={`seg${type === 'complaint' ? ' active' : ''}`} onClick={() => setType('complaint')}>
                ⚠️ {t('feedback.typeComplaint')}
              </button>
              <button type="button" className={`seg${type === 'suggestion' ? ' active' : ''}`} onClick={() => setType('suggestion')}>
                💡 {t('feedback.typeSuggestion')}
              </button>
            </div>

            <div className="field">
              <label>{t('feedback.category')}</label>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.icon} {t(c.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>{t('feedback.subject')}</label>
              <input
                className="input"
                value={subject}
                maxLength={120}
                placeholder={t('feedback.subjectPlaceholder')}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="field">
              <label>{t('feedback.message')}</label>
              <textarea
                className="input"
                rows={5}
                value={message}
                maxLength={2000}
                placeholder={type === 'complaint' ? t('feedback.complaintPlaceholder') : t('feedback.suggestionPlaceholder')}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="field">
              <label>{t('feedback.priority')}</label>
              <div className="seg-row">
                <button type="button" className={`seg${priority === 'low' ? ' active' : ''}`} onClick={() => setPriority('low')}>
                  {t('feedback.pLow')}
                </button>
                <button type="button" className={`seg${priority === 'medium' ? ' active' : ''}`} onClick={() => setPriority('medium')}>
                  {t('feedback.pMedium')}
                </button>
                <button type="button" className={`seg${priority === 'high' ? ' active' : ''}`} onClick={() => setPriority('high')}>
                  {t('feedback.pHigh')}
                </button>
              </div>
            </div>

            {type === 'complaint' && <p className="small muted">{t('feedback.complaintNote')}</p>}
            {success && <div className="alert alert-green">{success}</div>}
            {error && <div className="err-box">{error}</div>}

            <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
              {submitting ? `${t('feedback.submitting')}…` : t('feedback.submit')}
            </button>
          </form>
        ) : (
          <div className="stack">
            {loadingMine ? (
              <div className="alert alert-info">{t('common.loading')}</div>
            ) : mine.length === 0 ? (
              <div className="card muted" style={{ textAlign: 'center', padding: 28 }}>
                {t('feedback.noReports')}
              </div>
            ) : (
              mine.map((f) => (
                <div className="card" key={f._id}>
                  <div className="spread" style={{ marginBottom: 8 }}>
                    <span>
                      <b>{f.type === 'complaint' ? '⚠️' : '💡'} {f.subject || (f.type === 'complaint' ? t('feedback.typeComplaint') : t('feedback.typeSuggestion'))}</b>
                      <span className="muted small" style={{ marginLeft: 8 }}>{fmtDate(f.createdAt)}</span>
                    </span>
                    <span className={`badge ${STATUS_STYLES[f.status] || 'badge-blue'}`}>
                      {t(`feedback.status.${f.status}`)}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{f.message}</p>
                  <div className="small muted">
                    {f.category ? t(`feedback.cat${f.category[0].toUpperCase()}${f.category.slice(1)}`) : ''}
                    {f.priority === 'high' && <span style={{ marginLeft: 8 }}>🔴 {t('feedback.pHigh')}</span>}
                  </div>
                  {f.adminNote && <div className="alert alert-info small mt">{t('feedback.adminResponse')}: {f.adminNote}</div>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}