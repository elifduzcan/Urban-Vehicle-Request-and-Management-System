import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client";

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function TripDetail() {
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchTrip() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/trips/${id}`);
      // backend bazen { trip } bazen direkt objeyi dönebiliyor, ikisini de karşılayalım
      setTrip(res.data?.trip || res.data);
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

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Trip Detail</h2>
        <button onClick={fetchTrip}>Refresh</button>
      </div>

      <div style={{ marginTop: 10 }}>
        <Link to="/admin/trips">← Back to Trips</Link>
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
