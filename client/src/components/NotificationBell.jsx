import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../context/NotificationContext.jsx';

const TYPE_ICON = {
  ride: '🛺',
  payment: '💳',
  earnings: '💰',
  wallet: '👛',
  account: '✅',
  document: '📄',
  warning: '⚠️',
  suspension: '⛔',
  safety: '🆘',
  feedback: '💬',
  promo: '🏷️',
  system: '🔔',
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

export default function NotificationBell() {
  const { notifications, unread, markRead, markAllRead } = useNotifications();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const openNotification = (n) => {
    if (!n.read) markRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="notif-bell" ref={ref}>
      <button
        className="notif-bell-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('notifications.title')}
        title={t('notifications.title')}
      >
        🔔
        {unread > 0 && <span className="notif-bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-panel-head">
            <b>{t('notifications.title')}</b>
            {unread > 0 && (
              <button className="notif-clear" onClick={markAllRead}>
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>
          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">{t('notifications.empty')}</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  className={`notif-item${n.read ? '' : ' unread'}`}
                  onClick={() => openNotification(n)}
                >
                  <span className="notif-icon">{TYPE_ICON[n.type] || '🔔'}</span>
                  <span className="notif-body">
                    <span className="notif-title">{n.title}</span>
                    {n.message && <span className="notif-msg">{n.message}</span>}
                    <span className="notif-time">{timeAgo(n.createdAt, i18n.language)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}