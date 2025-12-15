import { useEffect, useMemo, useState } from "react";
import api from "../api/client";

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          border: "1px solid #e5e5e5",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
          }}
        >
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose}>Close</button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

export default function CoordinatorRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // modal state
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // resources
  const [drivers, setDrivers] = useState([]);
  const [vehiclesByDriver, setVehiclesByDriver] = useState({});
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState("");

  // selection
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState("");

  async function fetchPendingRequests() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/requests", { params: { status: "PENDING" } });
      setRequests(res.data?.requests || []);
    } catch (err) {
      console.error("Pending requests error:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load pending requests"
      );
    } finally {
      setLoading(false);
    }
  }

  async function fetchResources() {
    setResourceLoading(true);
    setResourceError("");
    try {
      const res = await api.get("/coordinator/resources");
      setDrivers(res.data?.drivers || []);
      setVehiclesByDriver(res.data?.vehiclesByDriver || {});
    } catch (err) {
      console.error("Resources error:", err);
      setResourceError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load drivers/vehicles"
      );
    } finally {
      setResourceLoading(false);
    }
  }

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const vehiclesForSelectedDriver = useMemo(() => {
    if (!driverId) return [];
    return vehiclesByDriver[String(driverId)] || [];
  }, [driverId, vehiclesByDriver]);

  function openAssign(r) {
    setSelectedRequest(r);
    setAssignMsg("");
    setDriverId("");
    setVehicleId("");
    setAssignOpen(true);
    // her açılışta güncel kaynak çek (en güvenlisi)
    fetchResources();
  }

  async function submitAssign() {
    if (!selectedRequest?._id) return;

    // ✅ Confirm (Phase 2 UX / güvenlik)
    if (!driverId || !vehicleId) {
      setAssignMsg("Please select both a driver and a vehicle.");
      return;
    }

    const ok = window.confirm(
      "Confirm assignment? This will create/start a trip for this request."
    );
    if (!ok) return;

    setAssigning(true);
    setAssignMsg("");

    try {
      const res = await api.post("/coordinator/assign", {
        requestId: selectedRequest._id,
        driverId,
        vehicleId,
      });

      const tripId = res.data?.trip?._id;
      setAssignMsg(
        tripId ? `Assigned successfully. Trip: ${tripId}` : "Assigned successfully."
      );

      // listeleri yenile
      await fetchPendingRequests();
      await fetchResources();
    } catch (err) {
      console.error("Assign error:", err);
      setAssignMsg(
        err?.response?.data?.message || err?.message || "Assignment failed"
      );
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Coordinator – Pending Requests</h2>
          <p style={{ marginTop: 8, color: "#555" }}>
            Assign an approved driver and an available verified vehicle to create a trip.
          </p>
        </div>
        <button onClick={fetchPendingRequests} disabled={loading}>
          Refresh
        </button>
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

      {loading ? (
        <p>Loading…</p>
      ) : requests.length === 0 ? (
        <p>No pending requests.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
            marginTop: 12,
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
                Created At
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r._id}>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>
                  {r.passenger?.name || r.passenger?.email || r.passenger || "-"}
                </td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>
                  {r.pickupAddress}
                </td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>
                  {r.dropoffAddress}
                </td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>
                  {formatDate(r.createdAt)}
                </td>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>
                  <button onClick={() => openAssign(r)}>Assign</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        open={assignOpen}
        title={selectedRequest ? `Assign Request: ${selectedRequest._id}` : "Assign Request"}
        onClose={() => setAssignOpen(false)}
      >
        {selectedRequest ? (
          <div style={{ fontSize: 13, color: "#333" }}>
            <div style={{ marginBottom: 10 }}>
              <b>Pickup:</b> {selectedRequest.pickupAddress}
              <br />
              <b>Dropoff:</b> {selectedRequest.dropoffAddress}
              <br />
              <b>Passenger:</b>{" "}
              {selectedRequest.passenger?.name ||
                selectedRequest.passenger?.email ||
                "-"}
            </div>

            {resourceError ? (
              <div
                style={{
                  marginBottom: 10,
                  padding: 10,
                  border: "1px solid #f3c7c7",
                  background: "#fff5f5",
                  borderRadius: 8,
                  color: "#8a1f1f",
                }}
              >
                {resourceError}
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 10 }}>
              <label>
                <div style={{ marginBottom: 6 }}>Driver</div>
                <select
                  value={driverId}
                  onChange={(e) => {
                    setDriverId(e.target.value);
                    setVehicleId("");
                    setAssignMsg("");
                  }}
                  disabled={resourceLoading}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="">Select driver…</option>
                  {drivers.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.user?.name || d.user?.email || d._id}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <div style={{ marginBottom: 6 }}>Vehicle</div>
                <select
                  value={vehicleId}
                  onChange={(e) => {
                    setVehicleId(e.target.value);
                    setAssignMsg("");
                  }}
                  disabled={!driverId || resourceLoading}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="">
                    {driverId ? "Select vehicle…" : "Select driver first…"}
                  </option>
                  {vehiclesForSelectedDriver.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.plateNumber || v._id}
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={submitAssign}
                  disabled={!driverId || !vehicleId || assigning}
                >
                  {assigning ? "Assigning…" : "Confirm Assignment"}
                </button>
                <button onClick={fetchResources} disabled={resourceLoading}>
                  Reload resources
                </button>
              </div>

              {assignMsg ? (
                <div style={{ marginTop: 6, color: "#333" }}>{assignMsg}</div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}