// src/pages/AdminGlobalRequests.jsx
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const STATUSES = ["PENDING", "ACCEPTED", "COMPLETED", "CANCELLED"];

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function AdminTopNav() {
  const location = useLocation();
  const linkStyle = (path) => ({
    marginRight: 8,
    padding: "4px 8px",
    borderRadius: 4,
    border: "1px solid #ddd",
    textDecoration: "none",
    fontSize: 14,
    backgroundColor: location.pathname === path ? "#e3f2fd" : "#f9f9f9",
  });
  return (
    <div
      style={{
        marginBottom: 16,
        paddingBottom: 8,
        borderBottom: "1px solid #ddd",
      }}
    >
      <Link to="/admin/users" style={linkStyle("/admin/users")}>
        Users
      </Link>
      <Link
        to="/admin/pending-drivers"
        style={linkStyle("/admin/pending-drivers")}
      >
        Pending Drivers
      </Link>
      <Link
        to="/admin/pending-vehicles"
        style={linkStyle("/admin/pending-vehicles")}
      >
        Pending Vehicles
      </Link>
      <Link to="/admin/requests" style={linkStyle("/admin/requests")}>
        Global Requests
      </Link>
      <Link to="/admin/trips" style={linkStyle("/admin/trips")}>
        Global Trips
      </Link>
    </div>
  );
}

export default function AdminGlobalRequests() {
  const { user } = useAuth();

  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchRequests() {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/requests", { params });
      setRequests(res.data?.requests || []);
    } catch (err) {
      console.error("Error loading requests:", err);
      const msg =
        err.response?.data?.message ||
        "An error occurred while loading requests.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Admin Panel – Global Requests</h1>
      <p style={{ fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Logged in as: <strong>{user?.name || user?.email}</strong> ({user?.role})
      </p>

      <AdminTopNav />

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, marginRight: 4 }}>Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={fetchRequests}
          style={{
            marginLeft: 8,
            padding: "4px 10px",
            borderRadius: 4,
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <p style={{ color: "red", fontSize: 13, marginBottom: 8 }}>{error}</p>
      )}

      {loading ? (
        <p>Loading requests...</p>
      ) : requests.length === 0 ? (
        <p style={{ fontSize: 14 }}>No requests found.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Passenger
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Pickup
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Dropoff
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Status
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Created At
              </th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r._id}>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                  }}
                >
                  {r.passenger?.name ||
                    r.passenger?.email ||
                    r.passenger?._id ||
                    "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                  }}
                >
                  {r.pickupAddress}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                  }}
                >
                  {r.dropoffAddress}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                    fontWeight: 500,
                  }}
                >
                  {r.status}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                  }}
                >
                  {formatDate(r.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}