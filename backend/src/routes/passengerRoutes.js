// src/routes/passengerRoutes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { getDashboard } = require("../controllers/passengerController");

router.get(
  "/dashboard",
  authMiddleware,
  requireRole("PASSENGER"),
  getDashboard
);

module.exports = router;
