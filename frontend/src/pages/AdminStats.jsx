import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

export default function AdminStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchStats() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/stats");
      setStats(res.data);
    } catch (err) {
      console.error("Admin stats error:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load admin stats"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h1>Admin Panel – Stats</h1>

      <div style={{ marginBottom: 10 }}>
        <Link to="/admin/users">← Back to Admin</Link>
        <button onClick={fetchStats} style={{ marginLeft: 10 }}>
          Refresh
        </button>
      </div>

      {loading && <p>Loading stats…</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && stats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <StatCard title="Users" value={stats.users?.total} />
          <StatCard title="Drivers (Pending)" value={stats.drivers?.pending} />
          <StatCard title="Vehicles (Pending)" value={stats.vehicles?.pending} />
          <StatCard title="Requests (Pending)" value={stats.requests?.pending} />
          <StatCard title="Trips (Ongoing)" value={stats.trips?.ongoing} />
          <StatCard title="Trips (Completed)" value={stats.trips?.completed} />
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 16,
        background: "#fafafa",
      }}
    >
      <div style={{ fontSize: 14, color: "#666" }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: "bold" }}>{value ?? "-"}</div>
    </div>
  );
}
