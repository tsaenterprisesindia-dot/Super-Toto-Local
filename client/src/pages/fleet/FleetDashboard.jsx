import { Link } from 'react-router-dom';

export default function FleetDashboard() {
  return (
    <div className="container">
      <div className="card">
        <h2>Fleet Owner Dashboard</h2>
        <p className="muted">Manage vehicles and drivers under your fleet.</p>
        <div className="row" style={{ gap: 12, marginTop: 16 }}>
          <Link to="/fleet/vehicles" className="btn btn-primary">Manage Vehicles</Link>
          <Link to="/fleet/drivers" className="btn btn-ghost">Manage Drivers</Link>
        </div>
      </div>
    </div>
  );
}
