const Request = require("../models/Request");
const Trip = require("../models/Trip");

async function createRequest(req, res) {
  try {
    const { pickupAddress, dropAddress } = req.body;

    if (!pickupAddress || !dropAddress) {
      return res.status(400).json({
        message: "pickupAddress and dropAddress are required",
      });
    }

    const existingActiveRequest = await Request.findOne({
      passenger: req.user.userId,
      status: { $in: ["PENDING", "ACCEPTED", "ON_GOING"] },
    });

    if (existingActiveRequest) {
      return res.status(400).json({
        message:
          "You already have an active request. Please cancel or wait until it is completed before creating a new one.",
      });
    }

    const request = await Request.create({
      passenger: req.user.userId,
      pickupAddress,
      dropAddress,
    });

    return res.status(201).json({ request });
  } catch (err) {
    console.error("Create request error:", err);
    return res
      .status(500)
      .json({ message: "Server error while creating request" });
  }
}

async function getMyRequests(req, res) {
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

    const [total, requests] = await Promise.all([
      Request.countDocuments(filter),
      Request.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return res.json({
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get my requests error:", err);
    return res
      .status(500)
      .json({ message: "Server error while fetching requests" });
  }
}

async function getAvailableRequests(req, res) {
  try {
    const requests = await Request.find({ status: "PENDING" })
      .sort({ createdAt: -1 })
      .populate("passenger");

    return res.json({ requests });
  } catch (err) {
    console.error("Get available requests error:", err);
    return res.status(500).json({
      message: "Server error while fetching available requests",
    });
  }
}

async function getRequestDetail(req, res) {
  try {
    const { id } = req.params;

    const request = await Request.findById(id).populate("passenger");
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    const trips = await Trip.find({ request: request._id })
      .populate({ path: "driver", populate: { path: "user", select: "_id" } })
      .populate("vehicle")
      .lean();

    const role = req.user.role;
    const userId = req.user.userId;

    let allowed = false;

    if (role === "ADMIN" || role === "COORDINATOR") {
      allowed = true;
    } else if (role === "PASSENGER") {
      const passengerId =
        request.passenger && request.passenger._id
          ? request.passenger._id.toString()
          : request.passenger.toString();

      if (passengerId === userId) {
        allowed = true;
      }
    } else if (role === "DRIVER") {
      const hasOwnTrip = trips.some((t) => {
        const driverUserId = t.driver?.user?._id;
        return driverUserId && driverUserId.toString() === userId;
      });

      if (hasOwnTrip) {
        allowed = true;
      }
    }

    if (!allowed) {
      return res
        .status(403)
        .json({ message: "You are not allowed to view this request" });
    }

    return res.json({ request, trips });
  } catch (err) {
    console.error("Get request detail error:", err);
    return res
      .status(500)
      .json({ message: "Server error while fetching request detail" });
  }
}

async function cancelRequest(req, res) {
  try {
    const requestId = req.params.id;

    const request = await Request.findById(requestId);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.passenger.toString() !== req.user.userId) {
      return res
        .status(403)
        .json({ message: "You are not allowed to cancel this request" });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        message: "Only PENDING requests can be cancelled",
      });
    }

    request.status = "CANCELLED";
    await request.save();

    return res.json({ request });
  } catch (err) {
    console.error("Cancel request error:", err);
    return res
      .status(500)
      .json({ message: "Server error while cancelling request" });
  }
}

async function listRequests(req, res) {
  try {
    const { status, passengerId, from, to } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (passengerId) {
      filter.passenger = passengerId;
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
    const limitRaw = parseInt(req.query.limit, 10) || 20;
    const limit = Math.min(Math.max(limitRaw, 1), 100);
    const skip = (page - 1) * limit;

    const [total, requests] = await Promise.all([
      Request.countDocuments(filter),
      Request.find(filter)
        .sort({ createdAt: -1 })
        .populate("passenger")
        .skip(skip)
        .limit(limit),
    ]);

    return res.json({
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Admin/Coordinator list requests error:", err);
    return res
      .status(500)
      .json({ message: "Server error while listing requests" });
  }
}

module.exports = {
  createRequest,
  getMyRequests,
  getAvailableRequests,
  getRequestDetail,
  cancelRequest,
  listRequests,
};
