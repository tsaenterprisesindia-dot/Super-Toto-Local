import mongoose from 'mongoose';

// Singleton document holding admin-editable app configuration.
// pricing is merged over the PRICING defaults at read time.
const settingsSchema = new mongoose.Schema(
  {
    pricing: {
      type: Object,
      default: {},
    },
    vehicleRates: {
      type: Object,
      default: {},
    },
    feedbackConfig: {
      type: Object,
      default: {},
    },
    adsConfig: {
      type: Object,
      default: {},
    },
    safetyTipsConfig: {
      type: Object,
      default: {},
    },
    bikeTaxiConfig: {
      type: Object,
      default: {},
    },
    upiConfig: {
      type: Object,
      default: {},
    },
    contactConfig: {
      type: Object,
      default: {},
    },
    chatbotConfig: {
      type: Object,
      default: {},
    },
    seatBookingConfig: {
      type: Object,
      default: {},
    },
    compliance: {
      type: Object,
      default: {},
    },
    trainingConfig: {
      type: Object,
      default: {},
    },
    stateFares: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
