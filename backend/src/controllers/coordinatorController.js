const Driver = require("../models/Driver");
const Vehicle = require("../models/Vehicle");
const Request = require("../models/Request");
const Trip = require("../models/Trip");

async function getOverview(req, res) {
  try {
    const pendingDrivers = await Driver.find({ isApproved: false })
      .populate("user")
      .sort({ createdAt: 1 });

    const pendingVehicles = await Vehicle.find({ isVerified: false })
      .populate({
        path: "ownerDriver",
        populate: { path: "user" },
      })
      .sort({ createdAt: 1 });

    const pendingRequests = await Request.find({ status: "PENDING" })
      .populate("passenger")
      .sort({ createdAt: 1 });

    const ongoingTrips = await Trip.find({ status: "ON_GOING" })
      .populate("driver")
      .populate("passenger")
      .populate("vehicle")
      .populate("request")
      .sort({ createdAt: 1 });

    return res.json({
      pendingDrivers,
      pendingVehicles,
      pendingRequests,
      ongoingTrips,
    });
  } catch (err) {
    console.error("Coordinator overview error:", err);
    return res
      .status(500)
      .json({ message: "Server error while fetching coordinator overview" });
  }
}

module.exports = {
  getOverview,
};
