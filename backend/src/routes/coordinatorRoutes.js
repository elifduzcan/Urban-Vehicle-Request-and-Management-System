// src/routes/coordinatorRoutes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const Driver = require("../models/Driver");
const Vehicle = require("../models/Vehicle");
const Request = require("../models/Request");
const Trip = require("../models/Trip");

/**
 * GET /api/coordinator/overview
 * COORDINATOR (veya ADMIN) için genel işleyiş özeti.
 *
 * Dönüş yapısı:
 * {
 *   pendingDrivers: [ ...approve bekleyen sürücüler... ],
 *   pendingVehicles: [ ...verify bekleyen araçlar... ],
 *   pendingRequests: [ ...PENDING istekler... ],
 *   ongoingTrips: [ ...ON_GOING tripler... ]
 * }
 *
 * Bu endpoint, koordinator dashboard ekranını beslemek için kullanılabilir.
 */
router.get(
  "/overview",
  authMiddleware,
  requireRole("COORDINATOR", "ADMIN"),
  async (req, res) => {
    try {
      // 1) Approve bekleyen sürücüler
      const pendingDrivers = await Driver.find({ isApproved: false })
        .populate("user") // isim, email vs. için
        .sort({ createdAt: 1 });

      // 2) Verify bekleyen araçlar
      const pendingVehicles = await Vehicle.find({ isVerified: false })
        .populate({
          path: "ownerDriver",
          populate: { path: "user" },
        })
        .sort({ createdAt: 1 });

      // 3) PENDING request'ler
      const pendingRequests = await Request.find({ status: "PENDING" })
        .populate("passenger")
        .sort({ createdAt: 1 });

      // 4) ON_GOING trip'ler
      const ongoingTrips = await Trip.find({ status: "ON_GOING" })
        .populate("driver")
        .populate("passenger")
        .populate("vehicle")
        .populate("request")
        .sort({ createdAt: 1 });

      return res.json({
        pendingDrivers,
        pendingVehicles,
        pendingRequests,
        ongoingTrips,
      });
    } catch (err) {
      console.error("Coordinator overview error:", err);
      return res
        .status(500)
        .json({ message: "Server error while fetching coordinator overview" });
    }
  }
);

module.exports = router;
