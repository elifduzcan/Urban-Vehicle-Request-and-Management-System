// src/routes/coordinatorRoutes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { getOverview } = require("../controllers/coordinatorController");

router.get(
  "/overview",
  authMiddleware,
  requireRole("COORDINATOR", "ADMIN"),
  getOverview
);

module.exports = router;
