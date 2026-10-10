import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import ChatBot from './components/ChatBot.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import FaceLogin from './pages/FaceLogin.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import TrackRide from './pages/TrackRide.jsx';
import RiderHome from './pages/RiderHome.jsx';
import DriverHome from './pages/DriverHome.jsx';
import RideHistory from './pages/RideHistory.jsx';
import Profile from './pages/Profile.jsx';
import RiderTerms from './pages/RiderTerms.jsx';
import DriverTerms from './pages/DriverTerms.jsx';
import DriverDocuments from './pages/DriverDocuments.jsx';
import VehicleDetails from './pages/VehicleDetails.jsx';
import RiderDocuments from './pages/RiderDocuments.jsx';
import Offers from './pages/Offers.jsx';
import Feedback from './pages/Feedback.jsx';
import Privacy from './pages/legal/Privacy.jsx';
import Disclosures from './pages/legal/Disclosures.jsx';
import DriverAgreement from './pages/legal/DriverAgreement.jsx';
import AmbulanceDriverTerms from './pages/legal/AmbulanceDriverTerms.jsx';
import AmbulanceAgreement from './pages/legal/AmbulanceAgreement.jsx';
import AmbulanceRiderTerms from './pages/legal/AmbulanceRiderTerms.jsx';
import FleetDashboard from './pages/fleet/FleetDashboard.jsx';
import FleetVehicles from './pages/fleet/FleetVehicles.jsx';
import FleetDrivers from './pages/fleet/FleetDrivers.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import AdminOverview from './pages/admin/AdminOverview.jsx';
import AdminDrivers from './pages/admin/AdminDrivers.jsx';
import AdminRiders from './pages/admin/AdminRiders.jsx';
import AdminRides from './pages/admin/AdminRides.jsx';
import AdminReports from './pages/admin/AdminReports.jsx';
import AdminCash from './pages/admin/AdminCash.jsx';
import AdminSOS from './pages/admin/AdminSOS.jsx';
import AdminPromos from './pages/admin/AdminPromos.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';
import AdminVehicleRates from './pages/admin/AdminVehicleRates.jsx';
import AdminAds from './pages/admin/AdminAds.jsx';
import AdminSafetyTips from './pages/admin/AdminSafetyTips.jsx';
import AdminBikeTaxi from './pages/admin/AdminBikeTaxi.jsx';
import AdminFeedback from './pages/admin/AdminFeedback.jsx';
import AdminCompliance from './pages/admin/AdminCompliance.jsx';
import AdminAmbulances from './pages/admin/AdminAmbulances.jsx';
import AdminFleet from './pages/admin/AdminFleet.jsx';
import DriverAmbulance from './pages/DriverAmbulance.jsx';
import AdminEmergency from './pages/admin/AdminEmergency.jsx';
import AdminNotifications from './pages/admin/AdminNotifications.jsx';
import AdminStateFares from './pages/admin/AdminStateFares.jsx';

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loader">Loadingâ€¦</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'driver' ? '/driver' : user.role === 'admin' ? '/admin' : '/'} replace />;
  }
  // Terms gate: non-admin users must accept T&C before accessing main features.
  if (user.role !== 'admin' && !user.termsAcceptedAt) {
    const termsPath = user.role === 'driver' ? '/terms/driver' : '/terms/rider';
    if (typeof window !== 'undefined' && window.location.pathname === termsPath) return children;
    return <Navigate to={termsPath} replace />;
  }
  // Rider identity verification gate: riders can book, but document page available for uploading
  return children;
}

export default function App() {
  return (
    <>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/face-login" element={<FaceLogin />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/register" element={<Register />} />
      <Route path="/track/:token" element={<TrackRide />} />
      <Route path="/legal/privacy" element={<Privacy />} />
      <Route path="/legal/disclosures" element={<Disclosures />} />

      <Route
        path="/legal/aggregator-agreement"
        element={
          <Protected roles={['rider', 'driver']}>
            <DriverAgreement />
          </Protected>
        }
      />

      <Route
        path="/legal/ambulance-agreement"
        element={
          <Protected roles={['driver']}>
            <AmbulanceAgreement />
          </Protected>
        }
      />

      <Route path="/legal/ambulance-rider-terms" element={<AmbulanceRiderTerms />} />

      <Route
        path="/terms/ambulance"
        element={
          <Protected roles={['driver']}>
            <AmbulanceDriverTerms />
          </Protected>
        }
      />

      <Route
        path="/terms/rider"
        element={
          <Protected roles={['rider']}>
            <RiderTerms />
          </Protected>
        }
      />
      <Route
        path="/terms/driver"
        element={
          <Protected roles={['driver']}>
            <DriverTerms />
          </Protected>
        }
      />
      <Route
        path="/ride"
        element={
          <Protected roles={['rider']}>
            <RiderHome />
          </Protected>
        }
      />
      <Route
        path="/rider/documents"
        element={
          <Protected roles={['rider']}>
            <RiderDocuments />
          </Protected>
        }
      />
      <Route
        path="/offers"
        element={
          <Protected roles={['rider']}>
            <Offers />
          </Protected>
        }
      />
      <Route
        path="/history"
        element={
          <Protected roles={['rider', 'driver']}>
            <RideHistory />
          </Protected>
        }
      />
      <Route
        path="/feedback"
        element={
          <Protected roles={['rider', 'driver']}>
            <Feedback />
          </Protected>
        }
      />
      <Route
        path="/driver"
        element={
          <Protected roles={['driver']}>
            <DriverHome />
          </Protected>
        }
      />
      <Route
        path="/driver/documents"
        element={
          <Protected roles={['driver']}>
            <DriverDocuments />
          </Protected>
        }
      />
      <Route
        path="/driver/vehicle"
        element={
          <Protected roles={['driver']}>
            <VehicleDetails />
          </Protected>
        }
      />
      <Route
        path="/driver/ambulance"
        element={
          <Protected roles={['driver']}>
            <DriverAmbulance />
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={
          <Protected roles={['admin']}>
            <AdminLayout />
          </Protected>
        }
      >
        <Route index element={<AdminOverview />} />
        <Route path="drivers" element={<AdminDrivers />} />
        <Route path="riders" element={<AdminRiders />} />
        <Route path="rides" element={<AdminRides />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="cash" element={<AdminCash />} />
        <Route path="sos" element={<AdminSOS />} />
        <Route path="promos" element={<AdminPromos />} />
        <Route path="vehicle-rates" element={<AdminVehicleRates />} />
        <Route path="ads" element={<AdminAds />} />
        <Route path="safety-tips" element={<AdminSafetyTips />} />
        <Route path="bike-taxi" element={<AdminBikeTaxi />} />
        <Route path="feedback" element={<AdminFeedback />} />
        <Route path="compliance" element={<AdminCompliance />} />
        <Route path="emergency" element={<AdminEmergency />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="state-fares" element={<AdminStateFares />} />
        <Route path="ambulances" element={<AdminAmbulances />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
      <Route
        path="/profile"
        element={
          <Protected roles={['rider', 'driver', 'admin']}>
            <Profile />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/fleet" element={<Protected roles={['fleet_owner']}><FleetDashboard/></Protected>}/>
      <Route path="/fleet/vehicles" element={<Protected roles={['fleet_owner']}><FleetVehicles/></Protected>}/>
      <Route path="/fleet/drivers" element={<Protected roles={['fleet_owner']}><FleetDrivers/></Protected>}/>    
      <Route path='/admin/fleet' element={<Protected roles={['admin']}><AdminFleet/></Protected>}/>
    </Routes>
    <GlobalChat />
    </>
  );
}

function GlobalChat() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return <ChatBot />;
}



