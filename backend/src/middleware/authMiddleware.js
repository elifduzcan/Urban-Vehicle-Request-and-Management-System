// src/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/user");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  // "Authorization: Bearer <token>" beklenir
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // 1) Token doğrula
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded: { userId, role, email, iat, exp }

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    // 2) Kullanıcı DB’de var mı, aktif mi, rolü güncel mi?
    const user = await User.findById(decoded.userId).select("_id email role isActive");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Admin account blocking -> token olsa bile erişim yok
    if (user.isActive === false) {
      return res.status(403).json({ message: "Account is inactive" });
    }

    // 3) req.user’ı DB’den gelen güncel bilgilerle set et
    req.user = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    };

    return next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = authMiddleware;
