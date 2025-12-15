// frontend/src/pages/MyTrips.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api/client";

export default function MyTrips() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("NEWEST");

  const formatDate = (iso) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleString();
  };

  const fetchTrips = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/trips/my");
      const data = res.data;
      const list = Array.isArray(data) ? data : data?.trips || [];
      setTrips(list);
    } catch (err) {
      console.error("fetchTrips error:", err);
      setError(err.response?.data?.message || "Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const counts = useMemo(() => {
    const c = { ON_GOING: 0, COMPLETED: 0, CANCELLED: 0 };
    for (const t of trips) {
      if (c[t.status] !== undefined) c[t.status]++;
    }
    return c;
  }, [trips]);

  const filteredTrips = useMemo(() => {
    const query = q.trim().toLowerCase();

    let list = [...trips];

    if (statusFilter !== "ALL") {
      list = list.filter((t) => t.status === statusFilter);
    }

    if (query) {
      list = list.filter((t) => {
        const passengerName =
          t.request?.passenger?.name ||
          t.passenger?.name ||
          t.request?.passengerName ||
          "";
        const passengerEmail =
          t.request?.passenger?.email || t.passenger?.email || "";
        const pickup = t.request?.pickupAddress || t.pickupAddress || "";
        const dropoff = t.request?.dropoffAddress || t.dropoffAddress || "";
        const plate = t.vehicle?.plateNumber || "";
        const blob = `${passengerName} ${passengerEmail} ${pickup} ${dropoff} ${plate} ${t.status}`.toLowerCase();
        return blob.includes(query);
      });
    }

    list.sort((a, b) => {
      const aTime = new Date(a.createdAt || a.startedAt || 0).getTime();
      const bTime = new Date(b.createdAt || b.startedAt || 0).getTime();
      return sort === "NEWEST" ? bTime - aTime : aTime - bTime;
    });

    return list;
  }, [trips, statusFilter, q, sort]);

  const completeTrip = async (tripId) => {
    const ok = window.confirm("Complete this trip?");
    if (!ok) return;

    try {
      setActionLoading(tripId);
      await api.patch(`/trips/${tripId}/complete`);
      await fetchTrips();
    } catch (err) {
      console.error("completeTrip error:", err);
      alert(err.response?.data?.message || "Failed to complete trip");
    } finally {
      setActionLoading(null);
    }
  };

  const cancelTrip = async (tripId) => {
    const ok = window.confirm("Cancel this trip?");
    if (!ok) return;

    try {
      setActionLoading(tripId);
      await api.patch(`/trips/${tripId}/cancel`);
      await fetchTrips();
    } catch (err) {
      console.error("cancelTrip error:", err);
      alert(err.response?.data?.message || "Failed to cancel trip");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
      <h2>My Trips</h2>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
        <div style={{ fontSize: 14 }}>
          <strong>Counts:</strong>{" "}
          ON_GOING={counts.ON_GOING}, COMPLETED={counts.COMPLETED}, CANCELLED={counts.CANCELLED}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: 8 }}>
          <option value="ALL">All statuses</option>
          <option value="ON_GOING">ON_GOING</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>

        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ padding: 8 }}>
          <option value="NEWEST">Newest first</option>
          <option value="OLDEST">Oldest first</option>
        </select>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search passenger / pickup / dropoff / plate..."
          style={{ padding: 8, minWidth: 320 }}
        />
      </div>

      {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}
      {loading ? (
        <p style={{ marginTop: 12 }}>Loading...</p>
      ) : filteredTrips.length === 0 ? (
        <p style={{ marginTop: 12 }}>No trips found.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", paddingBottom: 6 }}>Status</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", paddingBottom: 6 }}>Passenger</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", paddingBottom: 6 }}>Route</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", paddingBottom: 6 }}>Vehicle</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", paddingBottom: 6 }}>Created</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", paddingBottom: 6 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrips.map((t) => {
              const passenger =
                t.request?.passenger?.name ||
                t.passenger?.name ||
                t.request?.passengerName ||
                "-";
              const pickup = t.request?.pickupAddress || t.pickupAddress || "-";
              const dropoff = t.request?.dropoffAddress || t.dropoffAddress || "-";
              const plate = t.vehicle?.plateNumber ? t.vehicle.plateNumber.toUpperCase() : "-";

              return (
                <tr key={t._id}>
                  <td style={{ padding: "8px 4px" }}>{t.status}</td>
                  <td style={{ padding: "8px 4px" }}>{passenger}</td>
                  <td style={{ padding: "8px 4px" }}>
                    {pickup} → {dropoff}
                  </td>
                  <td style={{ padding: "8px 4px" }}>{plate}</td>
                  <td style={{ padding: "8px 4px" }}>{formatDate(t.createdAt)}</td>
                  <td style={{ padding: "8px 4px" }}>
                    {t.status === "ON_GOING" ? (
                      <>
                        <button
                          onClick={() => completeTrip(t._id)}
                          disabled={actionLoading === t._id}
                          style={{ marginRight: 8 }}
                        >
                          {actionLoading === t._id ? "..." : "Complete"}
                        </button>
                        <button onClick={() => cancelTrip(t._id)} disabled={actionLoading === t._id}>
                          {actionLoading === t._id ? "..." : "Cancel"}
                        </button>
                      </>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}