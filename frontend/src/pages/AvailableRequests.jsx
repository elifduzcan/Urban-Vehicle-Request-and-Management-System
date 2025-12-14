import { useEffect, useState } from "react";
import axios from "axios";

function AvailableRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState("");

  // Fetch all available requests for DRIVER
  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await axios.get("http://localhost:5001/api/requests/available", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      setRequests(res.data.requests || []);
    } catch (err) {
      console.error("Error fetching available requests:", err);
      setError(err.response?.data?.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Accept request → starts a new trip
  const acceptRequest = async (requestId) => {
    try {
      setLoadingId(requestId);
      setError("");

      const res = await axios.post("http://localhost:5001/api/trips",
        { requestId },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      alert("Trip started successfully!");
      console.log("Trip created:", res.data);

      // Refresh list after accepting
      fetchRequests();
    } catch (err) {
      console.error("Error accepting request:", err);
      setError(err.response?.data?.message || "Error accepting request");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Available Requests</h2>

      {error && (
        <p style={{ color: "red", marginBottom: "10px" }}>
          {error}
        </p>
      )}

      {loading && <p>Loading...</p>}

      {!loading && requests.length === 0 && (
        <p>No pending requests available.</p>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {requests.map((req) => (
          <li
            key={req._id}
            style={{
              border: "1px solid #ddd",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "12px",
            }}
          >
            <p><strong>Pickup:</strong> {req.pickupAddress}</p>
            <p><strong>Dropoff:</strong> {req.dropoffAddress}</p>

            <button
              onClick={() => acceptRequest(req._id)}
              disabled={loadingId === req._id}
              style={{
                marginTop: "10px",
                padding: "8px 12px",
                backgroundColor: loadingId === req._id ? "#888" : "#0066ff",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: loadingId === req._id ? "not-allowed" : "pointer",
              }}
            >
              {loadingId === req._id ? "Accepting..." : "Accept Request"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AvailableRequests;
