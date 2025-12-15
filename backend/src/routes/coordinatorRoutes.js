const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");

const Driver = require("../models/Driver");
const Vehicle = require("../models/Vehicle");
const Request = require("../models/Request");
const Trip = require("../models/Trip");

/**
 * GET /api/coordinator/overview
 * COORDINATOR/ADMIN: Özet operasyon verisi
 */
router.get(
  "/overview",
  authMiddleware,
  requireRole("COORDINATOR", "ADMIN"),
  async (req, res) => {
    try {
      const pendingDrivers = await Driver.find({ isApproved: false })
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .lean();

      const pendingVehicles = await Vehicle.find({ isVerified: false })
        .populate({ path: "ownerDriver", populate: { path: "user", select: "name email" } })
        .sort({ createdAt: -1 })
        .lean();

      const pendingRequests = await Request.find({ status: "PENDING" })
        .populate("passenger", "name email")
        .sort({ createdAt: -1 })
        .lean();

      const ongoingTrips = await Trip.find({ status: "ON_GOING" })
        .populate({ path: "driver", populate: { path: "user", select: "name email" } })
        .populate("passenger", "name email")
        .populate("vehicle")
        .sort({ createdAt: -1 })
        .lean();

      return res.json({
        pendingDrivers,
        pendingVehicles,
        pendingRequests,
        ongoingTrips,
      });
    } catch (err) {
      console.error("Coordinator overview error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * GET /api/coordinator/resources
 * COORDINATOR/ADMIN: Atama yapılabilecek driver + vehicle listesi
 */
router.get(
  "/resources",
  authMiddleware,
  requireRole("COORDINATOR", "ADMIN"),
  async (req, res) => {
    try {
      const ongoingTrips = await Trip.find({ status: "ON_GOING" })
        .select("driver vehicle")
        .lean();

      const busyDriverIds = new Set(ongoingTrips.map((t) => String(t.driver)));
      const busyVehicleIds = new Set(ongoingTrips.map((t) => String(t.vehicle)));

      const drivers = await Driver.find({
        isApproved: true,
        isActive: true,
        _id: { $nin: Array.from(busyDriverIds) },
      })
        .populate("user", "name email")
        .sort({ createdAt: 1 });

      const driverIds = drivers.map((d) => d._id);

      const vehicles = await Vehicle.find({
        ownerDriver: { $in: driverIds },
        isVerified: true,
        isActive: true,
        availabilityStatus: "AVAILABLE",
        _id: { $nin: Array.from(busyVehicleIds) },
      })
        .sort({ createdAt: 1 })
        .lean();

      const vehiclesByDriver = {};
      for (const v of vehicles) {
        const key = String(v.ownerDriver);
        if (!vehiclesByDriver[key]) vehiclesByDriver[key] = [];
        vehiclesByDriver[key].push(v);
      }

      return res.json({ drivers, vehiclesByDriver });
    } catch (err) {
      console.error("Coordinator resources error:", err);
      return res
        .status(500)
        .json({ message: "Server error while fetching resources" });
    }
  }
);

/**
 * POST /api/coordinator/assign
 * COORDINATOR/ADMIN: Request'e driver+vehicle atayıp trip oluşturur.
 */
router.post(
  "/assign",
  authMiddleware,
  requireRole("COORDINATOR", "ADMIN"),
  async (req, res) => {
    let session;

    try {
      const { requestId, driverId, vehicleId } = req.body;

      if (!requestId || !driverId || !vehicleId) {
        return res.status(400).json({
          message: "requestId, driverId and vehicleId are required",
        });
      }

      session = await Driver.startSession();
      session.startTransaction();

      const driver = await Driver.findById(driverId).session(session);
      if (!driver) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Driver not found" });
      }
      if (!driver.isApproved || !driver.isActive) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Driver is not approved or not active" });
      }

      const vehicle = await Vehicle.findById(vehicleId).session(session);
      if (!vehicle) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Vehicle not found" });
      }
      if (String(vehicle.ownerDriver) !== String(driver._id)) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Vehicle does not belong to selected driver" });
      }
      if (!vehicle.isVerified || !vehicle.isActive) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Vehicle is not verified or not active" });
      }
      if (vehicle.availabilityStatus !== "AVAILABLE") {
        await session.abortTransaction();
        return res.status(400).json({ message: "Vehicle is not available" });
      }

      const request = await Request.findOneAndUpdate(
        { _id: requestId, status: "PENDING" },
        { $set: { status: "ACCEPTED" } },
        { new: true, session }
      );

      if (!request) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Request not found or not in PENDING status" });
      }

      await Vehicle.updateOne(
        { _id: vehicle._id },
        { $set: { availabilityStatus: "ON_TRIP" } },
        { session }
      );

      const [trip] = await Trip.create(
        [
          {
            request: request._id,
            passenger: request.passenger,
            driver: driver._id,
            vehicle: vehicle._id,
            status: "ON_GOING",
          },
        ],
        { session }
      );

      await session.commitTransaction();

      const populatedTrip = await Trip.findById(trip._id)
        .populate("request")
        .populate({ path: "driver", populate: { path: "user", select: "name email" } })
        .populate("passenger", "name email")
        .populate("vehicle");

      return res.status(201).json({ trip: populatedTrip });
    } catch (err) {
      try {
        if (session) await session.abortTransaction();
      } catch (_) {}

      console.error("Coordinator assign error:", err);
      return res.status(500).json({ message: "Server error while assigning" });
    } finally {
      if (session) session.endSession();
    }
  }
);

module.exports = router;
