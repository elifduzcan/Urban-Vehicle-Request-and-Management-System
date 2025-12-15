// src/controllers/tripController.js
const Trip = require("../models/Trip");
const Request = require("../models/Request");

// Create a trip from a pending request (Driver accepts a request)
exports.createTrip = async (req, res) => {
  try {
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({
        message: "Request ID is required",
      });
    }

    // Find the pending request
    const request = await Request.findById(requestId);

    if (!request) {
      return res.status(404).json({
        message: "Request not found",
      });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        message: "Request is not available",
      });
    }

    // Create the trip
    const trip = await Trip.create({
      request: requestId,
      passenger: request.passenger,
      driver: req.userId,
      status: "ON_GOING",
    });

    // Update request status to ACCEPTED
    request.status = "ACCEPTED";
    await request.save();

    res.status(201).json({
      message: "Trip created successfully",
      trip,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error creating trip",
      error: error.message,
    });
  }
};

// Complete a trip (Driver marks trip as completed)
exports.completeTrip = async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await Trip.findById(id);

    if (!trip) {
      return res.status(404).json({
        message: "Trip not found",
      });
    }

    // Verify the driver owns this trip
    if (trip.driver.toString() !== req.userId) {
      return res.status(403).json({
        message: "You are not authorized to complete this trip",
      });
    }

    if (trip.status !== "ON_GOING") {
      return res.status(400).json({
        message: "Trip is not ongoing",
      });
    }

    trip.status = "COMPLETED";
    trip.completedAt = new Date();
    await trip.save();

    // Update the associated request status
    await Request.findByIdAndUpdate(trip.request, { status: "COMPLETED" });

    res.status(200).json({
      message: "Trip completed successfully",
      trip,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error completing trip",
      error: error.message,
    });
  }
};

// Get driver's own trips
exports.getMyTrips = async (req, res) => {
  try {
    const trips = await Trip.find({ driver: req.userId })
      .sort({ createdAt: -1 })
      .populate("passenger", "name email")
      .populate("request", "pickupAddress dropoffAddress");

    res.status(200).json({
      message: "Trips retrieved successfully",
      trips,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving trips",
      error: error.message,
    });
  }
};
