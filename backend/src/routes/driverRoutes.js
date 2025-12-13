// src/routes/driverRoutes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const Driver = require("../models/Driver");
const User = require("../models/user");

// Helper: get or create driver profile for the logged-in user
async function findOrCreateDriverForUser(userId, licenseNumber, licenseClass) {
  let driver = await Driver.findOne({ user: userId });

  if (!driver) {
    driver = await Driver.create({
      user: userId,
      licenseNumber,
      licenseClass,
    });
  } else {
    driver.licenseNumber = licenseNumber;
    driver.licenseClass = licenseClass;
    await driver.save();
  }

  return driver;
}

/**
 * @route   POST /api/drivers/profile
 * @desc    Create or update driver profile for current user
 * @access  PRIVATE (DRIVER)
 */
router.post(
  "/profile",
  authMiddleware,
  requireRole("DRIVER"),
  async (req, res) => {
    try {
      const { licenseNumber, licenseClass } = req.body;

      if (!licenseNumber || !licenseClass) {
        return res
          .status(400)
          .json({ message: "licenseNumber and licenseClass are required" });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const driver = await findOrCreateDriverForUser(
        req.user.userId,
        licenseNumber,
        licenseClass
      );

      const populated = await driver.populate("user", "name email role");

      return res.status(200).json({
        message: "Driver profile saved successfully",
        driver: populated,
      });
    } catch (err) {
      console.error("Error in POST /api/drivers/profile:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * @route   GET /api/drivers/me
 * @desc    Get current user's driver profile
 * @access  PRIVATE (DRIVER)
 */
router.get(
  "/me",
  authMiddleware,
  requireRole("DRIVER"),
  async (req, res) => {
    try {
      const driver = await Driver.findOne({ user: req.user.userId }).populate(
        "user",
        "name email role"
      );

      if (!driver) {
        return res
          .status(404)
          .json({ message: "Driver profile does not exist" });
      }

      return res.status(200).json(driver);
    } catch (err) {
      console.error("Error in GET /api/drivers/me:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * @route   GET /api/drivers/pending
 * @desc    List drivers waiting for approval
 * @access  PRIVATE (COORDINATOR or ADMIN)
 */
router.get(
  "/pending",
  authMiddleware,
  requireRole("COORDINATOR", "ADMIN"),
  async (req, res) => {
    try {
      const drivers = await Driver.find({ isApproved: false }).populate(
        "user",
        "name email role"
      );

      return res.status(200).json(drivers);
    } catch (err) {
      console.error("Error in GET /api/drivers/pending:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * @route   PATCH /api/drivers/:id/approve
 * @desc    Approve a driver
 * @access  PRIVATE (COORDINATOR or ADMIN)
 */
router.patch(
  "/:id/approve",
  authMiddleware,
  requireRole("COORDINATOR", "ADMIN"),
  async (req, res) => {
    try {
      const driverId = req.params.id;

      const driver = await Driver.findById(driverId).populate(
        "user",
        "name email role"
      );

      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      if (driver.isApproved) {
        return res.status(400).json({ message: "Driver is already approved" });
      }

      driver.isApproved = true;
      await driver.save();

      return res.status(200).json({
        message: "Driver approved successfully",
        driver,
      });
    } catch (err) {
      console.error("Error in PATCH /api/drivers/:id/approve:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * PATCH /api/drivers/:id/status
 * COORDINATOR veya ADMIN → sürücünün isActive durumunu günceller.
 *
 * Body:
 *  { "isActive": true }  veya  { "isActive": false }
 */
router.patch(
  "/:id/status",
  authMiddleware,
  requireRole("COORDINATOR", "ADMIN"),
  async (req, res) => {
    try {
      const { isActive } = req.body;

      // Body kontrolü
      if (typeof isActive === "undefined") {
        return res
          .status(400)
          .json({ message: "isActive field is required (true/false)" });
      }

      const driver = await Driver.findByIdAndUpdate(
        req.params.id,
        { isActive: Boolean(isActive) },
        { new: true }
      ).populate("user");

      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      return res.json({
        message: "Driver status updated successfully",
        driver,
      });
    } catch (err) {
      console.error("Error in PATCH /api/drivers/:id/status:", err);
      return res.status(500).json({
        message: "Server error while updating driver status",
      });
    }
  }
);

module.exports = router;
