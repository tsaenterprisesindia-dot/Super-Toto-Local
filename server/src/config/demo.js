// Seeded demo accounts, surfaced to the landing page so a presenter can jump
// into any role with one click. These credentials are already printed by the
// seeder on boot and documented in the README, so mirroring them here exposes
// nothing new. The endpoint that serves this list is disabled in production.
export const DEMO_ACCOUNTS = [
  { role: 'rider', name: 'Rider Demo', email: 'rider@supertoto.local', phone: '9000000002', password: 'Rider@Gangtok1' },
  { role: 'driver', name: 'Bikash Sharma', email: 'driver@supertoto.local', phone: '9000000003', password: 'Driver@Toto9' },
  { role: 'driver', name: 'Manoj Rai', email: 'driver2@supertoto.local', phone: '9000000004', password: 'Driver@Toto9' },
  { role: 'driver', name: 'Kumar Pradhan', email: 'driver3@supertoto.local', phone: '9000000005', password: 'Driver@Toto9' },
  { role: 'driver', name: 'Dorjee Bhutia (Ambulance)', email: 'ambo@supertoto.local', phone: '9000000006', password: 'Driver@Toto9' },
  { role: 'fleet_owner', name: 'Fleet Owner Demo', email: 'fleet@supertoto.local', phone: '9000000007', password: 'Fleet@Toto2k26' },
  { role: 'admin', name: 'Toto Admin', email: 'admin@supertoto.local', phone: '9000000001', password: 'Admin@Toto2k26' },
];
