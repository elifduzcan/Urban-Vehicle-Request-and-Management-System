// src/pages/AdminPendingVehicles.jsx
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

export default function AdminPendingVehicles() {
  const { user } = useAuth();

  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [error, setError] = useState("");

  async function fetchPendingVehicles() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/vehicles/pending");
      setVehicles(res.data || []);
    } catch (err) {
      console.error("Error loading pending vehicles:", err);
      const msg =
        err.response?.data?.message ||
        "An error occurred while loading pending vehicles.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPendingVehicles();
  }, []);

  async function handleVerify(id) {
    setError("");
    setVerifyingId(id);
    try {
      await api.patch(`/vehicles/${id}/verify`);
      setVehicles((prev) => prev.filter((v) => v._id !== id));
    } catch (err) {
      console.error("Error verifying vehicle:", err);
      const msg =
        err.response?.data?.message ||
        "An error occurred while verifying the vehicle.";
      setError(msg);
    } finally {
      setVerifyingId(null);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Admin Panel – Pending Vehicles</h1>
      <p style={{ fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Logged in as: <strong>{user?.name || user?.email}</strong> ({user?.role})
      </p>

      <AdminTopNav />

      {error && (
        <p style={{ color: "red", fontSize: 13, marginBottom: 8 }}>{error}</p>
      )}

      {loading ? (
        <p>Loading pending vehicles...</p>
      ) : vehicles.length === 0 ? (
        <p style={{ fontSize: 14 }}>No pending vehicles.</p>
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
                Plate
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Brand
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Model
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Owner Name
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Owner Email
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
            {vehicles.map((v) => (
              <tr key={v._id}>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                  }}
                >
                  {v.plateNumber || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                  }}
                >
                  {v.brand || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                  }}
                >
                  {v.model || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                  }}
                >
                  {v.ownerDriver?.user?.name || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                  }}
                >
                  {v.ownerDriver?.user?.email || "-"}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                  }}
                >
                  {formatDate(v.createdAt)}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    padding: "4px 0",
                  }}
                >
                  <button
                    type="button"
                    disabled={verifyingId === v._id}
                    onClick={() => handleVerify(v._id)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 4,
                      border: "1px solid #ccc",
                      cursor:
                        verifyingId === v._id ? "default" : "pointer",
                      backgroundColor: "#e8f5e9",
                    }}
                  >
                    {verifyingId === v._id ? "Verifying..." : "Verify"}
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
