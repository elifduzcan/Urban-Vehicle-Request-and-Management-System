// src/routes/vehicleRoutes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const Driver = require("../models/Driver");
const Vehicle = require("../models/Vehicle");

/**
 * Helper: find the Driver profile for current user and ensure it is approved
 */
async function getApprovedDriverForUser(userId) {
  const driver = await Driver.findOne({ user: userId });

  if (!driver) {
    throw new Error("Driver profile does not exist for this user");
  }

  if (!driver.isApproved) {
    throw new Error("Driver is not approved yet");
  }

  return driver;
}

/**
 * @route   POST /api/vehicles
 * @desc    Add a new vehicle for current driver
 * @access  PRIVATE (DRIVER)
 */
router.post(
  "/",
  authMiddleware,
  requireRole("DRIVER"),
  async (req, res) => {
    try {
      const {
        plateNumber,
        brand,
        model,
        vehicleType,
        seatCount,
        color,
      } = req.body;

      if (!plateNumber || !brand || !model) {
        return res.status(400).json({
          message: "plateNumber, brand and model are required",
        });
      }

      let driver;
      try {
        driver = await getApprovedDriverForUser(req.user.userId);
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }

      const existingPlate = await Vehicle.findOne({
        plateNumber: plateNumber.toUpperCase(),
      });
      if (existingPlate) {
        return res
          .status(400)
          .json({ message: "A vehicle with this plate already exists" });
      }

      const vehicle = await Vehicle.create({
        ownerDriver: driver._id,
        plateNumber,
        brand,
        model,
        vehicleType,
        seatCount,
        color,
      });

      const populated = await vehicle.populate("ownerDriver");

      return res.status(201).json({
        message: "Vehicle created successfully",
        vehicle: populated,
      });
    } catch (err) {
      console.error("Error in POST /api/vehicles:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * @route   GET /api/vehicles/my
 * @desc    List vehicles of current driver
 * @access  PRIVATE (DRIVER)
 */
router.get(
  "/my",
  authMiddleware,
  requireRole("DRIVER"),
  async (req, res) => {
    try {
      const driver = await Driver.findOne({ user: req.user.userId });

      if (!driver) {
        return res
          .status(404)
          .json({ message: "Driver profile does not exist" });
      }

      const vehicles = await Vehicle.find({
        ownerDriver: driver._id,
      });

      return res.status(200).json(vehicles);
    } catch (err) {
      console.error("Error in GET /api/vehicles/my:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * @route   GET /api/vehicles/pending
 * @desc    List vehicles waiting for verification
 * @access  PRIVATE (COORDINATOR or ADMIN)
 */
router.get(
  "/pending",
  authMiddleware,
  requireRole("COORDINATOR", "ADMIN"),
  async (req, res) => {
    try {
      const vehicles = await Vehicle.find({
        isVerified: false,
      }).populate({
        path: "ownerDriver",
        populate: { path: "user", select: "name email role" },
      });

      return res.status(200).json(vehicles);
    } catch (err) {
      console.error("Error in GET /api/vehicles/pending:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * @route   PATCH /api/vehicles/:id/verify
 * @desc    Verify a vehicle
 * @access  PRIVATE (COORDINATOR or ADMIN)
 */
router.patch(
  "/:id/verify",
  authMiddleware,
  requireRole("COORDINATOR", "ADMIN"),
  async (req, res) => {
    try {
      const vehicleId = req.params.id;

      const vehicle = await Vehicle.findById(vehicleId).populate({
        path: "ownerDriver",
        populate: { path: "user", select: "name email role" },
      });

      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }

      if (vehicle.isVerified) {
        return res
          .status(400)
          .json({ message: "Vehicle is already verified" });
      }

      vehicle.isVerified = true;
      await vehicle.save();

      return res.status(200).json({
        message: "Vehicle verified successfully",
        vehicle,
      });
    } catch (err) {
      console.error("Error in PATCH /api/vehicles/:id/verify:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
