// src/routes/authRoutes.js
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Helper: JWT oluşturma
function generateToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, adminSecret } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }

    // Email zaten var mı?
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    // Şifreyi hashle
    const hashedPassword = await bcrypt.hash(password, 10);

    // Rol kontrolü:
    // - Temel roller: PASSENGER / DRIVER → herkes kaydolabilir
    // - Yükseltilmiş roller: COORDINATOR / ADMIN → sadece adminSecret ile
    const BASIC_ROLES = ["PASSENGER", "DRIVER"];
    const ELEVATED_ROLES = ["COORDINATOR", "ADMIN"];

    let userRole = (role || "PASSENGER").toUpperCase();

    if (ELEVATED_ROLES.includes(userRole)) {
      // COORDINATOR / ADMIN için gizli anahtar zorunlu
      if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({
          message:
            "You are not allowed to register with this role. Invalid adminSecret.",
        });
      }
    } else if (!BASIC_ROLES.includes(userRole)) {
      // Geçersiz bir rol geldiyse default PASSENGER
      userRole = "PASSENGER";
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: userRole,
      // isActive modelde default: true ise ayrıca set etmeye gerek yok
    });

    const token = generateToken(user);

    return res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      token,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error during registration" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Hesap pasif ise login'e izin verme
    if (user.isActive === false) {
      return res
        .status(403)
        .json({ message: "Account is disabled. Please contact admin." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = generateToken(user);

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error during login" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json({ user });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
