const Driver = require("../models/Driver");
const User = require("../models/user");
const Vehicle = require("../models/Vehicle");
const Trip = require("../models/Trip");

async function findOrCreateDriverForUser(userId, licenseNumber, licenseClass) {
  let driver = await Driver.findOne({ user: userId });

  if (!driver) {
    driver = await Driver.create({
      user: userId,
      licenseNumber,
      licenseClass,
    });
  } else {
    driver.licenseNumber = licenseNumber;
    driver.licenseClass = licenseClass;
    await driver.save();
  }

  return driver;
}

async function saveDriverProfile(req, res) {
  try {
    const { licenseNumber, licenseClass } = req.body;

    if (!licenseNumber || !licenseClass) {
      return res
        .status(400)
        .json({ message: "licenseNumber and licenseClass are required" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const driver = await findOrCreateDriverForUser(
      req.user.userId,
      licenseNumber,
      licenseClass
    );

    const populated = await driver.populate("user", "name email role");

    return res.status(200).json({
      message: "Driver profile saved successfully",
      driver: populated,
    });
  } catch (err) {
    console.error("Error in POST /api/drivers/profile:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getCurrentDriver(req, res) {
  try {
    const driver = await Driver.findOne({ user: req.user.userId }).populate(
      "user",
      "name email role"
    );

    if (!driver) {
      return res
        .status(404)
        .json({ message: "Driver profile does not exist" });
    }

    return res.status(200).json(driver);
  } catch (err) {
    console.error("Error in GET /api/drivers/me:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function listPendingDrivers(req, res) {
  try {
    const drivers = await Driver.find({ isApproved: false }).populate(
      "user",
      "name email role"
    );

    return res.status(200).json(drivers);
  } catch (err) {
    console.error("Error in GET /api/drivers/pending:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function approveDriver(req, res) {
  try {
    const driverId = req.params.id;

    const driver = await Driver.findById(driverId).populate(
      "user",
      "name email role"
    );

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    if (driver.isApproved) {
      return res.status(400).json({ message: "Driver is already approved" });
    }

    driver.isApproved = true;
    await driver.save();

    return res.status(200).json({
      message: "Driver approved successfully",
      driver,
    });
  } catch (err) {
    console.error("Error in PATCH /api/drivers/:id/approve:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function updateDriverStatus(req, res) {
  try {
    const { isActive } = req.body;

    if (typeof isActive === "undefined") {
      return res
        .status(400)
        .json({ message: "isActive field is required (true/false)" });
    }

    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { isActive: Boolean(isActive) },
      { new: true }
    ).populate("user");

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    return res.json({
      message: "Driver status updated successfully",
      driver,
    });
  } catch (err) {
    console.error("Error in PATCH /api/drivers/:id/status:", err);
    return res.status(500).json({
      message: "Server error while updating driver status",
    });
  }
}

async function getDriverDashboard(req, res) {
  try {
    const driver = await Driver.findOne({ user: req.user.userId }).populate(
      "user"
    );

    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    const vehicles = await Vehicle.find({ ownerDriver: driver._id });
    const totalVehicles = vehicles.length;
    const verifiedVehicles = vehicles.filter((v) => v.isVerified).length;
    const activeVehicles = vehicles.filter((v) => v.isActive !== false).length;

    const [ongoingTrip, completedCount, cancelledCount] = await Promise.all([
      Trip.findOne({ driver: driver._id, status: "ON_GOING" })
        .populate("request")
        .populate("passenger")
        .populate("vehicle"),
      Trip.countDocuments({ driver: driver._id, status: "COMPLETED" }),
      Trip.countDocuments({ driver: driver._id, status: "CANCELLED" }),
    ]);

    return res.json({
      driver: {
        id: driver._id,
        user: {
          id: driver.user._id,
          name: driver.user.name,
          email: driver.user.email,
        },
        isApproved: driver.isApproved,
        isActive: driver.isActive !== false,
        rating: driver.rating || 0,
        ratingCount: driver.ratingCount || 0,
        totalTrips: driver.totalTrips || 0,
        createdAt: driver.createdAt,
      },
      vehicles: {
        total: totalVehicles,
        verified: verifiedVehicles,
        active: activeVehicles,
        items: vehicles,
      },
      trips: {
        ongoing: ongoingTrip || null,
        counts: {
          completed: completedCount,
          cancelled: cancelledCount,
        },
      },
    });
  } catch (err) {
    console.error("Driver dashboard error:", err);
    return res
      .status(500)
      .json({ message: "Server error while fetching driver dashboard" });
  }
}

module.exports = {
  saveDriverProfile,
  getCurrentDriver,
  listPendingDrivers,
  approveDriver,
  updateDriverStatus,
  getDriverDashboard,
};
