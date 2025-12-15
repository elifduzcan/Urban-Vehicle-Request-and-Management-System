// src/middleware/requireRole.js
module.exports = function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // authMiddleware req.user set etmiş olmalı
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const role = req.user.role;

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        message: `Forbidden: role ${role} cannot access this resource`,
      });
    }

    next();
  };
};
