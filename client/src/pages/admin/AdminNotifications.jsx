import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import client from '../../api/client.js';
import { useNotifications } from '../../context/NotificationContext.jsx';

const TYPE_ICON = {
  ride: '🛺', payment: '💳', earnings: '💰', wallet: '👛', account: '✅',
  document: '📄', warning: '⚠️', suspension: '⛔', safety: '🆘',
  feedback: '💬', promo: '🏷️', system: '🔔',
};

const TYPE_LABEL = {
  ride: 'Ride', payment: 'Payment', earnings: 'Earnings', wallet: 'Wallet', account: 'Account',
  document: 'Document', warning: 'Warning', suspension: 'Suspension', safety: 'SOS / Safety',
  feedback: 'Feedback', promo: 'Promo', system: 'System',
};

function timeAgo(iso, lang) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const n = (v) => Math.max(1, Math.floor(v));
  if (lang === 'hi') {
    if (diff < 60) return 'अभी';
    if (diff < 3600) return `${n(diff / 60)} मिनट पहले`;
    if (diff < 86400) return `${n(diff / 3600)} घंटे पहले`;
    return `${n(diff / 86400)} दिन पहले`;
  }
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${n(diff / 60)} min ago`;
  if (diff < 86400) return `${n(diff / 3600)} hr ago`;
  return `${n(diff / 86400)} days ago`;
}

export default function AdminNotifications() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { refresh, markRead, markAllRead } = useNotifications();

  const [filter, setFilter] = useState('all'); // all | unread
  const [type, setType] = useState('all');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async (f = filter, tp = type, append = false) => {
    setLoading(true); setErr('');
    try {
      const params = new URLSearchParams();
      if (f === 'unread') params.set('unread', 'true');
      if (tp !== 'all') params.set('type', tp);
      if (append) params.set('skip', String(items.length));
      params.set('limit', '50');
      const { data } = await client.get(`/notifications?${params.toString()}`);
      setItems(append ? [...items, ...data.notifications] : data.notifications);
      setTotal(data.total || 0);
    } catch (e) {
      setErr(e.response?.data?.message || t('tracker.errGeneric'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [filter, type]);

  const hasMore = items.length < total;

  const onOpen = (n) => {
    if (!n.read) {
      setItems((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      markRead(n.id);
    }
    if (n.link) navigate(n.link);
  };

  const onRemove = async (n) => {
    try {
      await client.post(`/notifications/${n.id}/remove`);
      setItems((p) => p.filter((x) => x.id !== n.id));
      setTotal((p) => Math.max(0, p - 1));
      refresh(true);
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not delete notification');
    }
  };

  const onMarkAll = async () => {
    setBusy(true); setMsg(''); setErr('');
    try {
      await markAllRead();
      setItems((p) => p.map((x) => ({ ...x, read: true })));
      setMsg(t('notifications.markAllDone'));
    } finally {
      setBusy(false);
    }
  };

  const onClearAll = async () => {
    if (!window.confirm(t('notifications.clearConfirm'))) return;
    setBusy(true); setMsg(''); setErr('');
    try {
      const { data } = await client.post('/notifications/clear-all', { readOnly: filter === 'unread' });
      setItems([]);
      setTotal(0);
      refresh(true);
      setMsg(t('notifications.clearDone', { deleted: data.deleted }));
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not clear notifications');
    } finally {
      setBusy(false);
    }
  };

  const unreadCount = useMemo(() => items.filter((x) => !x.read).length, [items]);

  return (
    <div className="page">
      <div className="spread">
        <h2>🔔 {t('notifications.centerTitle')}</h2>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={onMarkAll} disabled={busy || unreadCount === 0}>
            {t('notifications.markAllRead')}
          </button>
          <button className="btn btn-danger" onClick={onClearAll} disabled={busy || items.length === 0}>
            {t('notifications.clearAll')}
          </button>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
        {t('notifications.subtitle')} · {total} {t('notifications.total', { count: total })}
        {unreadCount > 0 && ` · ${unreadCount} ${t('notifications.unread')}`}
      </p>

      {err && <div className="err-box">{err}</div>}
      {msg && <div className="alert alert-green">{msg}</div>}

      <div className="row mb" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="tab-row" style={{ margin: 0 }}>
          <button className={`tab${filter === 'all' ? ' active' : ''}`} onClick={() => { setFilter('all'); setMsg(''); setErr(''); }}>
            {t('notifications.filterAll')}
          </button>
          <button className={`tab${filter === 'unread' ? ' active' : ''}`} onClick={() => { setFilter('unread'); setMsg(''); setErr(''); }}>
            {t('notifications.filterUnread')}
          </button>
        </div>
        <select className="input" style={{ width: 180 }} value={type} onChange={(e) => { setType(e.target.value); setMsg(''); setErr(''); }}>
          <option value="all">{t('notifications.filterAllTypes')}</option>
          {Object.keys(TYPE_LABEL).map((k) => (
            <option key={k} value={k}>{TYPE_ICON[k]} {TYPE_LABEL[k]}</option>
          ))}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading && items.length === 0 ? (
          <div className="notif-empty">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="notif-empty">
            {filter === 'unread' ? t('notifications.noUnread') : t('notifications.empty')}
          </div>
        ) : (
          <>
            {items.map((n) => (
              <div key={n.id} className={`notif-item-wrap${n.read ? '' : ' unread'}`}>
                <button
                  className="notif-item"
                  onClick={() => onOpen(n)}
                  style={{ flex: 1, textAlign: 'left', border: 'none', background: 'transparent', color: 'inherit' }}
                >
                  <span className="notif-icon">{TYPE_ICON[n.type] || '🔔'}</span>
                  <span className="notif-body">
                    <span className="notif-title">
                      {n.title}
                      <span className="small muted" style={{ marginLeft: 6 }}>{TYPE_LABEL[n.type] || n.type}</span>
                    </span>
                    {n.message && <span className="notif-msg">{n.message}</span>}
                    <span className="notif-time">{timeAgo(n.createdAt, i18n.language)}</span>
                  </span>
                </button>
                <button
                  className="notif-del"
                  aria-label={t('notifications.removeOne')}
                  title={t('notifications.removeOne')}
                  onClick={() => onRemove(n)}
                >
                  ✕
                </button>
              </div>
            ))}
            {hasMore && (
              <div style={{ padding: 12, textAlign: 'center' }}>
                <button className="btn btn-ghost" disabled={loading} onClick={() => load(filter, type, true)}>
                  {loading ? t('common.loading') : t('notifications.loadMore')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}