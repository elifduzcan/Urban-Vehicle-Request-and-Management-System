// src/routes/tripRoutes.js
const mongoose = require("mongoose");

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

  // availabilityStatus yoksa (eski kayıt) AVAILABLE gibi kabul ediyoruz
  const vehicle = await Vehicle.findOne({
    ownerDriver: driver._id,
    isVerified: true,
    isActive: true,
    $or: [
      { availabilityStatus: "AVAILABLE" },
      { availabilityStatus: { $exists: false } },
    ],
  });

  if (!vehicle) {
    throw new Error(
      "No verified, active and AVAILABLE vehicle found for this driver. Please contact coordinator."
    );
  }

  return { driver, vehicle };
}

/**
 * POST /api/trips
 * DRIVER bir request'i kabul edip Trip oluşturur.
 *
 * Kurallar:
 * - Driver onaylı olmalı (Driver.isApproved)
 * - Driver'ın doğrulanmış ve aktif aracı olmalı (Vehicle.isVerified && Vehicle.isActive)
 * - Driver'ın aynı anda ON_GOING trip'i olmamalı
 * - Request status'ü PENDING olmalı
 * - Request ACCEPTED'a çekilir, Trip oluşturulur
 */
router.post(
  "/",
  authMiddleware,
  requireRole("DRIVER"),
  async (req, res) => {
    let session;

    try {
      const { requestId } = req.body;

      if (!requestId) {
        return res.status(400).json({ message: "requestId is required" });
      }

      // 1) Driver + Vehicle uygunluğu
      let driverInfo;
      try {
        driverInfo = await getApprovedDriverAndVerifiedVehicle(req.user.userId);
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }

      const { driver, vehicle } = driverInfo;

      // 2) Transaction başlat (Atlas/replica set üzerinde çalışır)
      session = await mongoose.startSession();
      session.startTransaction();

      // 3) Aynı driver için ON_GOING var mı? (Ek kontrol)
      //    Asıl garanti zaten Trip modelindeki partial unique index.
      const existingTrip = await Trip.findOne(
        { driver: driver._id, status: "ON_GOING" },
        null,
        { session }
      );

      if (existingTrip) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Driver already has an ongoing trip" });
      }

      // 4) Request’i atomik şekilde PENDING -> ACCEPTED çevir
      //    Burada findById + if yerine tek DB operasyonu kullanıyoruz.
      const request = await Request.findOneAndUpdate(
        { _id: requestId, status: "PENDING" },
        { $set: { status: "ACCEPTED" } },
        { new: true, session }
      );

      // Araç artık müsait değil
      await Vehicle.updateOne(
        { _id: vehicle._id },
        { $set: { availabilityStatus: "ON_TRIP" } },
        { session }
      );

      if (!request) {
        await session.abortTransaction();
        return res.status(400).json({
          message: "Request is not available (not found or not in PENDING status)",
        });
      }

      // 5) Trip oluştur (unique index’ler burada DB seviyesinde koruma sağlar)
      const trip = await Trip.create(
        [
          {
            request: request._id,
            passenger: request.passenger,
            driver: driver._id,
            vehicle: vehicle._id,
            status: "ON_GOING",
          },
        ],
        { session }
      );

      // 6) Transaction commit
      await session.commitTransaction();

      // 7) Response (populate)
      const populatedTrip = await Trip.findById(trip[0]._id)
        .populate("request")
        .populate({ path: "driver", populate: { path: "user" } })
        .populate("passenger")
        .populate("vehicle");

      return res.status(201).json({ trip: populatedTrip });
    } catch (err) {
      // Transaction açıksa rollback
      try {
        if (session) await session.abortTransaction();
      } catch (_) {}

      // MongoDB standalone ise transaction çalışmaz (replica set / Atlas gerekir)
      if (err && typeof err.message === "string") {
        const msg = err.message.toLowerCase();
        if (msg.includes("transaction numbers are only allowed") || msg.includes("replica set")) {
          return res.status(500).json({
            message:
              "MongoDB transactions require a replica set (or Atlas). Please run MongoDB as a replica set or use Atlas cluster.",
            hint:
              "If you are using local MongoDB, start it with --replSet and initiate rs.initiate().",
          });
        }
      }
      
      // Duplicate key (unique index) yakala → yarış koşulunda “temiz” hata dön
      if (err && err.code === 11000) {
        // Hangi unique patladı?
        const key = err.keyPattern || {};
        if (key.request) {
          return res.status(409).json({
            message: "This request has already been accepted by another driver.",
          });
        }
        if (key.driver) {
          return res.status(409).json({
            message: "Driver already has an ongoing trip (DB constraint).",
          });
        }
        if (key.vehicle) {
          return res.status(409).json({
            message: "Vehicle already has an ongoing trip (DB constraint).",
          });
        }

        return res.status(409).json({ message: "Duplicate constraint violation." });
      }

      console.error("Create trip error:", err);
      return res.status(500).json({ message: "Server error while creating trip" });
    } finally {
      if (session) session.endSession();
    }
  }
);

/**
 * PATCH /api/trips/:id/complete
 * DRIVER kendi trip'ini tamamlar.
 *
 * Kurallar:
 * - Trip gerçekten bu driver'a ait olmalı. (Trip.driver => Driver._id)
 * - Trip status'ü ON_GOING olmalı.
 * - Trip COMPLETED yapılır, bağlı Request de COMPLETED yapılır.
 */
router.patch(
  "/:id/complete",
  authMiddleware,
  requireRole("DRIVER"),
  async (req, res) => {
    let session = null;

    try {
      session = await mongoose.startSession();
      session.startTransaction();

      const trip = await Trip.findById(req.params.id, null, { session }).populate("request");
      if (!trip) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Trip not found" });
      }

      const driverProfile = await Driver.findOne({ user: req.user.userId }, null, { session });
      if (!driverProfile) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Driver profile not found" });
      }

      if (String(trip.driver) !== String(driverProfile._id)) {
        await session.abortTransaction();
        return res.status(403).json({ message: "You are not the driver of this trip" });
      }

      if (trip.status !== "ON_GOING") {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Only ON_GOING trips can be completed (current: ${trip.status})`,
        });
      }

      // 1) Trip'i tamamla
      trip.status = "COMPLETED";
      trip.completedAt = new Date();
      await trip.save({ session });

      // 2) Request'i tamamla
      if (trip.request) {
        trip.request.status = "COMPLETED";
        await trip.request.save({ session });
      }

      // 3) Aracı tekrar AVAILABLE yap
      await Vehicle.updateOne(
        { _id: trip.vehicle },
        { $set: { availabilityStatus: "AVAILABLE" } },
        { session }
      );

      // 4) Driver istatistiği
      driverProfile.totalTrips = (driverProfile.totalTrips || 0) + 1;
      await driverProfile.save({ session });

      await session.commitTransaction();

      return res.json({ trip });
    } catch (err) {
      try {
        if (session) await session.abortTransaction();
      } catch (_) {}

      console.error("Complete trip error:", err);
      return res.status(500).json({ message: "Server error while completing trip" });
    } finally {
      if (session) session.endSession();
    }
  }
);

/**
 * PATCH /api/trips/:id/cancel
 * DRIVER kendi trip'ini iptal eder.
 *
 * Kurallar:
 * - Trip gerçekten bu driver'a ait olmalı. (Trip.driver => Driver._id)
 * - COMPLETED trip iptal edilemez.
 * - Zaten CANCELLED ise idempotent davranıp aynısını döner.
 * - Trip status'ü CANCELLED yapılır.
 * - Bağlı Request varsa (ve COMPLETED değilse) o da CANCELLED yapılır.
 */
router.patch(
  "/:id/cancel",
  authMiddleware,
  requireRole("DRIVER"),
  async (req, res) => {
    let session = null;

    try {
      session = await mongoose.startSession();
      session.startTransaction();

      const trip = await Trip.findById(req.params.id, null, { session }).populate("request");
      if (!trip) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Trip not found" });
      }

      const driverProfile = await Driver.findOne({ user: req.user.userId }, null, { session });
      if (!driverProfile) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Driver profile not found" });
      }

      if (String(trip.driver) !== String(driverProfile._id)) {
        await session.abortTransaction();
        return res.status(403).json({ message: "You are not the driver of this trip" });
      }

      if (trip.status === "COMPLETED") {
        await session.abortTransaction();
        return res.status(400).json({ message: "COMPLETED trip cannot be cancelled" });
      }

      if (trip.status === "CANCELLED") {
        await session.commitTransaction();
        return res.json({ trip }); // idempotent
      }

      // 1) Trip iptal
      trip.status = "CANCELLED";
      await trip.save({ session });

      // 2) Request iptal (COMPLETED değilse)
      if (trip.request && trip.request.status !== "COMPLETED") {
        trip.request.status = "CANCELLED";
        await trip.request.save({ session });
      }

      // 3) Aracı tekrar AVAILABLE yap
      await Vehicle.updateOne(
        { _id: trip.vehicle },
        { $set: { availabilityStatus: "AVAILABLE" } },
        { session }
      );

      await session.commitTransaction();

      return res.json({ trip });
    } catch (err) {
      try {
        if (session) await session.abortTransaction();
      } catch (_) {}

      console.error("Cancel trip error:", err);
      return res.status(500).json({ message: "Server error while cancelling trip" });
    } finally {
      if (session) session.endSession();
    }
  }
);

/**
 * GET /api/trips
 * ADMIN / COORDINATOR: tüm tripleri listeler (filter + pagination)
 *
 * Query:
 * - status        : ON_GOING | COMPLETED | CANCELLED
 * - driverId      : User._id veya Driver._id (uyumlu)
 * - passengerId   : User._id
 * - requestId     : Request._id
 * - from, to      : createdAt için tarih aralığı (ISO string önerilir)
 * - page, limit   : pagination
 */
router.get(
  "/",
  authMiddleware,
  requireRole("ADMIN", "COORDINATOR"),
  async (req, res) => {
    try {
      const {
        status,
        driverId,
        passengerId,
        requestId,
        from,
        to,
        page = 1,
        limit = 20,
      } = req.query;

      const filter = {};

      if (status) filter.status = status;
      if (passengerId) filter.passenger = passengerId;
      if (requestId) filter.request = requestId;

      // driverId uyumluluğu:
      // - driverId User._id olarak gelirse => Driver._id'ye map
      // - driverId Driver._id ise => direkt kullan
      if (driverId) {
        const d = await Driver.findOne({ user: driverId }).select("_id");
        if (d) {
          filter.driver = d._id;
        } else {
          // Driver profili bulunamadıysa, param zaten Driver._id olabilir
          filter.driver = driverId;
        }
      }

      // createdAt tarih aralığı
      if (from || to) {
        filter.createdAt = {};
        if (from) {
          const fromDate = new Date(from);
          if (!isNaN(fromDate.getTime())) filter.createdAt.$gte = fromDate;
        }
        if (to) {
          const toDate = new Date(to);
          if (!isNaN(toDate.getTime())) filter.createdAt.$lte = toDate;
        }
        // Geçersiz date gelirse createdAt filtresi boş kalabilir; sorun değil.
        if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
      }

      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const skip = (pageNum - 1) * limitNum;

      const [total, trips] = await Promise.all([
        Trip.countDocuments(filter),
        Trip.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .populate("request")
          .populate("passenger")
          .populate("vehicle")
          .populate({ path: "driver", populate: { path: "user" } }),
      ]);

      return res.json({
        total,
        page: pageNum,
        limit: limitNum,
        trips,
      });
    } catch (err) {
      console.error("List trips error:", err);
      return res
        .status(500)
        .json({ message: "Server error while listing trips" });
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

      const driverProfile = await Driver.findOne({ user: req.user.userId });
      if (!driverProfile) return res.status(400).json({ message: "Driver profile not found" });

      const filter = { driver: driverProfile._id };

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
          .populate({ path: "driver", populate: { path: "user" } })
          .populate("vehicle")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit) 
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

      const trip = await Trip.findById(req.params.id)
        .populate("request")
        .populate({ path: "driver", populate: { path: "user" } })
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
        const tripDriverUserId = trip.driver?.user?._id
          ? String(trip.driver.user._id)
          : String(trip.driver?.user);

        if (tripDriverUserId === userId) allowed = true;
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
      const driverProfile = await Driver.findById(trip.driver);
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
