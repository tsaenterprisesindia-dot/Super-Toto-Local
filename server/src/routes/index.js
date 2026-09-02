import { Router } from 'express';
import authRoutes from './auth.routes.js';
import faceRoutes from './face.routes.js';
import rideRoutes from './ride.routes.js';
import driverRoutes from './driver.routes.js';
import riderRoutes from './rider.routes.js';
import adminRoutes from './admin.routes.js';
import chatbotRoutes from './chatbot.routes.js';
import feedbackRoutes from './feedback.routes.js';
import { getFeedbackConfig, getAdsConfig, getSafetyTipsConfig, getBikeTaxiConfig, getUpiConfig, getContactConfig, getChatbotConfig, getSeatBookingConfig, getComplianceConfig, resolveFarePolicy, INDIA_STATES, stateName } from '../services/settings.js';

export default function routes(io) {
  const router = Router();
  router.use('/auth', authRoutes());
  router.use('/face', faceRoutes());
  router.use('/rides', rideRoutes(io));
  router.use('/driver', driverRoutes(io));
  router.use('/rider', riderRoutes());
  router.use('/chatbot', chatbotRoutes());
  router.use('/feedback', feedbackRoutes());
  router.use('/admin', adminRoutes(io));
  router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  // Public feedback config — riders/drivers need this to show/hide review panel
  router.get('/feedback-config', async (_req, res) => {
    try {
      res.json({ feedbackConfig: await getFeedbackConfig() });
    } catch (err) { res.json({ feedbackConfig: { enabled: true, discountAmount: 10 } }); }
  });
  // Public ads config — clients use this to show/hide ads
  router.get('/ads-config', async (_req, res) => {
    try {
      res.json({ adsConfig: await getAdsConfig() });
    } catch (err) { res.json({ adsConfig: { enabled: false, ads: [] } }); }
  });
  router.get('/safety-tips', async (_req, res) => {
    try {
      res.json({ safetyTips: await getSafetyTipsConfig() });
    } catch (err) { res.json({ safetyTips: { riderEnabled: true, driverEnabled: true, riderTips: [], driverTips: [] } }); }
  });
  router.get('/bike-taxi-config', async (_req, res) => {
    try {
      res.json({ bikeTaxiConfig: await getBikeTaxiConfig() });
    } catch (err) { res.json({ bikeTaxiConfig: { enabled: true } }); }
  });
  router.get('/upi-config', async (_req, res) => {
    try {
      res.json({ upiConfig: await getUpiConfig() });
    } catch (err) { res.json({ upiConfig: { upiId: process.env.UPI_ID || '', merchantName: 'Super Toto Local', enabled: true, showQr: true } }); }
  });
  router.get('/contact-config', async (_req, res) => {
    try {
      res.json({ contactConfig: await getContactConfig() });
    } catch (err) { res.json({ contactConfig: { helplinePhone: '+919811997286', helplineLabel: '24×7 Helpline', showHelpline: true } }); }
  });
  router.get('/chatbot-config', async (_req, res) => {
    try {
      res.json({ chatbotConfig: await getChatbotConfig() });
    } catch (err) { res.json({ chatbotConfig: { enabled: true, botName: 'Toto Assist', greeting: 'Hi! 👋' } }); }
  });
  router.get('/seat-booking-config', async (_req, res) => {
    try {
      res.json({ seatBookingConfig: await getSeatBookingConfig() });
    } catch (err) { res.json({ seatBookingConfig: { mode: 'shared' } }); }
  });

  // Public: fare policy for a state (what the fare engine will apply).
  router.get('/fare-policy', async (req, res) => {
    try {
      const stateCode = String(req.query.state || '').trim().toUpperCase();
      const sp = await resolveFarePolicy(stateCode);
      if (!sp) {
        return res.json({ available: false, states: INDIA_STATES.length, message: 'No active fare policy for this state — national default fares apply.' });
      }
      res.json({
        available: true,
        stateCode: sp.stateCode,
        stateName: sp.stateName,
        policy: {
          status: sp.policy.status,
          effectiveFrom: sp.policy.effectiveFrom,
          effectiveUntil: sp.policy.effectiveUntil,
          sourceLabel: sp.policy.sourceLabel,
          sourceUrl: sp.policy.sourceUrl,
          surgeCap: sp.surgeCap,
          cancellationFee: sp.cancellationFee ?? null,
          notes: sp.policy.notes,
        },
        vehicleRates: sp.vehicleRates,
        // For riders' convenience: all states whether they have a policy or not
        states: INDIA_STATES.map((s) => ({ code: s.code, name: s.name })),
        defaultState: stateName(''),
      });
    } catch (err) {
      res.status(500).json({ message: 'Could not load fare policy' });
    }
  });
  // Public disclosure endpoints (IT Rules 2021 / Consumer Protection (E-Commerce) Rules 2020)
  router.get('/grievance', async (_req, res) => {
    try {
      const c = await getComplianceConfig();
      res.json({ grievanceOfficer: c.grievanceOfficer, privacyPolicyVersion: '1.0', lastUpdated: new Date().toISOString() });
    } catch (err) {
      res.json({ grievanceOfficer: {}, privacyPolicyVersion: '1.0' });
    }
  });
  router.get('/disclosures', async (_req, res) => {
    try {
      const c = await getComplianceConfig();
      res.json({
        legalEntityName: c.legalEntityName,
        gstin: c.gstin,
        operatingState: c.operatingState,
        surgeCap: c.surgeCap,
        cancellationFee: c.cancellationFee,
        cancellationPolicy: c.cancellationPolicy,
        insurancePolicyNo: c.insurancePolicyNo,
        passengerInsuranceNote: c.passengerInsuranceNote,
      });
    } catch (err) {
      res.json({});
    }
  });
  return router;
}

