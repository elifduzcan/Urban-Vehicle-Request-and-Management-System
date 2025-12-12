// src/pages/AdminPendingDrivers.jsx
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

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

export default function AdminPendingDrivers() {
  const { user } = useAuth();

  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [error, setError] = useState("");

  async function fetchPendingDrivers() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/drivers/pending");
      setDrivers(res.data || []);
    } catch (err) {
      console.error("Error loading pending drivers:", err);
      const msg =
        err.response?.data?.message ||
        "An error occurred while loading pending drivers.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPendingDrivers();
  }, []);

  async function handleApprove(id) {
    setError("");
    setApprovingId(id);
    try {
      await api.patch(`/drivers/${id}/approve`);
      // Onaylanan driver'ı listeden çıkar
      setDrivers((prev) => prev.filter((d) => d._id !== id));
    } catch (err) {
      console.error("Error approving driver:", err);
      const msg =
        err.response?.data?.message ||
        "An error occurred while approving the driver.";
      setError(msg);
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Admin Panel – Pending Drivers</h1>
      <p style={{ fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Logged in as: <strong>{user?.name || user?.email}</strong> ({user?.role})
      </p>

      <AdminTopNav />

      {error && (
        <p style={{ color: "red", fontSize: 13, marginBottom: 8 }}>{error}</p>
      )}

      {loading ? (
        <p>Loading pending drivers...</p>
      ) : drivers.length === 0 ? (
        <p style={{ fontSize: 14 }}>No pending drivers.</p>
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
                Name
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Email
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                License Number
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                License Class
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Created At
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d._id}>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                  }}
                >
                  {d.user?.name || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                  }}
                >
                  {d.user?.email || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                  }}
                >
                  {d.licenseNumber || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                  }}
                >
                  {d.licenseClass || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                  }}
                >
                  {formatDate(d.createdAt)}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                  }}
                >
                  <button
                    type="button"
                    disabled={approvingId === d._id}
                    onClick={() => handleApprove(d._id)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 4,
                      border: "1px solid #ccc",
                      cursor:
                        approvingId === d._id ? "default" : "pointer",
                      backgroundColor: "#e8f5e9",
                    }}
                  >
                    {approvingId === d._id ? "Approving..." : "Approve"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}