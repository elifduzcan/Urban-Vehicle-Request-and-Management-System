// src/server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");

// ---- ENV VALIDATION ----
function validateEnv() {
  const requiredVars = ["MONGODB_URI", "JWT_SECRET"];
  const missing = requiredVars.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((v) => console.error(`   - ${v}`));
    console.error(
      "Please define them in your .env file before starting the backend."
    );
    process.exit(1);
  }
}

// Önce env’leri kontrol et, sonra DB’ye bağlan
validateEnv();
connectDB();

const app = express();

const driverRoutes = require("./routes/driverRoutes");
const vehicleRoutes = require("./routes/vehicleRoutes");
const adminRoutes = require("./routes/adminRoutes");

app.use(cors());
app.use(express.json());

const authRoutes = require("./routes/authRoutes");
const requestRoutes = require("./routes/requestRoutes");
const tripRoutes = require("./routes/tripRoutes");
const passengerRoutes = require("./routes/passengerRoutes");
const coordinatorRoutes = require("./routes/coordinatorRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/passenger", passengerRoutes);
app.use("/api/coordinator", coordinatorRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Backend is running" });
});

// ---- 404 JSON handler ----
app.use((req, res, next) => {
  res.status(404).json({
    message: "Endpoint not found",
    path: req.originalUrl,
    method: req.method,
  });
});

// ---- Global error handler ----
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    message: "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
