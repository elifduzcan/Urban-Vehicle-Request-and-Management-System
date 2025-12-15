// src/pages/CoordinatorDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function Card({ title, value, to, subtitle }) {
  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        padding: 14,
        minWidth: 220,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
        {value}
      </div>
      {subtitle ? (
        <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
          {subtitle}
        </div>
      ) : null}
      {to ? (
        <Link to={to} style={{ fontSize: 13 }}>
          View details →
        </Link>
      ) : null}
    </div>
  );
}

function Section({ title, items, emptyText, renderRow, footerLink }) {
  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        padding: 14,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h4 style={{ margin: 0 }}>{title}</h4>
        {footerLink ? (
          <Link to={footerLink.to} style={{ fontSize: 13 }}>
            {footerLink.label} →
          </Link>
        ) : null}
      </div>

      <div style={{ marginTop: 10 }}>
        {items && items.length ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {items.map((it) => (
              <li
                key={it?._id || JSON.stringify(it)}
                style={{ marginBottom: 10 }}
              >
                {renderRow(it)}
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ color: "#666" }}>{emptyText}</div>
        )}
      </div>
    </div>
  );
}

export default function CoordinatorDashboard() {
  const [data, setData] = useState({
    pendingDrivers: [],
    pendingVehicles: [],
    pendingRequests: [],
    ongoingTrips: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchOverview() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/coordinator/overview");
      setData({
        pendingDrivers: res.data?.pendingDrivers || [],
        pendingVehicles: res.data?.pendingVehicles || [],
        pendingRequests: res.data?.pendingRequests || [],
        ongoingTrips: res.data?.ongoingTrips || [],
      });
    } catch (err) {
      console.error("Coordinator overview load error:", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load coordinator overview";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOverview();
  }, []);

  const counts = useMemo(
    () => ({
      pendingDrivers: data.pendingDrivers.length,
      pendingVehicles: data.pendingVehicles.length,
      pendingRequests: data.pendingRequests.length,
      ongoingTrips: data.ongoingTrips.length,
    }),
    [data]
  );

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Coordinator Dashboard</h2>
        <button onClick={fetchOverview} disabled={loading}>
          Refresh
        </button>
      </div>

      <p style={{ marginTop: 8, color: "#555" }}>
        This screen summarizes operational workload (pending approvals, pending
        requests, and ongoing trips). Use the shortcuts below to manage items.
      </p>

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

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
        <Card
          title="Pending Driver Approvals"
          value={counts.pendingDrivers}
          to="/admin/pending-drivers"
          subtitle="Drivers waiting for verification"
        />
        <Card
          title="Pending Vehicle Approvals"
          value={counts.pendingVehicles}
          to="/admin/pending-vehicles"
          subtitle="Vehicles waiting for verification"
        />
        <Card
          title="Pending Requests"
          value={counts.pendingRequests}
          to="/coordinator/requests"
          subtitle="Requests needing assignment / status follow-up"
        />
        <Card
          title="Ongoing Trips"
          value={counts.ongoingTrips}
          to="/admin/trips"
          subtitle="Active trips currently in progress"
        />
      </div>

      <div style={{ marginTop: 22 }}>
        <h3 style={{ marginBottom: 8 }}>Recent items</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
          <Section
            title="Pending Drivers (top 5)"
            items={data.pendingDrivers.slice(0, 5)}
            emptyText="No pending drivers."
            renderRow={(d) => (
              <>
                <b>{d?.user?.name || d?.user?.email || d?._id}</b>
                <div style={{ fontSize: 12, color: "#666" }}>
                  Submitted: {formatDate(d?.createdAt)}{" "}
                  {d?.licenseNumber ? `• License: ${d.licenseNumber}` : ""}
                </div>
              </>
            )}
            footerLink={{ to: "/admin/pending-drivers", label: "Open drivers" }}
          />

          <Section
            title="Pending Vehicles (top 5)"
            items={data.pendingVehicles.slice(0, 5)}
            emptyText="No pending vehicles."
            renderRow={(v) => (
              <>
                <b>{v?.plateNumber || v?._id}</b>
                <div style={{ fontSize: 12, color: "#666" }}>
                  Owner: {v?.driver?.user?.name || v?.driver?.user?.email || "-"}
                  {" • "}
                  Submitted: {formatDate(v?.createdAt)}
                </div>
              </>
            )}
            footerLink={{ to: "/admin/pending-vehicles", label: "Open vehicles" }}
          />

          <Section
            title="Pending Requests (top 5)"
            items={data.pendingRequests.slice(0, 5)}
            emptyText="No pending requests."
            renderRow={(r) => (
              <>
                <b>{r?.title || r?._id}</b>
                <div style={{ fontSize: 12, color: "#666" }}>
                  Passenger: {r?.passenger?.name || r?.passenger?.email || "-"}
                  {" • "}
                  Created: {formatDate(r?.createdAt)}
                  {" • "}
                  Status: {r?.status || "-"}
                </div>
              </>
            )}
            footerLink={{ to: "/admin/requests", label: "Open requests" }}
          />

          <Section
            title="Ongoing Trips (top 5)"
            items={data.ongoingTrips.slice(0, 5)}
            emptyText="No ongoing trips."
            renderRow={(t) => (
              <>
                <b>{t?._id}</b>
                <div style={{ fontSize: 12, color: "#666" }}>
                  Driver: {t?.driver?.user?.name || t?.driver?.user?.email || "-"}
                  {" • "}
                  Passenger: {t?.passenger?.name || t?.passenger?.email || "-"}
                  {" • "}
                  Started: {formatDate(t?.createdAt)}
                </div>
              </>
            )}
            footerLink={{ to: "/admin/trips", label: "Open trips" }}
          />
        </div>
      </div>
    </div>
  );
}
