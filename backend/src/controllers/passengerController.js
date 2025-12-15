const User = require("../models/user");
const Request = require("../models/Request");
const Trip = require("../models/Trip");

async function getDashboard(req, res) {
  try {
    const user = await User.findById(req.user.userId).select("_id name email");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const requests = await Request.find({ passenger: req.user.userId })
      .sort({ createdAt: -1 })
      .lean();

    const requestCounts = {
      total: requests.length,
      pending: requests.filter((r) => r.status === "PENDING").length,
      accepted: requests.filter((r) => r.status === "ACCEPTED").length,
      ongoing: requests.filter((r) => r.status === "ON_GOING").length,
      completed: requests.filter((r) => r.status === "COMPLETED").length,
      cancelled: requests.filter((r) => r.status === "CANCELLED").length,
    };

    const activeRequest =
      requests.find((r) => ["PENDING", "ACCEPTED", "ON_GOING"].includes(r.status)) ||
      null;

    const trips = await Trip.find({ passenger: req.user.userId })
      .populate({ path: "driver", populate: { path: "user" } })
      .populate("vehicle")
      .populate("request")
      .sort({ createdAt: -1 });

    const tripCounts = {
      total: trips.length,
      ongoing: trips.filter((t) => t.status === "ON_GOING").length,
      completed: trips.filter((t) => t.status === "COMPLETED").length,
      cancelled: trips.filter((t) => t.status === "CANCELLED").length,
    };

    const currentTrip = trips.find((t) => t.status === "ON_GOING") || null;

    return res.json({
      passenger: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      requests: {
        active: activeRequest,
        counts: requestCounts,
        latest: requests.slice(0, 5),
      },
      trips: {
        current: currentTrip,
        counts: tripCounts,
        latest: trips.slice(0, 5),
      },
    });
  } catch (err) {
    console.error("Passenger dashboard error:", err);
    return res
      .status(500)
      .json({ message: "Server error while fetching passenger dashboard" });
  }
}

module.exports = {
  getDashboard,
};
