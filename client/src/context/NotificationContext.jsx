import { createContext, useContext, useEffect, useCallback, useRef, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from './AuthContext.jsx';
import { useSocket } from './SocketContext.jsx';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const initRef = useRef({});

  const refresh = useCallback(async (silent = false) => {
    try {
      const [{ data }, un] = await Promise.all([
        client.get('/notifications'),
        client.get('/notifications/unread-count'),
      ]);
      setNotifications(data.notifications || []);
      setUnread(un.data.count || 0);
    } catch (err) {
      if (!silent && err.response?.status !== 401) console.warn('notification load failed', err);
    }
  }, []);

  // Load once per user session
  useEffect(() => {
    if (!user) {
      initRef.current = {};
      setNotifications([]);
      setUnread(0);
      return;
    }
    if (initRef.current[user.id]) return;
    initRef.current[user.id] = true;
    refresh();
  }, [user?.id, refresh]);

  // Real-time: prepend notifications pushed over the socket
  useEffect(() => {
    if (!socket) return;
    const onNew = (n) => {
      setNotifications((prev) => [n, ...prev].slice(0, 50));
      setUnread((u) => u + 1);
    };
    socket.on('notification:new', onNew);
    return () => socket.off('notification:new', onNew);
  }, [socket]);

  const markRead = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnread((u) => Math.max(0, u - 1));
    try {
      await client.post(`/notifications/${id}/read`);
    } catch { /* optimistic */ }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await client.post('/notifications/read-all');
    } catch { /* optimistic */ }
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unread, refresh, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}