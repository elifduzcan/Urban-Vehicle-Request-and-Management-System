import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client";

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function RequestDetail() {
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchRequest() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/requests/${id}`);
      setRequest(res.data?.request || res.data);
    } catch (err) {
      console.error("Request detail error:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load request detail"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Request Detail</h2>
        <button onClick={fetchRequest}>Refresh</button>
      </div>

      <div style={{ marginTop: 10 }}>
        <Link to="/admin/requests">← Back to Requests</Link>
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

      {!request ? (
        <div style={{ marginTop: 12, color: "#666" }}>No request data.</div>
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
              <b>Request ID:</b> {request._id}
            </div>
            <div>
              <b>Status:</b> {request.status || "-"}
            </div>
            <div>
              <b>Created At:</b> {formatDate(request.createdAt)}
            </div>

            <hr style={{ border: "none", borderTop: "1px solid #eee" }} />

            <div>
              <b>Passenger:</b>{" "}
              {request.passenger?.name ||
                request.passenger?.email ||
                request.passenger ||
                "-"}
            </div>

            <div>
              <b>Pickup:</b> {request.pickupAddress || "-"}
            </div>
            <div>
              <b>Dropoff:</b> {request.dropoffAddress || "-"}
            </div>

            {request.notes ? (
              <div>
                <b>Notes:</b> {request.notes}
              </div>
            ) : null}

            {Array.isArray(request.trips) && request.trips.length ? (
              <>
                <hr style={{ border: "none", borderTop: "1px solid #eee" }} />
                <div>
                  <b>Related Trips:</b>
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {request.trips.map((t) => (
                    <li key={t._id}>
                      <Link to={`/trips/${t._id}`}>{t._id}</Link>{" "}
                      <span style={{ color: "#666" }}>
                        — {t.status || "-"} — {formatDate(t.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
