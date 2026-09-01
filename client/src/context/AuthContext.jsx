import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import i18n from '../i18n.js';
import client from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('btl_user') || 'null');
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('btl_token');
    if (!token) {
      setLoading(false);
      return;
    }
    client
      .get('/auth/me')
      .then(({ data }) => {
        setUser(data.user);
        localStorage.setItem('btl_user', JSON.stringify(data.user));
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem('btl_user');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      try {
        const saved = localStorage.getItem('btl_lang') || 'en';
        if (!localStorage.getItem('btl_lang_saved')) localStorage.setItem('btl_lang_saved', saved);
      } catch {
        /* ignore */
      }
      if (i18n.language !== 'en') i18n.changeLanguage('en');
    }
  }, [user]);

  const persist = useCallback((data) => {
    localStorage.setItem('btl_token', data.token);
    localStorage.setItem('btl_user', JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  const login = useCallback(
    async (identifier, password, extra = {}) => {
      const { data } = await client.post('/auth/login', { identifier, password, ...extra });
      persist(data);
      return data;
    },
    [persist]
  );

  const faceLogin = useCallback(
    async (email, descriptor) => {
      const { data } = await client.post('/auth/face-login', { email, descriptor });
      persist(data);
      return data;
    },
    [persist]
  );

  const sendOtp = useCallback(async (phone, purpose) => {
    const { data } = await client.post('/auth/send-otp', { phone, purpose });
    return data;
  }, []);

  const otpLogin = useCallback(
    async (phone, otp) => {
      const { data } = await client.post('/auth/otp-login', { phone, otp });
      persist(data);
      return data;
    },
    [persist]
  );

  const register = useCallback(
    async (payload) => {
      const { data } = await client.post('/auth/register', payload);
      persist(data);
      return data;
    },
    [persist]
  );

  const logout = useCallback(() => {
    try {
      const saved = localStorage.getItem('btl_lang_saved');
      localStorage.removeItem('btl_lang_saved');
      if (saved) {
        localStorage.setItem('btl_lang', saved);
        if (i18n.language !== saved) i18n.changeLanguage(saved);
      } else if (i18n.language !== 'en') {
        i18n.changeLanguage('en');
      }
    } catch {
      /* ignore */
    }
    localStorage.removeItem('btl_token');
    localStorage.removeItem('btl_user');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await client.get('/auth/me');
    setUser(data.user);
    localStorage.setItem('btl_user', JSON.stringify(data.user));
    return data.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, faceLogin, otpLogin, sendOtp, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
