// src/routes/requestRoutes.js
const express = require("express");
const Request = require("../models/Request");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const router = express.Router();

/**
 * POST /api/requests
 * PASSENGER yeni bir talep (request) oluşturur.
 */
router.post("/", authMiddleware, requireRole("PASSENGER"), async (req, res) => {
  try {
    const { pickupAddress, dropoffAddress } = req.body;

    if (!pickupAddress || !dropoffAddress) {
      return res.status(400).json({
        message: "pickupAddress and dropoffAddress are required",
      });
    }

    const request = await Request.create({
      passenger: req.user.userId,
      pickupAddress,
      dropoffAddress,
      // status default şemadan PENDING gelecek
    });

    return res.status(201).json({ request });
  } catch (err) {
    console.error("Create request error:", err);
    return res
      .status(500)
      .json({ message: "Server error while creating request" });
  }
});

/**
 * GET /api/requests/my
 * PASSENGER kendi taleplerini görür.
 */
router.get(
  "/my",
  authMiddleware,
  requireRole("PASSENGER"),
  async (req, res) => {
    try {
      const requests = await Request.find({ passenger: req.user.userId }).sort(
        {
          createdAt: -1,
        }
      );

      return res.json({ requests });
    } catch (err) {
      console.error("Get my requests error:", err);
      return res
        .status(500)
        .json({ message: "Server error while fetching requests" });
    }
  }
);

/**
 * GET /api/requests/available
 * DRIVER'ların göreceği, henüz kimsenin almadığı PENDING istekler.
 */
router.get(
  "/available",
  authMiddleware,
  requireRole("DRIVER"),
  async (req, res) => {
    try {
      const requests = await Request.find({ status: "PENDING" }).sort({
        createdAt: 1,
      });

      return res.json({ requests });
    } catch (err) {
      console.error("Get available requests error:", err);
      return res.status(500).json({
        message: "Server error while fetching available requests",
      });
    }
  }
);

/**
 * PATCH /api/requests/:id/cancel
 * PASSENGER kendi PENDING talebini iptal eder.
 *
 * Kurallar:
 * - Request gerçekten var olmalı.
 * - Request ilgili yolcuya (passenger) ait olmalı.
 * - Sadece PENDING durumundaki istekler iptal edilebilir.
 */
router.patch(
  "/:id/cancel",
  authMiddleware,
  requireRole("PASSENGER"),
  async (req, res) => {
    try {
      const requestId = req.params.id;

      const request = await Request.findById(requestId);

      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      // Bu request bu kullanıcıya mı ait?
      if (request.passenger.toString() !== req.user.userId) {
        return res
          .status(403)
          .json({ message: "You are not allowed to cancel this request" });
      }

      // Sadece PENDING durumunda iptal
      if (request.status !== "PENDING") {
        return res.status(400).json({
          message: "Only PENDING requests can be cancelled",
        });
      }

      request.status = "CANCELLED";
      await request.save();

      return res.json({ request });
    } catch (err) {
      console.error("Cancel request error:", err);
      return res
        .status(500)
        .json({ message: "Server error while cancelling request" });
    }
  }
);

/**
 * GET /api/requests
 * COORDINATOR ve ADMIN için tüm istekleri listeleyen endpoint.
 *
 * Opsiyonel query parametreleri:
 *  - status: PENDING / ACCEPTED / COMPLETED / CANCELLED
 *  - passengerId: belirli bir yolcunun istekleri
 *  - from, to: tarih aralığı (ISO string, createdAt'e göre)
 *
 * Örnek:
 *  GET /api/requests?status=PENDING
 *  GET /api/requests?passengerId=6565...&from=2025-12-01&to=2025-12-10
 */
router.get(
  "/",
  authMiddleware,
  requireRole("COORDINATOR", "ADMIN"),
  async (req, res) => {
    try {
      const { status, passengerId, from, to } = req.query;

      const filter = {};

      if (status) {
        filter.status = status;
      }

      if (passengerId) {
        filter.passenger = passengerId;
      }

      if (from || to) {
        filter.createdAt = {};
        if (from) {
          filter.createdAt.$gte = new Date(from);
        }
        if (to) {
          filter.createdAt.$lte = new Date(to);
        }
      }

      const requests = await Request.find(filter)
        .sort({ createdAt: -1 })
        .populate("passenger");

      return res.json({ requests });
    } catch (err) {
      console.error("Admin/Coordinator list requests error:", err);
      return res
        .status(500)
        .json({ message: "Server error while listing requests" });
    }
  }
);

module.exports = router;
