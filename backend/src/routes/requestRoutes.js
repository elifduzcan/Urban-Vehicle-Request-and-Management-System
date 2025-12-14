// src/routes/requestRoutes.js
const express = require("express");
const Request = require("../models/Request");
const Trip = require("../models/Trip");                 // YENİ
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

    // Aynı yolcunun birden fazla aktif request'i olmasın:
    // Aktif saydıklarımız: PENDING ve ACCEPTED
    const existingActiveRequest = await Request.findOne({
      passenger: req.user.userId,
      status: { $in: ["PENDING", "ACCEPTED"] },
    });

    if (existingActiveRequest) {
      return res.status(400).json({
        message:
          "You already have an active request. Please cancel or wait until it is completed before creating a new one.",
      });
    }

    const request = await Request.create({
      passenger: req.user.userId,
      pickupAddress,
      dropoffAddress,
      // status default: PENDING
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
 *
 * Opsiyonel query parametreleri:
 *  - status: PENDING / ACCEPTED / COMPLETED / CANCELLED
 *  - from, to: tarih aralığı (ISO string, createdAt'e göre)
 *  - page: sayfa numarası (default: 1)
 *  - limit: sayfa başına kayıt sayısı (default: 10, max: 50)
 */
router.get(
  "/my",
  authMiddleware,
  requireRole("PASSENGER"),
  async (req, res) => {
    try {
      const { status, from, to } = req.query;

      const filter = {
        passenger: req.user.userId,
      };

      if (status) {
        filter.status = status;
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

      // Pagination
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limitRaw = parseInt(req.query.limit, 10) || 10;
      const limit = Math.min(Math.max(limitRaw, 1), 50);
      const skip = (page - 1) * limit;

      const [total, requests] = await Promise.all([
        Request.countDocuments(filter),
        Request.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
      ]);

      return res.json({
        requests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
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
      const requests = await Request.find({ status: "PENDING" })
        .sort({ createdAt: -1 })      // en yeni istek en üstte
        .populate("passenger");       // yolcu bilgilerini de getir

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
 * GET /api/requests/:id
 * Tek bir request'in detayını döner.
 *
 * Erişim kuralları:
 *  - ADMIN/COORDINATOR → her request'i görebilir.
 *  - PASSENGER        → sadece kendisine ait request'i görebilir.
 *  - DRIVER           → sadece kendisinin aldığı request'leri görebilir
 *                       (yani bu request için driver'ın trip'i varsa).
 *
 * Dönüş:
 *  { request, trips: [...] }  // trips: bu request'e bağlı tüm trip kayıtları
 */
router.get(
  "/:id",
  authMiddleware,
  requireRole("PASSENGER", "DRIVER", "COORDINATOR", "ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      // 1) Request'i bul
      const request = await Request.findById(id).populate("passenger");
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      // 2) Bu request'e bağlı tüm trip'leri çek
      const trips = await Trip.find({ request: request._id })
        .populate("driver")
        .populate("vehicle")
        .lean();

      const role = req.user.role;
      const userId = req.user.userId;

      // 3) Yetki kontrolü
      let allowed = false;

      // Admin ve coordinator her şeyi görebilir
      if (role === "ADMIN" || role === "COORDINATOR") {
        allowed = true;
      } else if (role === "PASSENGER") {
        // Sadece kendine ait request'i görebilir
        if (request.passenger.toString() === userId) {
          allowed = true;
        }
      } else if (role === "DRIVER") {
        // Bu request için kendisinin trip'i var mı?
        const hasOwnTrip = trips.some((t) => {
          const driverField = t.driver && t.driver._id ? t.driver._id : t.driver;
          return driverField && driverField.toString() === userId;
        });

        if (hasOwnTrip) {
          allowed = true;
        }
      }

      if (!allowed) {
        return res
          .status(403)
          .json({ message: "You are not allowed to view this request" });
      }

      return res.json({ request, trips });
    } catch (err) {
      console.error("Get request detail error:", err);
      return res
        .status(500)
        .json({ message: "Server error while fetching request detail" });
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
 *  - page: sayfa numarası (default: 1)
 *  - limit: sayfa başına kayıt sayısı (default: 20, max: 100)
 *
 * Örnek:
 *  GET /api/requests?status=PENDING&page=1&limit=20
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

      // Pagination parametreleri
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limitRaw = parseInt(req.query.limit, 10) || 20;
      const limit = Math.min(Math.max(limitRaw, 1), 100);
      const skip = (page - 1) * limit;

      const [total, requests] = await Promise.all([
        Request.countDocuments(filter),
        Request.find(filter)
          .sort({ createdAt: -1 })
          .populate("passenger")
          .skip(skip)
          .limit(limit),
      ]);

      return res.json({
        requests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      console.error("Admin/Coordinator list requests error:", err);
      return res
        .status(500)
        .json({ message: "Server error while listing requests" });
    }
  }
);

module.exports = router;
