// src/models/Driver.js
const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema(
  {
    // Each driver is associated with exactly one user
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one-to-one relation between User and Driver
    },

    // Basic license information
    licenseNumber: {
      type: String,
      required: true,
      trim: true,
    },
    licenseClass: {
      type: String,
      required: true,
      trim: true,
    },

    // Coordinator will approve drivers
    isApproved: {
      type: Boolean,
      default: false,
    },

    // Is the driver currently active in the system?
    isActive: {
      type: Boolean,
      default: true,
    },

     // Optional statistics (can be improved later)
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    // Kaç defa puanlandığını takip ediyoruz
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalTrips: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

module.exports = mongoose.model("Driver", driverSchema);
