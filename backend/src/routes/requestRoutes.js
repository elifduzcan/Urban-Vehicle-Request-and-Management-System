// src/routes/requestRoutes.js
const express = require("express");
const Request = require("../models/Request");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const router = express.Router();

// POST /api/requests
// Yolcu yeni talep oluşturur
router.post("/", authMiddleware, requireRole("PASSENGER"), async (req, res) => {
  try {
    const { pickupAddress, dropoffAddress } = req.body;

    if (!pickupAddress || !dropoffAddress) {
      return res.status(400).json({ message: "pickupAddress and dropoffAddress are required" });
    }

    const request = await Request.create({
      passenger: req.user.userId,
      pickupAddress,
      dropoffAddress,
    });

    res.status(201).json({ request });
  } catch (err) {
    console.error("Create request error:", err);
    res.status(500).json({ message: "Server error while creating request" });
  }
});

// GET /api/requests/my
// Yolcu kendi taleplerini görür
router.get("/my", authMiddleware, requireRole("PASSENGER"), async (req, res) => {
  try {
    const requests = await Request.find({ passenger: req.user.userId }).sort({ createdAt: -1 });
    res.json({ requests });
  } catch (err) {
    console.error("Get my requests error:", err);
    res.status(500).json({ message: "Server error while fetching requests" });
  }
});

// GET /api/requests/available
// Şoförlerin göreceği, henüz kimsenin almadığı PENDING istekler
router.get(
  "/available",
  authMiddleware,
  requireRole("DRIVER"),
  async (req, res) => {
    try {
      const requests = await Request.find({ status: "PENDING" }).sort({ createdAt: 1 });
      res.json({ requests });
    } catch (err) {
      console.error("Get available requests error:", err);
      res.status(500).json({ message: "Server error while fetching available requests" });
    }
  }
);

module.exports = router;