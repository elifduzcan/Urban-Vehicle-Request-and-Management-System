// src/routes/passengerRoutes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const User = require("../models/user");
const Request = require("../models/Request");
const Trip = require("../models/Trip");

/**
 * GET /api/passenger/dashboard
 * PASSENGER → kendi panel özetini görür.
 *
 * Dönen yapı:
 * {
 *   passenger: { id, name, email },
 *   requests: {
 *     active: { ... } | null,
 *     counts: {
 *       total,
 *       pending,
 *       accepted,
 *       completed,
 *       cancelled
 *     },
 *     latest: [ ... son 5 request ... ]
 *   },
 *   trips: {
 *     current: { ... } | null,   // ON_GOING trip
 *     counts: {
 *       total,
 *       ongoing,
 *       completed,
 *       cancelled
 *     },
 *     latest: [ ... son 5 trip ... ]
 *   }
 * }
 */
router.get(
  "/dashboard",
  authMiddleware,
  requireRole("PASSENGER"),
  async (req, res) => {
    try {
      // 1) Kullanıcı bilgisi
      const user = await User.findById(req.user.userId).select(
        "_id name email"
      );

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // 2) Yolcunun tüm istekleri
      const requests = await Request.find({ passenger: req.user.userId })
        .sort({ createdAt: -1 })
        .lean();

      const requestCounts = {
        total: requests.length,
        pending: requests.filter((r) => r.status === "PENDING").length,
        accepted: requests.filter((r) => r.status === "ACCEPTED").length,
        ongoing: requests.filter((r) => r.status === "ON_GOING").length,
        completed: requests.filter((r) => r.status === "COMPLETED").length,
        cancelled: requests.filter((r) => r.status === "CANCELLED").length,
      };

      // Aktif request: PENDING veya ACCEPTED olan ilk kayıt
      const activeRequest = requests.find((r) =>
        ["PENDING", "ACCEPTED", "ON_GOING"].includes(r.status)
      ) || null;

      // 3) Yolcunun tüm trip'leri
      const trips = await Trip.find({ passenger: req.user.userId })
        .populate({ path: "driver", populate: { path: "user" } })
        .populate("vehicle")
        .populate("request")
        .sort({ createdAt: -1 }); 

      const tripCounts = {
        total: trips.length,
        ongoing: trips.filter((t) => t.status === "ON_GOING").length,
        completed: trips.filter((t) => t.status === "COMPLETED").length,
        cancelled: trips.filter((t) => t.status === "CANCELLED").length,
      };

      // Aktif trip: ON_GOING olan ilk kayıt
      const currentTrip =
        trips.find((t) => t.status === "ON_GOING") || null;

      return res.json({
        passenger: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
        requests: {
          active: activeRequest,
          counts: requestCounts,
          latest: requests.slice(0, 5), // son 5 talep
        },
        trips: {
          current: currentTrip,
          counts: tripCounts,
          latest: trips.slice(0, 5), // son 5 trip
        },
      });
    } catch (err) {
      console.error("Passenger dashboard error:", err);
      return res
        .status(500)
        .json({ message: "Server error while fetching passenger dashboard" });
    }
  }
);

module.exports = router;
