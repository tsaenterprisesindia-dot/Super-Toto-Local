import mongoose from 'mongoose';

const rideSchema = new mongoose.Schema(
  {
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    pickup: {
      name: { type: String, default: 'Pickup' },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    drop: {
      name: { type: String, default: 'Drop' },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },

    distanceKm: { type: Number, default: 0 },
    durationMin: { type: Number, default: 0 },
    vehicleType: { type: String, default: 'toto' },
    stateCode: { type: String, default: '' },
    farePolicy: {
      stateCode: { type: String, default: '' },
      stateName: { type: String, default: '' },
      sourceLabel: { type: String, default: '' },
      effectiveFrom: { type: String, default: '' },
    },
    luggage: {
      count: { type: Number, default: 0 },
      heavyCount: { type: Number, default: 0 },
      charge: { type: Number, default: 0 },
    },
    passengers: {
      adults: { type: Number, default: 1 },
      children: { type: Number, default: 0 },
      freeChildren: { type: Number, default: 0 },
      paidChildren: { type: Number, default: 0 },
      totalPassengers: { type: Number, default: 1 },
      chargedPassengers: { type: Number, default: 1 },
    },
    fare: { type: Number, default: 0 }, // total charged to the rider (incl. GST)
    fareBreakup: {
      base: { type: Number, default: 0 },
      distance: { type: Number, default: 0 },
      time: { type: Number, default: 0 },
      luggage: { type: Number, default: 0 },
      surge: { type: Number, default: 1 },
      subtotal: { type: Number, default: 0 }, // fare before surge & tax
      gross: { type: Number, default: 0 }, // subtotal x surge
      gst: { type: Number, default: 0 }, // 5% GST collected
      cgst: { type: Number, default: 0 }, // CGST 2.5% (intra-state)
      sgst: { type: Number, default: 0 }, // SGST 2.5% (intra-state)
      igst: { type: Number, default: 0 }, // IGST 5% (inter-state)
      gstRatePct: { type: Number, default: 5 },
      supplyType: { type: String, default: 'intra' }, // intra | inter
      commission: { type: Number, default: 0 }, // platform commission
      driverEarnings: { type: Number, default: 0 }, // gross - commission
      total: { type: Number, default: 0 },
      promoDiscount: { type: Number, default: 0 },
    },
    cancellationFee: { type: Number, default: 0 }, // charged if rider cancels after a driver accepts

    status: {
      type: String,
      enum: [
        'reserved',
        'requested',
        'assigned',
        'driver_arrived',
        'in_progress',
        'completed',
        'cancelled_by_rider',
        'cancelled_by_driver',
        'no_driver',
      ],
      default: 'requested',
    },

    payment: {
      status: {
        type: String,
        enum: ['pending', 'cash_pending', 'paid'],
        default: 'pending',
      },
      method: { type: String, default: '' }, // UPI | Cash | Card
      amount: { type: Number, default: 0 }, // amount the rider paid / owes
      paidAt: { type: Date, default: null },
    },

    riderRating: { type: Number, default: null }, // rider rates driver
    driverRating: { type: Number, default: null }, // driver rates rider

    riderReview: {
      driverFeedback: { type: String, default: '' },
      distanceFeedback: { type: String, default: '' },
      timeFeedback: { type: String, default: '' },
      feedbackDiscount: { type: Number, default: 0 }, // ₹10 if all 3 given
      submittedAt: { type: Date, default: null },
    },

    pendingDrivers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Shared / seat-booking trip metadata
    shared: {
      enabled: { type: Boolean, default: true },
      mode: { type: String, enum: ['shared', 'reserved', 'off'], default: 'shared' }, // seat booking mode
      reserved: { type: Boolean, default: false }, // true => whole vehicle reserved by one rider
      seatCount: { type: Number, default: 1 }, // total seats on the trip
      seatsTaken: { type: Number, default: 0 }, // seats already booked
      availableSeats: { type: Number, default: 0 }, // seatCount - seatsTaken
      perSeatFare: { type: Number, default: 0 }, // fare per seat (trip total / capacity)
    },
    // Every party who booked seats on this trip (the primary rider is occupants[0])
    occupants: [
      {
        rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        seats: { type: Number, default: 1 },
        fare: { type: Number, default: 0 }, // perSeatFare x seats - what THIS rider pays
        payment: {
          status: {
            type: String,
            enum: ['pending', 'cash_pending', 'paid'],
            default: 'pending',
          },
          method: { type: String, default: '' },
          amount: { type: Number, default: 0 },
          paidAt: { type: Date, default: null },
        },
        addedAt: { type: Date, default: Date.now },
      },
    ],

    requestedAt: { type: Date, default: Date.now },
    reservedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },

    // Live "track my ride" sharing
    shareToken: {
      type: String,
      index: true,
      default: () =>
        'stl-' +
        Math.random().toString(36).slice(2) +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 6),
    },
    shareEnabled: { type: Boolean, default: false },

    // Per-trip driver identity verification (selfie matched against enrolled face)
    driverSelfieVerifiedAt: { type: Date, default: null },

    // Promo code applied by the ride creator (affects only their fare)
    promo: {
      code: { type: String, default: '' },
      description: { type: String, default: '' },
      discount: { type: Number, default: 0 },
      appliedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

const Ride = mongoose.model('Ride', rideSchema);
export default Ride;
