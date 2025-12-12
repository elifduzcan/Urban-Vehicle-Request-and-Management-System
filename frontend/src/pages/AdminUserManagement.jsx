// src/pages/AdminUserManagement.jsx
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const ROLES = ["PASSENGER", "DRIVER", "COORDINATOR", "ADMIN"];

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

export default function AdminUserManagement() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [filterRole, setFilterRole] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL"); // ALL / ACTIVE / INACTIVE
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  async function fetchUsers() {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (filterRole !== "ALL") {
        params.role = filterRole;
      }
      if (filterStatus === "ACTIVE") {
        params.isActive = "true";
      } else if (filterStatus === "INACTIVE") {
        params.isActive = "false";
      }

      const res = await api.get("/admin/users", { params });
      setUsers(res.data?.users || []);
    } catch (err) {
      console.error("Error loading users:", err);
      const msg =
        err.response?.data?.message ||
        "An error occurred while loading users.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterRole, filterStatus]);

  async function handleChangeRole(userId, newRole) {
    setError("");
    setUpdatingId(userId);
    try {
      const res = await api.patch(`/admin/users/${userId}/role`, {
        role: newRole,
      });
      const updated = res.data?.user;
      if (updated) {
        setUsers((prev) =>
          prev.map((u) => (u._id === userId ? updated : u))
        );
      }
    } catch (err) {
      console.error("Error updating role:", err);
      const msg =
        err.response?.data?.message ||
        "An error occurred while updating the user role.";
      setError(msg);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleToggleActive(userId, currentActive) {
    setError("");
    setUpdatingId(userId);
    try {
      const res = await api.patch(`/admin/users/${userId}/status`, {
        isActive: !currentActive,
      });
      const updated = res.data?.user;
      if (updated) {
        setUsers((prev) =>
          prev.map((u) => (u._id === userId ? updated : u))
        );
      }
    } catch (err) {
      console.error("Error updating status:", err);
      const msg =
        err.response?.data?.message ||
        "An error occurred while updating the user status.";
      setError(msg);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Admin Panel – User Management</h1>
      <p style={{ fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Logged in as:{" "}
        <strong>{currentUser?.name || currentUser?.email}</strong> (
        {currentUser?.role})
      </p>

      <AdminTopNav />

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <label style={{ fontSize: 13, marginRight: 4 }}>Role:</label>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="ALL">All</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 13, marginRight: 4 }}>Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <button
          type="button"
          onClick={fetchUsers}
          style={{
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
        <p>Loading users...</p>
      ) : users.length === 0 ? (
        <p style={{ fontSize: 14 }}>No users found.</p>
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
                Role
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Status
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
            {users.map((u) => {
              const isActive = u.isActive !== false;
              const isSelf = currentUser && currentUser.id === u._id;
              return (
                <tr key={u._id}>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: "4px 0",
                    }}
                  >
                    {u.name || "-"}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: "4px 0",
                    }}
                  >
                    {u.email}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: "4px 0",
                    }}
                  >
                    <select
                      value={u.role}
                      disabled={updatingId === u._id}
                      onChange={(e) =>
                        handleChangeRole(u._id, e.target.value)
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: "4px 0",
                    }}
                  >
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: 12,
                        backgroundColor: isActive ? "#e8f5e9" : "#ffebee",
                        border: "1px solid #ccc",
                      }}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: "4px 0",
                    }}
                  >
                    {formatDate(u.createdAt)}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: "4px 0",
                    }}
                  >
                    <button
                      type="button"
                      disabled={updatingId === u._id || isSelf}
                      onClick={() => handleToggleActive(u._id, isActive)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        border: "1px solid #ccc",
                        cursor:
                          updatingId === u._id || isSelf
                            ? "default"
                            : "pointer",
                        backgroundColor: isActive ? "#ffe0e0" : "#e0f2f1",
                      }}
                    >
                      {isSelf
                        ? "Cannot change self"
                        : isActive
                        ? "Deactivate"
                        : "Activate"}
                    </button>
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
