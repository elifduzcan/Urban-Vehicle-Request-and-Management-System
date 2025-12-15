// src/pages/PassengerTrips.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function PassengerTrips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Rating UI state
  const [ratingDraft, setRatingDraft] = useState({}); // { [tripId]: number }
  const [rateLoading, setRateLoading] = useState({}); // { [tripId]: boolean }

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

        // rating draft init
        const init = {};
        for (const t of list) {
          if (typeof t?.passengerRating === "number") init[t._id] = t.passengerRating;
        }
        setRatingDraft((prev) => ({ ...init, ...prev }));
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

  const canRateTrip = (trip) => trip?.status === "COMPLETED" && !trip?.isRated;

  async function submitRating(tripId) {
    const rating = Number(ratingDraft[tripId]);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      setError("Please select a rating between 1 and 5.");
      return;
    }

    setError("");
    setRateLoading((p) => ({ ...p, [tripId]: true }));

    try {
      // ✅ beklenen endpoint: PATCH /api/trips/:id/rate
      await api.patch(`/trips/${tripId}/rate`, { rating: Number(rating) });

      setTrips((prev) =>
        prev.map((t) =>
          t._id === tripId ? { ...t, isRated: true, passengerRating: rating } : t
        )
      );
    } catch (err) {
      console.error("Error rating trip", err);
      setError(
        err?.response?.data?.message ||
          "Failed to submit rating. Please try again."
      );
    } finally {
      setRateLoading((p) => ({ ...p, [tripId]: false }));
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
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
                Status
              </th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                Created
              </th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                Updated
              </th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                Rating
              </th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip) => (
              <tr key={trip._id}>
                <td style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
                  {trip.request?.pickupAddress} → {trip.request?.dropoffAddress}
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
                  {trip.status || "-"}
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
                  {formatDate(trip.createdAt)}
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
                  {formatDate(trip.updatedAt)}
                </td>

                <td style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
                  {canRateTrip(trip) ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select
                        value={ratingDraft[trip._id] ?? ""}
                        onChange={(e) =>
                          setRatingDraft((p) => ({
                            ...p,
                            [trip._id]: Number(e.target.value),
                          }))
                        }
                      >
                        <option value="">Rate…</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => submitRating(trip._id)}
                        disabled={!!rateLoading[trip._id]}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #ccc",
                          background: "#fafafa",
                          cursor: "pointer",
                        }}
                      >
                        {rateLoading[trip._id] ? "Saving..." : "Submit"}
                      </button>
                    </div>
                  ) : trip?.isRated ? (
                    <span>{trip.passengerRating ?? "-"} / 5</span>
                  ) : (
                    <span>-</span>
                  )}
                </td>

                <td style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
                  <Link to={`/trips/${trip._id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}