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
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

module.exports = mongoose.model("Trip", tripSchema);
