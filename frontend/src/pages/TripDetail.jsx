// src/pages/TripDetail.jsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function TripDetail() {
  const { id } = useParams();
  const { user } = useAuth();

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Rating UI (Passenger)
  const [rating, setRating] = useState("");
  const [rateLoading, setRateLoading] = useState(false);
  const [rateMsg, setRateMsg] = useState("");

  async function fetchTrip() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/trips/${id}`);
      const t = res.data?.trip || res.data;
      setTrip(t);

      if (t?.isRated && typeof t?.passengerRating === "number") {
        setRating(String(t.passengerRating));
      } else {
        setRating("");
      }
    } catch (err) {
      console.error("Trip detail error:", err);
      setError(
        err?.response?.data?.message || err?.message || "Failed to load trip detail"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTrip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isPassenger = user?.role === "PASSENGER";
  const canRate = isPassenger && trip?.status === "COMPLETED" && !trip?.isRated;

  const backTo =
    user?.role === "PASSENGER"
      ? "/passenger/trips"
      : user?.role === "DRIVER"
      ? "/driver/my-trips"
      : "/admin/trips";

  async function submitRating() {
    const n = Number(rating);
    if (!Number.isFinite(n) || n < 1 || n > 5) {
      setRateMsg("");
      setError("Please select a rating between 1 and 5.");
      return;
    }

    setError("");
    setRateMsg("");
    setRateLoading(true);

    try {
      await api.patch(`/trips/${id}/rate`, { rating: Number(n) });

      setTrip((prev) =>
        prev ? { ...prev, isRated: true, passengerRating: n } : prev
      );
      setRateMsg("Thanks! Your rating has been saved.");
    } catch (err) {
      console.error("Rate trip error:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to submit rating"
      );
    } finally {
      setRateLoading(false);
    }
  }

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Trip Detail</h2>
        <button onClick={fetchTrip}>Refresh</button>
      </div>

      <div style={{ marginTop: 10 }}>
        <Link to={backTo}>← Back</Link>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #f3c7c7",
            background: "#fff5f5",
            borderRadius: 8,
            color: "#8a1f1f",
          }}
        >
          {error}
        </div>
      ) : null}

      {!trip ? (
        <div style={{ marginTop: 12, color: "#666" }}>No trip data.</div>
      ) : (
        <div
          style={{
            marginTop: 14,
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: 14,
            background: "#fff",
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <div>
              <b>Trip ID:</b> {trip._id}
            </div>
            <div>
              <b>Status:</b> {trip.status || "-"}
            </div>
            <div>
              <b>Created At:</b> {formatDate(trip.createdAt)}
            </div>
            <div>
              <b>Fare:</b> {trip.fare ?? 0}
            </div>

            {/* ✅ Passenger Rating */}
            {isPassenger && trip.status === "COMPLETED" ? (
              <div
                style={{
                  marginTop: 6,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #eee",
                  background: "#fafafa",
                }}
              >
                <b>Driver Rating:</b>{" "}
                {trip.isRated ? (
                  <span>{trip.passengerRating ?? "-"} / 5</span>
                ) : (
                  <span style={{ color: "#666" }}>Not rated yet</span>
                )}

                {canRate ? (
                  <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
                    <select value={rating} onChange={(e) => setRating(e.target.value)}>
                      <option value="">Select…</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={submitRating}
                      disabled={rateLoading}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid #ccc",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {rateLoading ? "Saving..." : "Submit Rating"}
                    </button>

                    {rateMsg ? (
                      <span style={{ color: "#1a7f37" }}>{rateMsg}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <hr style={{ border: "none", borderTop: "1px solid #eee" }} />

            <div>
              <b>Passenger:</b>{" "}
              {trip.passenger?.name || trip.passenger?.email || trip.passenger || "-"}
            </div>

            <div>
              <b>Driver:</b>{" "}
              {trip.driver?.user?.name ||
                trip.driver?.user?.email ||
                trip.driver?.user ||
                trip.driver ||
                "-"}
            </div>

            <div>
              <b>Vehicle:</b>{" "}
              {trip.vehicle?.plateNumber || trip.vehicle?._id || trip.vehicle || "-"}
            </div>

            <hr style={{ border: "none", borderTop: "1px solid #eee" }} />

            <div>
              <b>Request:</b>{" "}
              {trip.request?._id ? (
                <Link to={`/requests/${trip.request._id}`}>{trip.request._id}</Link>
              ) : (
                "-"
              )}
            </div>

            {trip.request ? (
              <>
                <div>
                  <b>Pickup:</b> {trip.request.pickupAddress || "-"}
                </div>
                <div>
                  <b>Dropoff:</b> {trip.request.dropoffAddress || "-"}
                </div>
                <div>
                  <b>Request Status:</b> {trip.request.status || "-"}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}