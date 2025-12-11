// src/middleware/roleMiddleware.js

// authMiddleware kullanıcıyı doğruladıktan sonra req.user.role içini dolduruyor.
// Bu middleware, sadece belirli rollere izin vermek için kullanılacak.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // authMiddleware çalışmamışsa veya JWT'den rol gelmemişse
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Yanlış kullanımı yakalamak için: hiç rol verilmemişse
    if (!allowedRoles || allowedRoles.length === 0) {
      return res
        .status(500)
        .json({ message: "No roles defined in role middleware" });
    }

    // Kullanıcının rolü izin verilen roller listesinde mi?
    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Forbidden: insufficient role" });
    }

    next();
  };
}

module.exports = requireRole;
