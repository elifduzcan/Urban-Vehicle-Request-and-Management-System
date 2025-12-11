// src/controllers/requestController.js
const Request = require("../models/Request");

// Create a new request (Passenger only)
exports.createRequest = async (req, res) => {
  try {
    const { pickupAddress, dropoffAddress } = req.body;

    if (!pickupAddress || !dropoffAddress) {
      return res.status(400).json({
        message: "Pickup and dropoff addresses are required",
      });
    }

    const request = await Request.create({
      passenger: req.userId,
      pickupAddress,
      dropoffAddress,
      status: "PENDING",
    });

    res.status(201).json({
      message: "Request created successfully",
      request,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error creating request",
      error: error.message,
    });
  }
};

// Get passenger's own requests
exports.getMyRequests = async (req, res) => {
  try {
    const requests = await Request.find({ passenger: req.userId })
      .sort({ createdAt: -1 })
      .populate("passenger", "name email");

    res.status(200).json({
      message: "Requests retrieved successfully",
      requests,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving requests",
      error: error.message,
    });
  }
};

// Get available requests for drivers (PENDING status)
exports.getAvailableRequests = async (req, res) => {
  try {
    const requests = await Request.find({ status: "PENDING" })
      .sort({ createdAt: -1 })
      .populate("passenger", "name email");

    res.status(200).json({
      message: "Available requests retrieved successfully",
      requests,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving available requests",
      error: error.message,
    });
  }
};
