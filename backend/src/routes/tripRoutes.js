// src/routes/tripRoutes.js
const express = require("express");
const Trip = require("../models/Trip");
const Request = require("../models/Request");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const router = express.Router();

// POST /api/trips
// Şoför bir PENDING request'i kabul eder ve trip başlar
router.post("/", authMiddleware, requireRole("DRIVER"), async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ message: "requestId is required" });
    }

    // Aynı sürücünün ON_GOING trip'i var mı?
    const existingTrip = await Trip.findOne({
      driver: req.user.userId,
      status: "ON_GOING",
    });

    if (existingTrip) {
      return res
        .status(400)
        .json({ message: "Driver already has an ongoing trip" });
    }

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({ message: "Request is not available" });
    }

    // Request'i ACCEPTED yap
    request.status = "ACCEPTED";
    await request.save();

    // Trip oluştur
    const trip = await Trip.create({
      request: request._id,
      passenger: request.passenger,
      driver: req.user.userId,
    });

    res.status(201).json({ trip });
  } catch (err) {
    console.error("Create trip error:", err);
    res.status(500).json({ message: "Server error while creating trip" });
  }
});

// PATCH /api/trips/:id/complete
// Şoför trip'i tamamlar
router.patch(
  "/:id/complete",
  authMiddleware,
  requireRole("DRIVER"),
  async (req, res) => {
    try {
      const trip = await Trip.findById(req.params.id).populate("request");
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      if (trip.driver.toString() !== req.user.userId) {
        return res.status(403).json({ message: "You are not the driver of this trip" });
      }

      if (trip.status !== "ON_GOING") {
        return res.status(400).json({ message: "Trip is not ongoing" });
      }

      trip.status = "COMPLETED";
      trip.completedAt = new Date();
      await trip.save();

      // İlgili request'i de COMPLETED yap
      if (trip.request) {
        trip.request.status = "COMPLETED";
        await trip.request.save();
      }

      res.json({ trip });
    } catch (err) {
      console.error("Complete trip error:", err);
      res.status(500).json({ message: "Server error while completing trip" });
    }
  }
);

// GET /api/trips/my
// Şoför kendi trip'lerini görür
router.get(
  "/my",
  authMiddleware,
  requireRole("DRIVER"),
  async (req, res) => {
    try {
      const trips = await Trip.find({ driver: req.user.userId })
        .populate("request")
        .sort({ createdAt: -1 });

      res.json({ trips });
    } catch (err) {
      console.error("Get my trips error:", err);
      res.status(500).json({ message: "Server error while fetching trips" });
    }
  }
);

module.exports = router;