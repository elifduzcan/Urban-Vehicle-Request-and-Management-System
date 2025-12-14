import { useEffect, useState } from "react";
import axios from "axios";

function MyTrips() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState("");

  const fetchTrips = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await axios.get("http://localhost:5001/api/trips/my", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      console.log("TOKEN:", localStorage.getItem("token"));
      console.log("TRIPS RESPONSE:", res.data);
      console.log("TRIPS ARRAY:", res.data.trips);


      setTrips(res.data.trips || []);
    } catch (err) {
      console.error("Error fetching trips:", err);
      setError(err.response?.data?.message || "Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const completeTrip = async (tripId) => {
    try {
      setActionLoading(tripId);
      const res = await axios.patch(`http://localhost:5001/api/trips/${tripId}/complete`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      alert("Trip completed!");
      fetchTrips();
    } catch (err) {
      console.error("Complete trip error:", err);
      alert(err.response?.data?.message || "Failed to complete trip");
    } finally {
      setActionLoading(null);
    }
  };

  const cancelTrip = async (tripId) => {
    try {
      setActionLoading(tripId);
      const res = await axios.patch(`http://localhost:5001/api/trips/${tripId}/cancel`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      alert("Trip cancelled!");
      fetchTrips();
    } catch (err) {
      console.error("Cancel trip error:", err);
      alert(err.response?.data?.message || "Failed to cancel trip");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>My Trips</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading && <p>Loading trips...</p>}

      {!loading && trips.length === 0 && <p>You have no trips yet.</p>}

      {trips.map((trip) => (
        <div
          key={trip._id}
          style={{
            border: "1px solid #ddd",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "12px",
          }}
        >
          <p>
            <strong>Status:</strong>{" "}
            <span
              style={{
                color:
                  trip.status === "ON_GOING"
                    ? "green"
                    : trip.status === "COMPLETED"
                    ? "blue"
                    : "red",
              }}
            >
              {trip.status}
            </span>
          </p>

          <p>
            <strong>Pickup:</strong> {trip.request?.pickupAddress}
          </p>
          <p>
            <strong>Dropoff:</strong> {trip.request?.dropoffAddress}
          </p>

          <p>
            <strong>Vehicle ID:</strong> {" "}
            {typeof trip.vehicle === "string"
              ? trip.vehicle
              : (trip.vehicle?.plateNumber || trip.vehicle?._id || "-")}
          </p>

          {trip.status === "ON_GOING" && (
            <div style={{ marginTop: "10px" }}>
              <button
                onClick={() => completeTrip(trip._id)}
                disabled={actionLoading === trip._id}
                style={{
                  padding: "8px 12px",
                  marginRight: "10px",
                  backgroundColor: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor:
                    actionLoading === trip._id ? "not-allowed" : "pointer",
                }}
              >
                {actionLoading === trip._id
                  ? "Processing..."
                  : "Complete Trip"}
              </button>

              <button
                onClick={() => cancelTrip(trip._id)}
                disabled={actionLoading === trip._id}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor:
                    actionLoading === trip._id ? "not-allowed" : "pointer",
                }}
              >
                {actionLoading === trip._id ? "Processing..." : "Cancel Trip"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default MyTrips;
