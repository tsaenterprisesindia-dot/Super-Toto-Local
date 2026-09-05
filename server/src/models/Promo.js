import mongoose from 'mongoose';

const promoCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ['pct', 'fixed'], default: 'pct' }, // pct = % off, fixed = flat amount off
    value: { type: Number, required: true, min: 0 }, // 10 => 10% OR ₹10 depending on type
    maxDiscount: { type: Number, default: null }, // cap on the absolute discount (pct codes)
    minFare: { type: Number, default: 0 }, // trip fare must be at least this for the code to apply
    description: { type: String, default: '' },

    active: { type: Boolean, default: true },
    validFrom: { type: Date, default: null },
    validUntil: { type: Date, default: null },

    usageLimit: { type: Number, default: null }, // global redemption cap
    usedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 }, // how many times one rider may redeem it
    redeemedBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        count: { type: Number, default: 1 },
        lastUsedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const Promo = mongoose.model('Promo', promoCodeSchema);