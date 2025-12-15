// src/routes/driverRoutes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const {
  saveDriverProfile,
  getCurrentDriver,
  listPendingDrivers,
  approveDriver,
  updateDriverStatus,
  getDriverDashboard,
} = require("../controllers/driverController");

/**
 * @route   POST /api/drivers/profile
 * @desc    Create or update driver profile for current user
 * @access  PRIVATE (DRIVER)
 */
router.post(
  "/profile",
  authMiddleware,
  requireRole("DRIVER"),
  saveDriverProfile
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
  getCurrentDriver
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
  listPendingDrivers
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
  approveDriver
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
  updateDriverStatus
);

/**
 * GET /api/drivers/dashboard
 * DRIVER → kendi dashboard özetini görür.
 *
 * Dönen bilgiler:
 *  - driver: profil, approval, aktiflik, rating, ratingCount, totalTrips
 *  - vehicles: toplam araç sayısı, verified/active sayıları, araç listesi
 *  - trips:
 *      - ongoing: varsa şu anki ON_GOING trip (request/passenger/vehicle ile)
 *      - counts: completed, cancelled
 */
router.get(
  "/dashboard",
  authMiddleware,
  requireRole("DRIVER"),
  getDriverDashboard
);

module.exports = router;
