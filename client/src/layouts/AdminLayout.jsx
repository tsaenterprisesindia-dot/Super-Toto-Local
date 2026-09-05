import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import logo from '../assets/super-toto-logo.png';

const LINKS = [
  { to: '/admin', end: true, label: '📊 Overview' },
  { to: '/admin/drivers', label: '🛺 Drivers' },
  { to: '/admin/riders', label: '👤 Riders' },
  { to: '/admin/rides', label: '🚕 Rides' },
  { to: '/admin/reports', label: '💰 Reports' },
  { to: '/admin/cash', label: '💵 Cash Settlement' },
  { to: '/admin/sos', label: '🆘 SOS' },
  { to: '/admin/promos', label: '🏷️ Promos' },
  { to: '/admin/vehicle-rates', label: '🚗 Vehicle Rates' },
  { to: '/admin/state-fares', label: '🗺️ State Fares' },
  { to: '/admin/ads', label: '📢 Ad Manager' },
  { to: '/admin/safety-tips', label: '🛡️ Safety Tips' },
  { to: '/admin/bike-taxi', label: '🏍️ Bike Taxi' },
  { to: '/admin/feedback', label: '💬 Feedback' },
  { to: '/admin/compliance', label: '🗂️ Compliance' },
  { to: '/admin/settings', label: '⚙️ Settings' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const doLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img src={logo} alt="Super Toto Local logo" className="brand-logo" />
          <div>
            <div className="brand-name">Super Toto Local</div>
            <div className="admin-sub">Admin console</div>
          </div>
        </div>

        <nav className="admin-nav" data-tt="admin-nav">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-side-footer">
          <div className="admin-user">
            <span className="avatar">{user?.name?.[0]?.toUpperCase()}</span>
            <div>
              <b>{user?.name}</b>
              <div className="small muted">Administrator</div>
            </div>
          </div>
          <button className="logout-btn" onClick={doLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="admin-main" data-tt="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
