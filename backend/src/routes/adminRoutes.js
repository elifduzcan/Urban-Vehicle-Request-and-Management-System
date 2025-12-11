// src/routes/adminRoutes.js
const express = require("express");
const User = require("../models/user"); // sende dosya adı büyük U ise bu doğru
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

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

module.exports = router;
