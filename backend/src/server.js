const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");

const app = express();
const driverRoutes = require("./routes/driverRoutes");
const vehicleRoutes = require("./routes/vehicleRoutes");
const adminRoutes = require("./routes/adminRoutes");

// DB'ye bağlan
connectDB();

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
