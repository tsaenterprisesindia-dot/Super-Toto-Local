import mongoose from 'mongoose';

// Cash-ledger audit trail.
//
// When a rider pays a driver in cash, the driver physically collects the whole
// fare (incl. GST). The driver's NET share (gross − commission) is theirs to keep,
// but the platform's share (commission + GST collected under Sec 9(5)) is owed
// back to the platform. We track every cash collection, deposit, and automatic
// deduction here so the driver and admin can reconcile the balance.
const cashLedgerSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    entries: [
      {
        type: {
          type: String,
          enum: ['cash_collected', 'deposit', 'auto_deduct'],
          required: true,
        },
        rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', default: null },
        amount: { type: Number, required: true }, // platform share; positive adds to cashDue, negative pays it down
        note: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    totalCollected: { type: Number, default: 0 }, // lifetime cash collected (platform share)
    totalSettled: { type: Number, default: 0 },   // lifetime returned (deposits + auto-deductions)
  },
  { timestamps: true }
);

export const CashLedger = mongoose.model('CashLedger', cashLedgerSchema);