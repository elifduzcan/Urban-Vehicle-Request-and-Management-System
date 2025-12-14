// src/models/Vehicle.js
const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    // Owner of this vehicle (a Driver document)
    ownerDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },

    plateNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    brand: {
      type: String,
      required: true,
      trim: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },

    vehicleType: {
      type: String,
      enum: ["CAR", "MINIBUS", "VAN", "TAXI", "OTHER"],
      default: "CAR",
    },

    seatCount: {
      type: Number,
      default: 4,
      min: 1,
    },

    color: {
      type: String,
      trim: true,
    },

    // Coordinator verification (matching Phase 1 idea)
    isVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Aracın operasyonel müsaitlik durumu
    availabilityStatus: {
      type: String,
      enum: ["AVAILABLE", "ON_TRIP"],
      default: "AVAILABLE",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Vehicle", vehicleSchema);
