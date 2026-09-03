import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from './models/User.js';
import Ride from './models/Ride.js';
import { connectDB, stopDB } from './config/db.js';
import { computeFare, haversineKm, estimate } from './utils/pricing.js';

const DESTINATIONS = [
  { name: 'M.G. Marg', lat: 27.3358, lng: 88.614 },
  { name: 'Zero Point (Tashi View Point)', lat: 27.3653, lng: 88.6118 },
  { name: 'Paljor Stadium', lat: 27.3381, lng: 88.6146 },
  { name: 'Deorali', lat: 27.3231, lng: 88.6177 },
  { name: 'Tadong', lat: 27.3144, lng: 88.6128 },
  { name: 'Tibet Road', lat: 27.3338, lng: 88.615 },
  { name: 'SNT Bus Stand', lat: 27.3314, lng: 88.6193 },
  { name: 'Ranka / Baluwakhani', lat: 27.3229, lng: 88.6265 },
];

// Unique per-account credentials. Each demo account has its OWN password so no
// user can guess another account's password. These are demo-only values listed
// in the README (not exposed anywhere in the public app UI).
const PASSWORDS = {
  admin: 'Admin@Toto2k26',
  rider: 'Rider@Gangtok1',
  driver1: 'Driver@Toto9',
  driver2: 'Driver@Toto9',
  driver3: 'Driver@Toto9',
};

function buildRideData({ rider, driver, pickupIdx, dropIdx, daysAgo, paid = true, rated = true, method = 'UPI' }) {
  const pickup = DESTINATIONS[pickupIdx];
  const drop = DESTINATIONS[dropIdx];
  const distanceKm = haversineKm(pickup, drop);
  const { durationMin } = estimate(distanceKm);
  const fare = computeFare(distanceKm, durationMin);
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

  return {
    rider: rider._id,
    driver: driver._id,
    pickup: { name: pickup.name, lat: pickup.lat, lng: pickup.lng },
    drop: { name: drop.name, lat: drop.lat, lng: drop.lng },
    distanceKm: +distanceKm.toFixed(2),
    durationMin,
    fare: fare.total,
    fareBreakup: fare,
    status: 'completed',
    payment: {
      status: paid ? 'paid' : 'pending',
      method: paid ? method : '',
      amount: fare.total,
      paidAt: paid ? createdAt : null,
    },
    riderRating: rated ? 5 : null,
    driverRating: rated ? 5 : null,
    requestedAt: createdAt,
    acceptedAt: createdAt,
    arrivedAt: createdAt,
    startedAt: createdAt,
    completedAt: createdAt,
    createdAt,
  };
}

async function seedDatabase() {
  const adminPw = await bcrypt.hash(PASSWORDS.admin, 10);
  const riderPw = await bcrypt.hash(PASSWORDS.rider, 10);
  const driverPw = await bcrypt.hash(PASSWORDS.driver1, 10);

  const admin = await User.create({
    name: 'Toto Admin',
    email: 'admin@supertoto.local',
    phone: '9811997286',
    password: adminPw,
    role: 'admin',
  });

  const rider = await User.create({
    name: 'Rider Demo',
    email: 'rider@supertoto.local',
    phone: '9000000002',
    password: riderPw,
    role: 'rider',
  });

  const driver1 = await User.create({
    name: 'Bikash Sharma',
    email: 'driver@supertoto.local',
    phone: '9000000003',
    password: driverPw,
    role: 'driver',
    vehicleType: 'Toto (E-Rickshaw)',
    vehicleNumber: 'SK-01-T1200',
    vehicleDetails: { seats: 4, brand: 'Mahindra', model: 'E-Alfa Mini', color: 'Green', insuranceUpto: '2027-12-31', permitUpto: '2027-12-31' },
    driverStatus: 'approved',
    isOnline: true,
    location: { lat: 27.3345, lng: 88.6135 },
    rating: 4.9,
    ratingsCount: 12,
    earnings: 0,
    totalRides: 0,
    termsAcceptedAt: new Date(),
    termsVersion: '1.0',
    privacyConsentAt: new Date(),
    privacyConsentVersion: '1.0',
    aggregatorAgreementAcceptedAt: new Date(),
    trainingAcknowledgedAt: new Date(),
    documents: [
      { type: 'aadhaar', filename: 'aadhaar_demo.jpg', originalName: 'aadhaar.jpg', status: 'approved', reviewedAt: new Date() },
      { type: 'rc', filename: 'rc_demo.jpg', originalName: 'rc.jpg', status: 'approved', reviewedAt: new Date() },
      { type: 'license', filename: 'license_demo.jpg', originalName: 'license.jpg', status: 'approved', reviewedAt: new Date() },
      { type: 'bank', filename: 'bank_demo.jpg', originalName: 'bank.jpg', status: 'approved', reviewedAt: new Date() },
      { type: 'photo', filename: 'photo_demo.jpg', originalName: 'photo.jpg', status: 'approved', reviewedAt: new Date() },
      { type: 'pcc', filename: 'pcc_demo.jpg', originalName: 'pcc.jpg', status: 'approved', reviewedAt: new Date() },
    ],
  });

  const driver2 = await User.create({
    name: 'Manoj Rai',
    email: 'driver2@supertoto.local',
    phone: '9000000004',
    password: driverPw,
    role: 'driver',
    vehicleType: 'Toto (E-Rickshaw)',
    vehicleNumber: 'SK-02-T4521',
    vehicleDetails: { seats: 3, brand: 'Mahindra', model: 'E-Alfa Mini', color: 'Yellow', insuranceUpto: '2025-02-28', permitUpto: '2025-03-01' },
    driverStatus: 'approved',
    isOnline: true,
    location: { lat: 27.3375, lng: 88.6145 },
    rating: 4.7,
    ratingsCount: 8,
    earnings: 0,
    totalRides: 0,
    termsAcceptedAt: new Date(),
    termsVersion: '1.0',
    privacyConsentAt: new Date(),
    privacyConsentVersion: '1.0',
    aggregatorAgreementAcceptedAt: new Date(),
    trainingAcknowledgedAt: new Date(),
    documents: [
      { type: 'aadhaar', filename: 'aadhaar_demo.jpg', originalName: 'aadhaar.jpg', status: 'approved', reviewedAt: new Date() },
      { type: 'rc', filename: 'rc_demo.jpg', originalName: 'rc.jpg', status: 'approved', reviewedAt: new Date() },
      { type: 'license', filename: 'license_demo.jpg', originalName: 'license.jpg', status: 'approved', reviewedAt: new Date() },
      { type: 'bank', filename: 'bank_demo.jpg', originalName: 'bank.jpg', status: 'approved', reviewedAt: new Date() },
      { type: 'photo', filename: 'photo_demo.jpg', originalName: 'photo.jpg', status: 'approved', reviewedAt: new Date() },
      { type: 'pcc', filename: 'pcc_demo.jpg', originalName: 'pcc.jpg', status: 'approved', reviewedAt: new Date() },
    ],
  });

  const driver3 = await User.create({
    name: 'Kumar Pradhan',
    email: 'driver3@supertoto.local',
    phone: '9000000005',
    password: driverPw,
    role: 'driver',
    vehicleType: 'Auto Rickshaw',
    vehicleNumber: 'SK-03-T9876',
    driverStatus: 'pending',
    isOnline: false,
    location: { lat: 27.3314, lng: 88.6193 },
  });

  const rideSamples = [
    { pickupIdx: 0, dropIdx: 4, daysAgo: 1, paid: true, rated: true, method: 'UPI' },
    { pickupIdx: 1, dropIdx: 5, daysAgo: 2, paid: true, rated: true, method: 'Card' },
    { pickupIdx: 3, dropIdx: 0, daysAgo: 4, paid: true, rated: true, method: 'Cash' },
    { pickupIdx: 6, dropIdx: 2, daysAgo: 6, paid: true, rated: false, method: 'UPI' },
    { pickupIdx: 5, dropIdx: 7, daysAgo: 8, paid: false, rated: false, method: 'UPI' },
  ];

  const rides = await Ride.insertMany(
    rideSamples.map((s) => buildRideData({ rider, driver: driver1, ...s }))
  );

  const revenue = rides.reduce((sum, r) => sum + r.fareBreakup.driverEarnings, 0);
  await User.findByIdAndUpdate(driver1._id, { earnings: revenue, totalRides: rides.length });

  return { admin, rider, driver1, driver2, driver3, rides };
}

export async function seedIfEmpty(mongoServer) {
  const count = await User.countDocuments();
  if (count > 0) {
    console.log(`[seed] database already has ${count} users, skipping seed`);
    return;
  }
  const { rider, driver1 } = await seedDatabase();
  console.log('[seed] demo data created');
  console.log(`[seed]   rider:  rider@supertoto.local / ${PASSWORDS.rider}`);
  console.log(`[seed]   driver: driver@supertoto.local / ${PASSWORDS.driver1}`);
  console.log(`[seed]   admin:  admin@supertoto.local / ${PASSWORDS.admin}`);
  console.log('[seed]   face login: log in with password, then enroll a face in Profile to enable Face Recognition');
  await mongoServer?.waitUntilReady?.();
}

// Standalone runner: `npm run seed`
if (process.argv[1]?.endsWith('seed.js')) {
  const mongo = await connectDB();
  const count = await User.countDocuments();
  if (count === 0) {
    await seedDatabase();
    console.log('[seed] done. Seeded demo users + rides.');
  } else {
    console.log(`[seed] database already has ${count} users, skipping`);
  }
  await stopDB();
}
