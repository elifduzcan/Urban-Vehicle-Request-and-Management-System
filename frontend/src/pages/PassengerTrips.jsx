// src/pages/PassengerTrips.jsx
import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function PassengerTrips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const formatDate = (iso) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleString();
  };

  useEffect(() => {
    async function fetchTrips() {
      setError("");
      setLoading(true);
      try {
        // Backend: GET /api/trips/my-passenger
        const res = await api.get("/trips/my-passenger");
        const data = res.data;
        const list = Array.isArray(data) ? data : data?.trips || [];
        setTrips(list);
      } catch (err) {
        console.error("Error fetching passenger trips", err);
        setError(
          err?.response?.data?.message ||
            "Failed to load your trips. Please try again."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchTrips();
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h2>Passenger Trip History</h2>
      <p>
        Welcome, <strong>{user?.name}</strong> ({user?.email})
      </p>

      {error && (
        <p style={{ color: "red", marginTop: 8, marginBottom: 8 }}>{error}</p>
      )}

      {loading ? (
        <p>Loading your trips...</p>
      ) : trips.length === 0 ? (
        <p>You have no trips yet.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 12,
          }}
        >
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                Route
              </th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                Driver
              </th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                Vehicle
              </th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                Status
              </th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                Created
              </th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip) => (
              <tr key={trip._id}>
                <td
                  style={{
                    borderBottom: "1px solid #eee",
                    padding: "4px 0",
                  }}
                >
                  {trip.request?.pickupAddress} →{" "}
                  {trip.request?.dropoffAddress}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eee",
                    padding: "4px 0",
                  }}
                >
                  {trip.driver?.name || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eee",
                    padding: "4px 0",
                  }}
                >
                  {trip.vehicle
                    ? `${trip.vehicle.plateNumber || trip.vehicle.plate || ""} ${
                        trip.vehicle.model || ""
                      }`
                    : "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eee",
                    padding: "4px 0",
                    textTransform: "capitalize",
                  }}
                >
                  {trip.status}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eee",
                    padding: "4px 0",
                  }}
                >
                  {formatDate(trip.createdAt)}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #eee",
                    padding: "4px 0",
                  }}
                >
                  {formatDate(trip.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}