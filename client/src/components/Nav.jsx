import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client.js';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import logo from '../assets/super-toto-logo.png';

export default function Nav() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [contact, setContact] = useState({ helplinePhone: '', helplineLabel: '', showHelpline: true });

  useEffect(() => {
    client.get('/contact-config').then(({ data }) => setContact(data.contactConfig || {})).catch(() => {});
  }, []);

  const home = user?.role === 'driver' ? '/driver' : user?.role === 'admin' ? '/admin' : '/ride';
  const helplineLabel = contact.helplineLabel || t('nav.helpline');

  const doLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="nav">
      <Link to={user ? home : '/'} className="brand">
        <img src={logo} alt="Super Toto Local logo" className="brand-logo" />
        <span>
          <span className="brand-name">{t('common.appName')}</span>
          <span className="brand-unit">{t('common.appUnit')}</span>
        </span>
      </Link>
      <div className="nav-links">
        {user?.role === 'rider' && (
          <>
            <NavLink to="/ride" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              {t('nav.bookAToto')}
            </NavLink>
            <NavLink to="/offers" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              {t('nav.offers')}
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              {t('nav.myRides')}
            </NavLink>
            <NavLink to="/feedback" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              {t('nav.feedback')}
            </NavLink>
          </>
        )}
        {user?.role === 'driver' && (
          <>
            <NavLink to="/history" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              {t('nav.myRides')}
            </NavLink>
            <NavLink to="/feedback" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              {t('nav.feedback')}
            </NavLink>
          </>
        )}
        {user?.role === 'admin' && (
          <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            {t('nav.adminConsole')}
          </NavLink>
        )}
        {user && contact.showHelpline && contact.helplinePhone && (
          <a
            className="helpline-btn"
            href={`tel:${contact.helplinePhone}`}
            title={t('nav.helplineTitle', { label: helplineLabel, phone: contact.helplinePhone })}
          >
            <span className="helpline-icon">🆘</span>
            <span className="helpline-text">{helplineLabel}</span>
          </a>
        )}
        <NavLink to="/profile" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          {t('nav.profile')}
        </NavLink>
        <div className="user-chip">
          <span className="avatar">{user?.name?.[0]?.toUpperCase()}</span>
          <span className="small muted">{user?.name}</span>
        </div>
        {user?.role !== 'admin' && <LanguageSwitcher />}
        <button className="logout-btn" onClick={doLogout}>
          {t('nav.logout')}
        </button>
      </div>
    </nav>
  );
}
