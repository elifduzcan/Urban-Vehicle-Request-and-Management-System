/// src/routes/adminRoutes.js
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

      const users = await User.find(filter).sort({ createdAt: -1 });

      // Şifreyi asla dönmüyoruz
      const safeUsers = users.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive !== false, // undefined ise true gibi
        createdAt: u.createdAt,
      }));

      return res.json({ users: safeUsers });
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

module.exports = router;
