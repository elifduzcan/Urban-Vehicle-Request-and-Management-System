// src/middleware/roleMiddleware.js

// authMiddleware kullanıcıyı doğruladıktan sonra req.user.role içini dolduruyor.
// Bu middleware, sadece belirli rollere izin vermek için kullanılacak.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    next();
  };
}

module.exports = requireRole;
