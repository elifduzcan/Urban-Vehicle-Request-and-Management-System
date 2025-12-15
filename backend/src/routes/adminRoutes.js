// src/routes/adminRoutes.js
const express = require("express");
const User = require("../models/user");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

// EKLE
const Driver = require("../models/Driver");
const Vehicle = require("../models/Vehicle");
const Request = require("../models/Request");
const Trip = require("../models/Trip");

const router = express.Router();

// Sistemde izin verilen roller
const ALLOWED_ROLES = ["PASSENGER", "DRIVER", "COORDINATOR", "ADMIN"];

/**
 * GET /api/admin/users
 * ADMIN → kullanıcı listesini görür.
 *
 * Opsiyonel query parametreleri:
 *  - role: PASSENGER / DRIVER / COORDINATOR / ADMIN
 *  - isActive: true / false
 *  - page: sayfa numarası (default: 1)
 *  - limit: sayfa başına kayıt sayısı (default: 20, max: 100)
 */
router.get(
  "/users",
  authMiddleware,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { role, isActive } = req.query;

      const filter = {};

      if (role && ALLOWED_ROLES.includes(role)) {
        filter.role = role;
      }

      if (typeof isActive !== "undefined") {
        if (isActive === "true") filter.isActive = true;
        if (isActive === "false") filter.isActive = false;
      }

      // Pagination parametreleri
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limitRaw = parseInt(req.query.limit, 10) || 20;
      const limit = Math.min(Math.max(limitRaw, 1), 100);
      const skip = (page - 1) * limit;

      const [total, users] = await Promise.all([
        User.countDocuments(filter),
        User.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
      ]);

      // Şifreyi asla dönmüyoruz
      const safeUsers = users.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive !== false, // undefined ise true gibi
        createdAt: u.createdAt,
      }));

      return res.json({
        users: safeUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      console.error("Admin list users error:", err);
      return res
        .status(500)
        .json({ message: "Server error while listing users" });
    }
  }
);

/**
 * PATCH /api/admin/users/:id/role
 * ADMIN → kullanıcı rolünü günceller.
 *
 * Body:
 *  { "role": "DRIVER" }
 */
router.patch(
  "/users/:id/role",
  authMiddleware,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { role } = req.body;

      if (!role || !ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({
          message: "Invalid role. Allowed roles: " + ALLOWED_ROLES.join(", "),
        });
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      user.role = role;
      await user.save();

      return res.json({
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive !== false,
        },
      });
    } catch (err) {
      console.error("Admin update user role error:", err);
      return res
        .status(500)
        .json({ message: "Server error while updating user role" });
    }
  }
);

/**
 * PATCH /api/admin/users/:id/status
 * ADMIN → kullanıcıyı aktif/pasif yapar.
 *
 * Body:
 *  { "isActive": true } veya { "isActive": false }
 */
router.patch(
  "/users/:id/status",
  authMiddleware,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { isActive } = req.body;

      if (typeof isActive === "undefined") {
        return res
          .status(400)
          .json({ message: "isActive field is required (true/false)" });
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { isActive: Boolean(isActive) },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.json({
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive !== false,
        },
      });
    } catch (err) {
      console.error("Admin update user status error:", err);
      return res
        .status(500)
        .json({ message: "Server error while updating user status" });
    }
  }
);

/**
 * GET /api/admin/stats
 * ADMIN veya COORDINATOR → sistem genel istatistikleri görür.
 *
 * Örnek response:
 * {
 *   users: {
 *     total: 10,
 *     active: 9,
 *     passive: 1,
 *     byRole: { PASSENGER: 5, DRIVER: 3, COORDINATOR: 1, ADMIN: 1 }
 *   },
 *   drivers: {
 *     total: 3,
 *     approved: 2,
 *     pending: 1
 *   },
 *   vehicles: {
 *     total: 4,
 *     verified: 3,
 *     pending: 1
 *   },
 *   requests: {
 *     byStatus: { PENDING: 2, ACCEPTED: 1, COMPLETED: 4, CANCELLED: 0 }
 *   },
 *   trips: {
 *     byStatus: { ON_GOING: 1, COMPLETED: 3, CANCELLED: 0 }
 *   }
 * }
 */
router.get(
  "/stats",
  authMiddleware,
  requireRole("ADMIN", "COORDINATOR"),
  async (req, res) => {
    try {
      // Kullanıcı istatistikleri
      const [totalUsers, activeUsers, passiveUsers, usersByRoleRaw] =
        await Promise.all([
          User.countDocuments({}),
          User.countDocuments({ isActive: true }),
          User.countDocuments({ isActive: false }),
          User.aggregate([
            {
              $group: {
                _id: "$role",
                count: { $sum: 1 },
              },
            },
          ]),
        ]);

      const usersByRole = {};
      usersByRoleRaw.forEach((item) => {
        usersByRole[item._id] = item.count;
      });

      // Driver istatistikleri
      const [totalDrivers, approvedDrivers, pendingDrivers] =
        await Promise.all([
          Driver.countDocuments({}),
          Driver.countDocuments({ isApproved: true }),
          Driver.countDocuments({ isApproved: false }),
        ]);

      // Vehicle istatistikleri
      const [totalVehicles, verifiedVehicles, pendingVehicles] =
        await Promise.all([
          Vehicle.countDocuments({}),
          Vehicle.countDocuments({ isVerified: true }),
          Vehicle.countDocuments({ isVerified: false }),
        ]);

      // Request status dağılımı
      const requestStatusRaw = await Request.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);
      const requestStatus = {};
      requestStatusRaw.forEach((item) => {
        requestStatus[item._id] = item.count;
      });

      // Trip status dağılımı
      const tripStatusRaw = await Trip.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);
      const tripStatus = {};
      tripStatusRaw.forEach((item) => {
        tripStatus[item._id] = item.count;
      });

      return res.json({
        users: {
          total: totalUsers,
          active: activeUsers,
          passive: passiveUsers,
          byRole: usersByRole,
        },
        drivers: {
          total: totalDrivers,
          approved: approvedDrivers,
          pending: pendingDrivers,
        },
        vehicles: {
          total: totalVehicles,
          verified: verifiedVehicles,
          pending: pendingVehicles,
        },
        requests: {
          byStatus: requestStatus,
        },
        trips: {
          byStatus: tripStatus,
        },
      });
    } catch (err) {
      console.error("Admin stats error:", err);
      return res
        .status(500)
        .json({ message: "Server error while fetching admin stats" });
    }
  }
);

/**
 * GET /api/admin/consistency
 * ADMIN ve COORDINATOR için veri tutarlılığı kontrolü.
 *
 * Bu endpoint, temel ilişki ve durum (status) kontrollerini yapar:
 *  - User referansı olmayan Driver kayıtları
 *  - Driver referansı olmayan Vehicle kayıtları
 *  - Passenger (User) referansı olmayan Request kayıtları
 *  - Request/Driver/Passenger/Vehicle referansı eksik Trip kayıtları
 *  - Trip ve Request status'leri arasında uyumsuzluklar
 *
 * NOT: Bu endpoint sadece raporlama amaçlıdır; herhangi bir kayıtı silmez veya düzeltmez.
 */
router.get(
  "/consistency",
  authMiddleware,
  requireRole("ADMIN", "COORDINATOR"),
  async (req, res) => {
    try {
      // 1) User referansı olmayan driver'lar
      const drivers = await Driver.find({}).lean();
      const users = await User.find({}).select("_id").lean();
      const userIds = new Set(users.map((u) => String(u._id)));

      const driversWithMissingUser = drivers.filter(
        (d) => !d.user || !userIds.has(String(d.user))
      );

      // 2) Driver referansı olmayan araçlar
      const vehicles = await Vehicle.find({}).lean();
      const driverIds = new Set(drivers.map((d) => String(d._id)));

      const vehiclesWithMissingDriver = vehicles.filter(
        (v) => !v.ownerDriver || !driverIds.has(String(v.ownerDriver))
      );

      // 3) Passenger referansı olmayan request'ler
      const requests = await Request.find({}).lean();

      const requestsWithMissingPassenger = requests.filter(
        (r) => !r.passenger || !userIds.has(String(r.passenger))
      );

      // 4) Trip'lerde eksik referanslar ve status uyumsuzlukları
      const trips = await Trip.find({}).lean();

      const tripsWithMissingRefs = [];
      const statusInconsistencies = [];

      // Request status map'i (id -> status) daha hızlı kontrol için
      const requestStatusMap = new Map(
        requests.map((r) => [String(r._id), r.status])
      );

      trips.forEach((t) => {
        const problems = [];

        if (!t.request || !requestStatusMap.has(String(t.request))) {
          problems.push("missing_request");
        }
        if (!t.driver || !driverIds.has(String(t.driver))) {
          problems.push("missing_driver");
        }

        if (!t.passenger || !userIds.has(String(t.passenger))) {
          problems.push("missing_passenger_user");
        }
        if (!t.vehicle) {
          problems.push("missing_vehicle");
        }

        if (problems.length > 0) {
          tripsWithMissingRefs.push({
            tripId: t._id,
            problems,
          });
        }

        // Status tutarlılık kontrolü (request varsa)
        if (t.request && requestStatusMap.has(String(t.request))) {
          const reqStatus = requestStatusMap.get(String(t.request));
          const tripStatus = t.status;

          // Basit uyum kuralları
          if (
            (tripStatus === "COMPLETED" && reqStatus !== "COMPLETED") ||
            (tripStatus === "ON_GOING" &&
              !["ACCEPTED", "ON_GOING"].includes(reqStatus)) ||
            (tripStatus === "CANCELLED" &&
              !["CANCELLED", "PENDING", "ACCEPTED"].includes(reqStatus))
          ) {
            statusInconsistencies.push({
              tripId: t._id,
              tripStatus,
              requestId: t.request,
              requestStatus: reqStatus,
            });
          }
        }
      });

      return res.json({
        consistencyReport: {
          driversWithMissingUser,
          vehiclesWithMissingDriver,
          requestsWithMissingPassenger,
          tripsWithMissingRefs,
          statusInconsistencies,
        },
      });
    } catch (err) {
      console.error("Admin consistency check error:", err);
      return res.status(500).json({
        message: "Server error while running consistency checks",
      });
    }
  }
);

/**
 * PATCH /api/admin/requests/:id/status
 * ADMIN / COORDINATOR → request statüsünü manuel günceller.
 *
 * Body:
 *  { "status": "PENDING" | "ACCEPTED" | "COMPLETED" | "CANCELLED" }
 *
 * Not:
 *  - Status değişikliği, ilgili trip kayıtlarına da yansıtılmaya çalışılır.
 *    (Örneğin request CANCELLED olursa, ON_GOING trip'ler CANCELLED yapılır.)
 */
router.patch(
  "/requests/:id/status",
  authMiddleware,
  requireRole("ADMIN", "COORDINATOR"),
  async (req, res) => {
    try {
      const { status } = req.body;
      const allowedStatuses = ["PENDING", "ACCEPTED", "ON_GOING", "COMPLETED", "CANCELLED"];

      if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({
          message:
            "Invalid status. Allowed values: " + allowedStatuses.join(", "),
        });
      }

      const request = await Request.findById(req.params.id);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      const previousStatus = request.status;
      request.status = status;
      await request.save();

      // İlgili trip'ler ile basit senkronizasyon
      const trips = await Trip.find({ request: request._id });

      for (const trip of trips) {
        // CANCELLED request → ON_GOING trip'leri de CANCELLED yap
        if (status === "CANCELLED" && trip.status === "ON_GOING") {
          trip.status = "CANCELLED";
          trip.completedAt = new Date();
          await trip.save();
        }

        // COMPLETED request → ON_GOING trip'leri COMPLETED yap
        if (status === "COMPLETED" && trip.status === "ON_GOING") {
          const prevTripStatus = trip.status;
          trip.status = "COMPLETED";
          trip.completedAt = new Date();
          await trip.save();

          // Driver istatistiği (daha önce COMPLETED değilse artır)
          if (prevTripStatus !== "COMPLETED") {
            try {
              const driverProfile = await Driver.findById(trip.driver);
              if (driverProfile) {
                driverProfile.totalTrips =
                  (driverProfile.totalTrips || 0) + 1;
                await driverProfile.save();
              }
            } catch (statsErr) {
              console.error(
                "Error while updating driver stats from admin request override:",
                statsErr
              );
            }
          }
        }
      }

      return res.json({
        request,
        previousStatus,
        updatedStatus: status,
      });
    } catch (err) {
      console.error("Admin override request status error:", err);
      return res.status(500).json({
        message: "Server error while overriding request status",
      });
    }
  }
);

/**
 * PATCH /api/admin/trips/:id/status
 * ADMIN / COORDINATOR → trip statüsünü manuel günceller.
 *
 * Body:
 *  { "status": "ON_GOING" | "COMPLETED" | "CANCELLED" }
 *
 * Not:
 *  - Status değişikliği Request kaydına da yansıtılmaya çalışılır.
 *  - Trip COMPLETED'e çekilirse ve daha önce COMPLETED değilse,
 *    driver.totalTrips bir artırılır.
 */
router.patch(
  "/trips/:id/status",
  authMiddleware,
  requireRole("ADMIN", "COORDINATOR"),
  async (req, res) => {
    try {
      const { status } = req.body;
      const allowedStatuses = ["ON_GOING", "COMPLETED", "CANCELLED"];

      if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({
          message:
            "Invalid status. Allowed values: " + allowedStatuses.join(", "),
        });
      }

      const trip = await Trip.findById(req.params.id);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      const previousStatus = trip.status;
      trip.status = status;

      if (status === "COMPLETED" || status === "CANCELLED") {
        trip.completedAt = new Date();
      } else if (status === "ON_GOING") {
        // Tekrar ON_GOING'e çekildiyse completedAt'i sıfırlayabiliriz
        trip.completedAt = null;
      }

      await trip.save();

      // Bağlı Request statüsünü de uyarlamaya çalış
      let updatedRequest = null;
      try {
        if (trip.request) {
          const reqDoc = await Request.findById(trip.request);
          if (reqDoc) {
            if (status === "COMPLETED") {
              reqDoc.status = "COMPLETED";
            } else if (status === "CANCELLED") {
              reqDoc.status = "CANCELLED";
            } else if (status === "ON_GOING") {
              // ON_GOING trip en az ACCEPTED bir request gerektirir
              if (reqDoc.status === "PENDING") {
                reqDoc.status = "ACCEPTED";
              }
            }
            await reqDoc.save();
            updatedRequest = reqDoc;
          }
        }
      } catch (reqErr) {
        console.error(
          "Error while syncing request status from admin trip override:",
          reqErr
        );
      }

      // Driver istatistik güncelleme (yalnızca ilk kez COMPLETED oluyorsa)
      if (previousStatus !== "COMPLETED" && status === "COMPLETED") {
        try {
          const driverProfile = await Driver.findById(trip.driver);
          if (driverProfile) {
            driverProfile.totalTrips = (driverProfile.totalTrips || 0) + 1;
            await driverProfile.save();
          }
        } catch (statsErr) {
          console.error(
            "Error while updating driver stats from admin trip override:",
            statsErr
          );
        }
      }

      return res.json({
        trip,
        request: updatedRequest,
        previousStatus,
        updatedStatus: status,
      });
    } catch (err) {
      console.error("Admin override trip status error:", err);
      return res.status(500).json({
        message: "Server error while overriding trip status",
      });
    }
  }
);

module.exports = router;
