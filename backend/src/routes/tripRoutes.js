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
 * - Aynı request için birden fazla trip oluşturulamaz.
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

    // 3.5) Aynı request için daha önce trip oluşturulmuş mu?
    const existingTripForRequest = await Trip.findOne({
      request: request._id,
    });

    if (existingTripForRequest) {
      return res.status(400).json({
        message:
          "This request is already assigned to another driver (trip already exists).",
      });
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

      // 1) Trip'i tamamla
      trip.status = "COMPLETED";
      trip.completedAt = new Date();
      await trip.save();

      // 2) Bağlı request'i tamamla
      if (trip.request) {
        trip.request.status = "COMPLETED";
        await trip.request.save();
      }

      // 3) Driver istatistiğini güncelle (totalTrips + 1)
      try {
        const driverProfile = await Driver.findOne({ user: req.user.userId });
        if (driverProfile) {
          driverProfile.totalTrips = (driverProfile.totalTrips || 0) + 1;
          await driverProfile.save();
        }
      } catch (statsErr) {
        console.error(
          "Error while updating driver statistics on trip complete:",
          statsErr
        );
        // İstatistik güncellenemese bile trip tamamlanmış sayılıyor,
        // o yüzden burada ekstra hata döndürmüyoruz.
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

      // Trip gerçekten bu user'a mı ait? (Trip.driver User ref'i)
      if (trip.driver.toString() !== req.user.userId) {
        return res
          .status(403)
          .json({ message: "You are not the driver of this trip" });
      }

      // COMPLETED trip iptal edilemez
      if (trip.status === "COMPLETED") {
        return res
          .status(400)
          .json({ message: "Completed trips cannot be cancelled" });
      }

      // Zaten CANCELLED ise tekrar iptal etme
      if (trip.status === "CANCELLED") {
        return res
          .status(400)
          .json({ message: "Trip is already cancelled" });
      }

      trip.status = "CANCELLED";
      trip.completedAt = new Date();
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
 *  - page: sayfa numarası (default: 1)
 *  - limit: sayfa başına kayıt sayısı (default: 20, max: 100)
 *
 * Örnek:
 *  GET /api/trips?status=ON_GOING&page=1&limit=20
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

      // Pagination parametreleri
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limitRaw = parseInt(req.query.limit, 10) || 20;
      const limit = Math.min(Math.max(limitRaw, 1), 100);
      const skip = (page - 1) * limit;

      const [total, trips] = await Promise.all([
        Trip.countDocuments(filter),
        Trip.find(filter)
          .populate("request")
          .populate("driver")
          .populate("passenger")
          .populate("vehicle")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
      ]);

      return res.json({
        trips,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      console.error("Admin/Coordinator list trips error:", err);
      return res
        .status(500)
        .json({ message: "Server error while listing trips" });
    }
  }
);

/**
 * GET /api/trips/:id
 * Tek bir trip'in detayını döner.
 *
 * Erişim kuralları:
 *  - ADMIN/COORDINATOR → tüm trip'leri görebilir.
 *  - DRIVER           → sadece kendi trip'lerini görebilir.
 *  - PASSENGER        → sadece kendi adına oluşturulmuş trip'leri görebilir.
 */
router.get(
  "/:id",
  authMiddleware,
  requireRole("PASSENGER", "DRIVER", "COORDINATOR", "ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const trip = await Trip.findById(id)
        .populate("request")
        .populate("driver")
        .populate("passenger")
        .populate("vehicle");

      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      const role = req.user.role;
      const userId = req.user.userId;

      let allowed = false;

      // Admin / Coordinator → full access
      if (role === "ADMIN" || role === "COORDINATOR") {
        allowed = true;
      } else if (role === "DRIVER") {
        const driverField =
          trip.driver && trip.driver._id ? trip.driver._id : trip.driver;
        if (driverField && driverField.toString() === userId) {
          allowed = true;
        }
      } else if (role === "PASSENGER") {
        const passengerField =
          trip.passenger && trip.passenger._id
            ? trip.passenger._id
            : trip.passenger;
        if (passengerField && passengerField.toString() === userId) {
          allowed = true;
        }
      }

      if (!allowed) {
        return res
          .status(403)
          .json({ message: "You are not allowed to view this trip" });
      }

      return res.json({ trip });
    } catch (err) {
      console.error("Get trip detail error:", err);
      return res
        .status(500)
        .json({ message: "Server error while fetching trip detail" });
    }
  }
);

/**
 * GET /api/trips/my
 * DRIVER kendi trip'lerini listeler.
 *
 * Opsiyonel query parametreleri:
 *  - status: ON_GOING / COMPLETED / CANCELLED
 *  - from, to: tarih aralığı (createdAt)
 *  - page: sayfa numarası (default: 1)
 *  - limit: sayfa başına kayıt sayısı (default: 10, max: 50)
 */
router.get(
  "/my",
  authMiddleware,
  requireRole("DRIVER"),
  async (req, res) => {
    try {
      const { status, from, to } = req.query;

      const filter = {
        driver: req.user.userId,
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

      const [total, trips] = await Promise.all([
        Trip.countDocuments(filter),
        Trip.find(filter)
          .populate("request")
          .populate("vehicle")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
      ]);

      return res.json({
        trips,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
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
 *
 * Opsiyonel query parametreleri:
 *  - status: ON_GOING / COMPLETED / CANCELLED
 *  - from, to: tarih aralığı (createdAt)
 *  - page: sayfa numarası (default: 1)
 *  - limit: sayfa başına kayıt sayısı (default: 10, max: 50)
 */
router.get(
  "/my-passenger",
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

      const [total, trips] = await Promise.all([
        Trip.countDocuments(filter),
        Trip.find(filter)
          .populate("request")
          .populate("driver")
          .populate("vehicle")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
      ]);

      return res.json({
        trips,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      console.error("Get my passenger trips error:", err);
      return res.status(500).json({
        message: "Server error while fetching passenger trips",
      });
    }
  }
);

/**
 * POST /api/trips/:id/rate
 * PASSENGER → tamamlanmış bir trip için sürücüyü puanlar.
 *
 * Kurallar:
 * - Trip mevcut olmalı.
 * - Trip bu yolcuya ait olmalı (passenger == current user).
 * - Trip status'ü COMPLETED olmalı.
 * - Aynı trip sadece 1 kez puanlanabilir.
 * - Puan 1 ile 5 arasında olmalı.
 */
router.post(
  "/:id/rate",
  authMiddleware,
  requireRole("PASSENGER"),
  async (req, res) => {
    try {
      const { rating } = req.body;

      // 1) rating valid mi?
      if (typeof rating !== "number" || Number.isNaN(rating)) {
        return res
          .status(400)
          .json({ message: "rating must be a number between 1 and 5" });
      }

      if (rating < 1 || rating > 5) {
        return res
          .status(400)
          .json({ message: "rating must be between 1 and 5" });
      }

      // 2) Trip'i bul
      const trip = await Trip.findById(req.params.id);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      // 3) Bu trip gerçekten bu yolcuya mı ait?
      if (trip.passenger.toString() !== req.user.userId) {
        return res
          .status(403)
          .json({ message: "You are not the passenger of this trip" });
      }

      // 4) Sadece COMPLETED trip'ler puanlanabilir
      if (trip.status !== "COMPLETED") {
        return res.status(400).json({
          message: "Only completed trips can be rated",
        });
      }

      // 5) Aynı trip ikinci kez puanlanamaz
      if (trip.isRated) {
        return res
          .status(400)
          .json({ message: "This trip has already been rated" });
      }

      // 6) Driver profilini bul
      const driverProfile = await Driver.findOne({ user: trip.driver });
      if (!driverProfile) {
        return res
          .status(404)
          .json({ message: "Driver profile not found" });
      }

      // 7) Ortalama rating'i güncelle (basit running average)
      const currentAvg = driverProfile.rating || 0;
      const currentCount = driverProfile.ratingCount || 0;
      const newCount = currentCount + 1;

      const newAvg =
        currentCount === 0
          ? rating
          : (currentAvg * currentCount + rating) / newCount;

      driverProfile.rating = newAvg;
      driverProfile.ratingCount = newCount;
      await driverProfile.save();

      // 8) Trip'i işaretle
      trip.isRated = true;
      trip.passengerRating = rating;
      await trip.save();

      return res.json({
        message: "Rating submitted successfully",
        driver: {
          id: driverProfile._id,
          rating: driverProfile.rating,
          ratingCount: driverProfile.ratingCount,
          totalTrips: driverProfile.totalTrips,
        },
        trip,
      });
    } catch (err) {
      console.error("Rate trip error:", err);
      return res
        .status(500)
        .json({ message: "Server error while rating trip" });
    }
  }
);

module.exports = router;