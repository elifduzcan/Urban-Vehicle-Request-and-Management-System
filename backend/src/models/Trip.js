// src/models/Trip.js
const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema(
  {
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Request",
      required: true,
    },
    passenger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Trip.js içinde
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",   // "User" yerine
      required: true,
    },

    // Instead of a plain string, we now reference the Vehicle document
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },

    status: {
      type: String,
      enum: ["ON_GOING", "COMPLETED", "CANCELLED"],
      default: "ON_GOING",
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },

    // Bu trip yolcu tarafından puanlandı mı?
    isRated: {
      type: Boolean,
      default: false,
    },

    // Yolcunun sürücüye verdiği puan (1–5 arası)
    passengerRating: {
      type: Number,
      min: 1,
      max: 5,
    },

    // Optional: later we can add fare, distance, etc.
    fare: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// 1) Aynı request için 1 tane trip olsun
tripSchema.index({ request: 1 }, { unique: true });

// 2) Aynı driver için aynı anda sadece 1 ON_GOING trip olsun
tripSchema.index(
  { driver: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "ON_GOING" } }
);

// 3) Aynı araç için aynı anda sadece 1 ON_GOING trip olsun
tripSchema.index(
  { vehicle: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "ON_GOING" } }
);

module.exports = mongoose.model("Trip", tripSchema);
