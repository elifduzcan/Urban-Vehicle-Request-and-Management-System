// src/routes/tripRoutes.js
const express = require("express");
const Trip = require("../models/Trip");
const Request = require("../models/Request");
const Driver = require("../models/Driver");
const Vehicle = require("../models/Vehicle");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const router = express.Router();

/**
 * Helper: Verilen userId için onaylı ve aktif bir Driver profili
 * ve buna bağlı, doğrulanmış (isVerified) + aktif (isActive) en az
 * bir araç olup olmadığını kontrol eder.
 *
 * Dönen değer:
 *  { driver, vehicle }
 *
 * Trip oluştururken hem sürücünün uygunluğunu hem de
 * hangi araçla yola çıkacağını garanti altına almak için kullanıyoruz.
 */
async function getApprovedDriverAndVerifiedVehicle(userId) {
  const driver = await Driver.findOne({ user: userId });

  if (!driver) {
    throw new Error("Driver profile does not exist for this user");
  }

  if (!driver.isApproved) {
    throw new Error("Driver is not approved yet");
  }

  if (driver.isActive === false) {
    throw new Error("Driver is not active");
  }

  const vehicle = await Vehicle.findOne({
    ownerDriver: driver._id,
    isVerified: true,
    isActive: true,
  });

  if (!vehicle) {
    throw new Error(
      "No verified and active vehicle found for this driver. Please contact coordinator."
    );
  }

  return { driver, vehicle };
}

/**
 * POST /api/trips
 * DRIVER bir PENDING request'i kabul eder ve trip başlatır.
 *
 * İş kuralları:
 * - Aynı driver'ın ON_GOING trip'i varsa yeni trip başlatamaz.
 * - Driver için onaylı (isApproved) ve aktif (isActive) bir Driver kaydı olmalı.
 * - Bu driver'a ait en az bir doğrulanmış (isVerified) + aktif (isActive) araç olmalı.
 * - Request PENDING değilse kabul edilemez.
 */
router.post("/", authMiddleware, requireRole("DRIVER"), async (req, res) => {
  try {
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({ message: "requestId is required" });
    }

    // 1) Aynı sürücünün ON_GOING trip'i var mı?
    const existingTrip = await Trip.findOne({
      driver: req.user.userId,
      status: "ON_GOING",
    });

    if (existingTrip) {
      return res
        .status(400)
        .json({ message: "Driver already has an ongoing trip" });
    }

    // 2) Driver onaylı mı ve doğrulanmış/aktif aracı var mı?
    let driverInfo;
    try {
      driverInfo = await getApprovedDriverAndVerifiedVehicle(req.user.userId);
    } catch (err) {
      // İş kuralı hatası → 400
      return res.status(400).json({ message: err.message });
    }

    const { vehicle } = driverInfo;

    // 3) Request'i bul
    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    // Sadece PENDING istekler kabul edilebilir
    if (request.status !== "PENDING") {
      return res
        .status(400)
        .json({ message: "Request is not available (not PENDING)" });
    }

    // 4) Request'i ACCEPTED yap
    request.status = "ACCEPTED";
    await request.save();

    // 5) Trip oluştur (Trip modelinde vehicle required olduğu için EKLENİYOR)
    const trip = await Trip.create({
      request: request._id,
      passenger: request.passenger,
      driver: req.user.userId,
      vehicle: vehicle._id,
    });

    return res.status(201).json({ trip });
  } catch (err) {
    console.error("Create trip error:", err);
    return res
      .status(500)
      .json({ message: "Server error while creating trip" });
  }
});

/**
 * PATCH /api/trips/:id/complete
 * DRIVER kendi trip'ini tamamlar.
 *
 * Kurallar:
 * - Trip gerçekten bu driver'a ait olmalı.
 * - Trip status'ü ON_GOING olmalı.
 * - Trip COMPLETED yapılır, bağlı Request de COMPLETED yapılır.
 */
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
        return res
          .status(403)
          .json({ message: "You are not the driver of this trip" });
      }

      if (trip.status !== "ON_GOING") {
        return res.status(400).json({ message: "Trip is not ongoing" });
      }

      trip.status = "COMPLETED";
      trip.completedAt = new Date();
      await trip.save();

      if (trip.request) {
        trip.request.status = "COMPLETED";
        await trip.request.save();
      }

      return res.json({ trip });
    } catch (err) {
      console.error("Complete trip error:", err);
      return res
        .status(500)
        .json({ message: "Server error while completing trip" });
    }
  }
);

/**
 * PATCH /api/trips/:id/cancel
 * DRIVER kendi trip'ini iptal eder.
 *
 * Kurallar:
 * - Trip bu driver'a ait olmalı.
 * - COMPLETED ya da zaten CANCELLED olan trip tekrar iptal edilemez.
 * - Trip status'ü CANCELLED yapılır.
 * - Bağlı Request varsa o da CANCELLED yapılır.
 */
router.patch(
  "/:id/cancel",
  authMiddleware,
  requireRole("DRIVER"),
  async (req, res) => {
    try {
      const trip = await Trip.findById(req.params.id).populate("request");
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      if (trip.driver.toString() !== req.user.userId) {
        return res
          .status(403)
          .json({ message: "You are not the driver of this trip" });
      }

      if (trip.status === "COMPLETED") {
        return res
          .status(400)
          .json({ message: "Completed trips cannot be cancelled" });
      }

      if (trip.status === "CANCELLED") {
        return res
          .status(400)
          .json({ message: "Trip is already cancelled" });
      }

      trip.status = "CANCELLED";
      trip.completedAt = new Date(); // log amaçlı
      await trip.save();

      if (trip.request) {
        trip.request.status = "CANCELLED";
        await trip.request.save();
      }

      return res.json({ trip });
    } catch (err) {
      console.error("Cancel trip error:", err);
      return res
        .status(500)
        .json({ message: "Server error while cancelling trip" });
    }
  }
);

/**
 * GET /api/trips
 * COORDINATOR ve ADMIN için global trip listesi.
 *
 * Opsiyonel query parametreleri:
 *  - status: ON_GOING / COMPLETED / CANCELLED
 *  - driverId: belirli bir driver (User id)
 *  - passengerId: belirli bir passenger
 *  - from, to: tarih aralığı (createdAt'e göre, ISO date string)
 *
 * Örnek:
 *  GET /api/trips?status=ON_GOING
 *  GET /api/trips?driverId=6565...&from=2025-12-01&to=2025-12-31
 */
router.get(
  "/",
  authMiddleware,
  requireRole("COORDINATOR", "ADMIN"),
  async (req, res) => {
    try {
      const { status, driverId, passengerId, from, to } = req.query;

      const filter = {};

      if (status) {
        filter.status = status;
      }

      if (driverId) {
        filter.driver = driverId;
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

      const trips = await Trip.find(filter)
        .populate("request")
        .populate("driver")
        .populate("passenger")
        .populate("vehicle")
        .sort({ createdAt: -1 });

      return res.json({ trips });
    } catch (err) {
      console.error("Admin/Coordinator list trips error:", err);
      return res
        .status(500)
        .json({ message: "Server error while listing trips" });
    }
  }
);

/**
 * GET /api/trips/my
 * DRIVER kendi trip'lerini listeler.
 */
router.get(
  "/my",
  authMiddleware,
  requireRole("DRIVER"),
  async (req, res) => {
    try {
      const trips = await Trip.find({ driver: req.user.userId })
        .populate("request")
        .populate("vehicle")
        .sort({ createdAt: -1 });

      return res.json({ trips });
    } catch (err) {
      console.error("Get my trips error:", err);
      return res
        .status(500)
        .json({ message: "Server error while fetching trips" });
    }
  }
);

/**
 * GET /api/trips/my-passenger
 * PASSENGER kendi adına açılmış trip'leri listeler.
 */
router.get(
  "/my-passenger",
  authMiddleware,
  requireRole("PASSENGER"),
  async (req, res) => {
    try {
      const trips = await Trip.find({ passenger: req.user.userId })
        .populate("request")
        .populate("driver")
        .populate("vehicle")
        .sort({ createdAt: -1 });

      return res.json({ trips });
    } catch (err) {
      console.error("Get my passenger trips error:", err);
      return res.status(500).json({
        message: "Server error while fetching passenger trips",
      });
    }
  }
);

module.exports = router;
