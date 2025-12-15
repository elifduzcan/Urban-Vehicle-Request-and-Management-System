const mongoose = require("mongoose");
const Trip = require("../models/Trip");
const Request = require("../models/Request");
const Driver = require("../models/Driver");
const Vehicle = require("../models/Vehicle");

async function getApprovedDriverAndVerifiedVehicle(userId) {
  const driver = await Driver.findOne({ user: userId });

  if (!driver) {
    throw new Error("Driver profile does not exist for this user");
  }
  if (!driver.isApproved) {
    throw new Error("Driver is not approved yet");
  }
  if (driver.isActive === false) {
    throw new Error("Driver is not active");
  }

  const vehicle = await Vehicle.findOne({
    ownerDriver: driver._id,
    isVerified: true,
    isActive: true,
    $or: [
      { availabilityStatus: "AVAILABLE" },
      { availabilityStatus: { $exists: false } },
    ],
  });

  if (!vehicle) {
    throw new Error(
      "No verified, active and AVAILABLE vehicle found for this driver. Please contact coordinator."
    );
  }

  return { driver, vehicle };
}

async function createTrip(req, res) {
  let session;

  try {
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({ message: "requestId is required" });
    }

    let driverInfo;
    try {
      driverInfo = await getApprovedDriverAndVerifiedVehicle(req.user.userId);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    const { driver, vehicle } = driverInfo;

    session = await mongoose.startSession();
    session.startTransaction();

    const existingTrip = await Trip.findOne(
      { driver: driver._id, status: "ON_GOING" },
      null,
      { session }
    );

    if (existingTrip) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Driver already has an ongoing trip" });
    }

    const request = await Request.findOneAndUpdate(
      { _id: requestId, status: "PENDING" },
      { $set: { status: "ACCEPTED" } },
      { new: true, session }
    );

    await Vehicle.updateOne(
      { _id: vehicle._id },
      { $set: { availabilityStatus: "ON_TRIP" } },
      { session }
    );

    if (!request) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Request is not available (not found or not in PENDING status)",
      });
    }

    const trip = await Trip.create(
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

    const populatedTrip = await Trip.findById(trip[0]._id)
      .populate("request")
      .populate({ path: "driver", populate: { path: "user" } })
      .populate("passenger")
      .populate("vehicle");

    return res.status(201).json({ trip: populatedTrip });
  } catch (err) {
    try {
      if (session) await session.abortTransaction();
    } catch (_) {}

    if (err && typeof err.message === "string") {
      const msg = err.message.toLowerCase();
      if (
        msg.includes("transaction numbers are only allowed") ||
        msg.includes("replica set")
      ) {
        return res.status(500).json({
          message:
            "MongoDB transactions require a replica set (or Atlas). Please run MongoDB as a replica set or use Atlas cluster.",
          hint:
            "If you are using local MongoDB, start it with --replSet and initiate rs.initiate().",
        });
      }
    }

    if (err && err.code === 11000) {
      const key = err.keyPattern || {};
      if (key.request) {
        return res.status(409).json({
          message: "This request has already been accepted by another driver.",
        });
      }
      if (key.driver) {
        return res.status(409).json({
          message: "Driver already has an ongoing trip (DB constraint).",
        });
      }
      if (key.vehicle) {
        return res.status(409).json({
          message: "Vehicle already has an ongoing trip (DB constraint).",
        });
      }

      return res.status(409).json({ message: "Duplicate constraint violation." });
    }

    console.error("Create trip error:", err);
    return res.status(500).json({ message: "Server error while creating trip" });
  } finally {
    if (session) session.endSession();
  }
}

async function startTrip(req, res) {
  try {
    const trip = await Trip.findById(req.params.id).populate("request");

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const driver = await Driver.findOne({ user: req.user.userId });
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    if (trip.driver.toString() !== driver._id.toString()) {
      return res.status(403).json({ message: "You are not allowed to start this trip" });
    }

    if (!trip.request) return res.status(400).json({ message: "Trip has no request" });

    if (trip.request.status !== "ACCEPTED") {
      return res.status(400).json({
        message: "Trip can only be started when request is ACCEPTED",
        currentRequestStatus: trip.request.status,
      });
    }

    trip.request.status = "ON_GOING";
    await trip.request.save();

    if (!trip.startedAt) trip.startedAt = new Date();
    await trip.save();

    return res.json({ message: "Trip started", trip });
  } catch (err) {
    console.error("Start trip error:", err);
    return res.status(500).json({ message: "Server error while starting trip" });
  }
}

async function completeTrip(req, res) {
  let session = null;

  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const trip = await Trip.findById(req.params.id, null, { session }).populate("request");
    if (!trip) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Trip not found" });
    }

    const driverProfile = await Driver.findOne({ user: req.user.userId }, null, {
      session,
    });
    if (!driverProfile) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Driver profile not found" });
    }

    if (String(trip.driver) !== String(driverProfile._id)) {
      await session.abortTransaction();
      return res.status(403).json({ message: "You are not the driver of this trip" });
    }

    if (trip.status !== "ON_GOING") {
      await session.abortTransaction();
      return res.status(400).json({
        message: `Only ON_GOING trips can be completed (current: ${trip.status})`,
      });
    }

    trip.status = "COMPLETED";
    trip.completedAt = new Date();
    await trip.save({ session });

    if (trip.request) {
      trip.request.status = "COMPLETED";
      await trip.request.save({ session });
    }

    await Vehicle.updateOne(
      { _id: trip.vehicle },
      { $set: { availabilityStatus: "AVAILABLE" } },
      { session }
    );

    driverProfile.totalTrips = (driverProfile.totalTrips || 0) + 1;
    await driverProfile.save({ session });

    await session.commitTransaction();

    return res.json({ trip });
  } catch (err) {
    try {
      if (session) await session.abortTransaction();
    } catch (_) {}

    console.error("Complete trip error:", err);
    return res.status(500).json({ message: "Server error while completing trip" });
  } finally {
    if (session) session.endSession();
  }
}

async function cancelTrip(req, res) {
  let session = null;

  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const trip = await Trip.findById(req.params.id, null, { session }).populate("request");
    if (!trip) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Trip not found" });
    }

    const driverProfile = await Driver.findOne({ user: req.user.userId }, null, {
      session,
    });
    if (!driverProfile) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Driver profile not found" });
    }

    if (String(trip.driver) !== String(driverProfile._id)) {
      await session.abortTransaction();
      return res.status(403).json({ message: "You are not the driver of this trip" });
    }

    if (trip.status === "COMPLETED") {
      await session.abortTransaction();
      return res.status(400).json({ message: "COMPLETED trip cannot be cancelled" });
    }

    if (trip.status === "CANCELLED") {
      await session.commitTransaction();
      return res.json({ trip });
    }

    trip.status = "CANCELLED";
    trip.completedAt = new Date();
    await trip.save({ session });

    if (trip.request && trip.request.status !== "COMPLETED") {
      trip.request.status = "CANCELLED";
      await trip.request.save({ session });
    }

    await Vehicle.updateOne(
      { _id: trip.vehicle },
      { $set: { availabilityStatus: "AVAILABLE" } },
      { session }
    );

    await session.commitTransaction();

    return res.json({ trip });
  } catch (err) {
    try {
      if (session) await session.abortTransaction();
    } catch (_) {}

    console.error("Cancel trip error:", err);
    return res.status(500).json({ message: "Server error while cancelling trip" });
  } finally {
    if (session) session.endSession();
  }
}

async function listTrips(req, res) {
  try {
    const {
      status,
      driverId,
      passengerId,
      requestId,
      from,
      to,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (passengerId) filter.passenger = passengerId;
    if (requestId) filter.request = requestId;

    if (driverId) {
      const d = await Driver.findOne({ user: driverId }).select("_id");
      if (d) {
        filter.driver = d._id;
      } else {
        filter.driver = driverId;
      }
    }

    if (from || to) {
      filter.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) filter.createdAt.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) filter.createdAt.$lte = toDate;
      }
      if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const [total, trips] = await Promise.all([
      Trip.countDocuments(filter),
      Trip.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("request")
        .populate("passenger")
        .populate("vehicle")
        .populate({ path: "driver", populate: { path: "user" } }),
    ]);

    return res.json({
      total,
      page: pageNum,
      limit: limitNum,
      trips,
    });
  } catch (err) {
    console.error("List trips error:", err);
    return res
      .status(500)
      .json({ message: "Server error while listing trips" });
  }
}

async function getMyTrips(req, res) {
  try {
    const { status, from, to } = req.query;

    const driverProfile = await Driver.findOne({ user: req.user.userId });
    if (!driverProfile) return res.status(400).json({ message: "Driver profile not found" });

    const filter = { driver: driverProfile._id };

    if (status) {
      filter.status = status;
    }

    if (from || to) {
      filter.createdAt = {};
      if (from) {
        filter.createdAt.$gte = new Date(from);
      }
      if (to) {
        filter.createdAt.$lte = new Date(to);
      }
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitRaw = parseInt(req.query.limit, 10) || 10;
    const limit = Math.min(Math.max(limitRaw, 1), 50);
    const skip = (page - 1) * limit;

    const [total, trips] = await Promise.all([
      Trip.countDocuments(filter),
      Trip.find(filter)
        .populate("request")
        .populate("vehicle")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return res.json({
      trips,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get my trips error:", err);
    return res
      .status(500)
      .json({ message: "Server error while fetching trips" });
  }
}

async function getPassengerTrips(req, res) {
  try {
    const { status, from, to } = req.query;

    const filter = {
      passenger: req.user.userId,
    };

    if (status) {
      filter.status = status;
    }

    if (from || to) {
      filter.createdAt = {};
      if (from) {
        filter.createdAt.$gte = new Date(from);
      }
      if (to) {
        filter.createdAt.$lte = new Date(to);
      }
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitRaw = parseInt(req.query.limit, 10) || 10;
    const limit = Math.min(Math.max(limitRaw, 1), 50);
    const skip = (page - 1) * limit;

    const [total, trips] = await Promise.all([
      Trip.countDocuments(filter),
      Trip.find(filter)
        .populate("request")
        .populate({ path: "driver", populate: { path: "user" } })
        .populate("vehicle")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return res.json({
      trips,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get my passenger trips error:", err);
    return res
      .status(500)
      .json({ message: "Server error while fetching passenger trips" });
  }
}

async function getTripById(req, res) {
  try {
    const { id } = req.params;

    const trip = await Trip.findById(req.params.id)
      .populate("request")
      .populate({ path: "driver", populate: { path: "user" } })
      .populate("passenger")
      .populate("vehicle");

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const role = req.user.role;
    const userId = req.user.userId;

    let allowed = false;

    if (role === "ADMIN" || role === "COORDINATOR") {
      allowed = true;
    } else if (role === "DRIVER") {
      const tripDriverUserId = trip.driver?.user?._id
        ? String(trip.driver.user._id)
        : String(trip.driver?.user);

      if (tripDriverUserId === userId) allowed = true;
    } else if (role === "PASSENGER") {
      const passengerField =
        trip.passenger && trip.passenger._id
          ? trip.passenger._id
          : trip.passenger;
      if (passengerField && passengerField.toString() === userId) {
        allowed = true;
      }
    }

    if (!allowed) {
      return res
        .status(403)
        .json({ message: "You are not allowed to view this trip" });
    }

    return res.json({ trip });
  } catch (err) {
    console.error("Get trip detail error:", err);
    return res
      .status(500)
      .json({ message: "Server error while fetching trip detail" });
  }
}

async function rateTrip(req, res) {
  try {
    const { rating } = req.body;

    if (typeof rating !== "number" || Number.isNaN(rating)) {
      return res
        .status(400)
        .json({ message: "rating must be a number between 1 and 5" });
    }

    if (rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ message: "rating must be between 1 and 5" });
    }

    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.passenger.toString() !== req.user.userId) {
      return res
        .status(403)
        .json({ message: "You are not the passenger of this trip" });
    }

    if (trip.status !== "COMPLETED") {
      return res.status(400).json({
        message: "Only completed trips can be rated",
      });
    }

    if (trip.isRated) {
      return res
        .status(400)
        .json({ message: "This trip has already been rated" });
    }

    const driverProfile = await Driver.findById(trip.driver);
    if (!driverProfile) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    const currentAvg = driverProfile.rating || 0;
    const currentCount = driverProfile.ratingCount || 0;
    const newCount = currentCount + 1;

    const newAvg =
      currentCount === 0
        ? rating
        : (currentAvg * currentCount + rating) / newCount;

    driverProfile.rating = newAvg;
    driverProfile.ratingCount = newCount;
    await driverProfile.save();

    trip.isRated = true;
    trip.passengerRating = rating;
    await trip.save();

    return res.json({
      message: "Rating submitted successfully",
      driver: {
        id: driverProfile._id,
        rating: driverProfile.rating,
        ratingCount: driverProfile.ratingCount,
        totalTrips: driverProfile.totalTrips,
      },
      trip,
    });
  } catch (err) {
    console.error("Rate trip error:", err);
    return res
      .status(500)
      .json({ message: "Server error while rating trip" });
  }
}

module.exports = {
  createTrip,
  startTrip,
  completeTrip,
  cancelTrip,
  listTrips,
  getMyTrips,
  getPassengerTrips,
  getTripById,
  rateTrip,
};
