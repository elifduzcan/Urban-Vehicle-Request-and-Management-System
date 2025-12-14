// src/pages/DriverDashboard.jsx
import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function DriverDashboard() {
  const { user, logout } = useAuth();

  const [driverProfile, setDriverProfile] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [availableRequests, setAvailableRequests] = useState([]);
  const [trips, setTrips] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Tarih formatlayıcı
  const formatDate = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleString();
  };

  // Sayfa açıldığında her şeyi yükle
  useEffect(() => {
    async function init() {
      setLoading(true);
      setError("");
      try {
        // 1) Driver profili
        const driverRes = await api.get("/drivers/me");
        setDriverProfile(driverRes.data);

        // 2) Kendi araçları
        const vehiclesRes = await api.get("/vehicles/my");
        const raw = vehiclesRes.data;
        const list = Array.isArray(raw) ? raw : raw?.vehicles || [];
        setVehicles(list);

        // Varsayılan olarak ilk doğrulanmış aracı seç
        const verified = list.filter((v) => v.isVerified);
        if (verified.length > 0) {
          setSelectedVehicleId(verified[0]._id);
        }

        // 3) Uygun (PENDING) talepler
        await fetchAvailableRequests();

        // 4) Kendi trip’leri
        await fetchMyTrips();
      } catch (err) {
        console.error("Error initializing driver dashboard", err);
        setError(
          err.response?.data?.message ||
            "Failed to load driver data. Please try again."
        );
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  async function fetchAvailableRequests() {
    try {
      const res = await api.get("/requests/available");
      const data = res.data;
      const list = Array.isArray(data) ? data : data?.requests || [];
      setAvailableRequests(list);
    } catch (err) {
      console.error("Error fetching available requests", err);
    }
  }

  async function fetchMyTrips() {
    try {
      const res = await api.get("/trips/my");
      const data = res.data;
      const list = Array.isArray(data) ? data : data?.trips || [];
      setTrips(list);
    } catch (err) {
      console.error("Error fetching my trips", err);
    }
  }

  const handleVehicleChange = (e) => {
    setSelectedVehicleId(e.target.value);
  };

  // PENDING request kabul → trip oluştur (status = ON_GOING)
  async function handleAcceptRequest(requestId) {
    if (!selectedVehicleId) {
      setError("You must select a verified vehicle before accepting a request.");
      return;
    }

    setError("");
    setSuccessMsg("");
    setActionLoading(true);

    try {
      // Backend şu an vehicleId’i kullanmıyor ama ileride kullanabilir diye gönderebiliriz.
      await api.post("/trips", {
        requestId,
        vehicleId: selectedVehicleId,
      });

      setSuccessMsg("Request accepted. Trip created and started (ON_GOING).");
      await Promise.all([fetchAvailableRequests(), fetchMyTrips()]);
    } catch (err) {
      console.error("Error accepting request", err);
      setError(
        err.response?.data?.message ||
          "Failed to accept request. Please try again."
      );
    } finally {
      setActionLoading(false);
    }
  }

  // ON_GOING trip → COMPLETED
  async function handleCompleteTrip(tripId) {
    setError("");
    setSuccessMsg("");
    setActionLoading(true);

    try {
      await api.patch(`/trips/${tripId}/complete`);
      setSuccessMsg("Trip completed.");
      await fetchMyTrips();
    } catch (err) {
      console.error("Error completing trip", err);
      setError(
        err.response?.data?.message ||
          "Failed to complete trip. Please try again."
      );
    } finally {
      setActionLoading(false);
    }
  }

  // ON_GOING trip → CANCELLED
  async function handleCancelTrip(tripId) {
    setError("");
    setSuccessMsg("");
    setActionLoading(true);

    try {
      await api.patch(`/trips/${tripId}/cancel`);
      setSuccessMsg("Trip cancelled.");
      await fetchMyTrips();
    } catch (err) {
      console.error("Error cancelling trip", err);
      setError(
        err.response?.data?.message ||
          "Failed to cancel trip. Please try again."
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <p>Loading driver dashboard...</p>
      </div>
    );
  }

  const verifiedVehicles = vehicles.filter((v) => v.isVerified);

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h2>Driver Dashboard</h2>
          <p>
            Welcome, <strong>{user?.name}</strong> ({user?.email})
          </p>
          {driverProfile && (
            <p style={{ fontSize: 14 }}>
              License: <strong>{driverProfile.licenseNumber}</strong> – Class:{" "}
              <strong>{driverProfile.licenseClass}</strong> – Status:{" "}
              <strong>
                {driverProfile.isApproved ? "Approved" : "Pending approval"}
              </strong>
            </p>
          )}
        </div>
        <button onClick={logout}>Logout</button>
      </header>

      {error && (
        <p style={{ color: "red", marginBottom: 8 }}>
          {error}
        </p>
      )}
      {successMsg && (
        <p style={{ color: "green", marginBottom: 8 }}>
          {successMsg}
        </p>
      )}

      {/* Vehicle selection */}
      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 4,
          marginBottom: 24,
        }}
      >
        <h3>My Vehicles</h3>
        {vehicles.length === 0 ? (
          <p>
            You have no vehicles yet. Please add a vehicle via the backend or
            coordinator flow.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 14, marginBottom: 8 }}>
              Only verified vehicles can be used to accept requests.
            </p>
            <select
              value={selectedVehicleId}
              onChange={handleVehicleChange}
              style={{ padding: 8, minWidth: 260 }}
            >
              <option value="">Select vehicle</option>
              {verifiedVehicles.map((v) => (
                <option key={v._id} value={v._id}>
                  {(v.plateNumber || v.plate || "").toUpperCase()} – {v.model}
                </option>
              ))}
            </select>
            {verifiedVehicles.length === 0 && (
              <p style={{ color: "orange", marginTop: 8 }}>
                You currently have no verified vehicles. Coordinator approval is
                required before you can drive.
              </p>
            )}
          </>
        )}
      </section>

      {/* Available Requests */}
      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 4,
          marginBottom: 24,
        }}
      >
        <h3>Available Requests</h3>
        {availableRequests.length === 0 ? (
          <p>No pending requests at the moment.</p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: 12,
            }}
          >
            <thead>
              <tr>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                  Passenger
                </th>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                  Pickup
                </th>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                  Dropoff
                </th>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                  Created At
                </th>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                  Status
                </th>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {availableRequests.map((r) => (
                <tr key={r._id}>
                  <td style={{ padding: "6px 4px" }}>
                    {r.passenger?.name || r.passengerName || "-"}
                  </td>
                  <td style={{ padding: "6px 4px" }}>{r.pickupAddress}</td>
                  <td style={{ padding: "6px 4px" }}>{r.dropoffAddress}</td>
                  <td style={{ padding: "6px 4px" }}>
                    {formatDate(r.createdAt)}
                  </td>
                  <td style={{ padding: "6px 4px" }}>{r.status}</td>
                  <td style={{ padding: "6px 4px" }}>
                    <button
                      onClick={() => handleAcceptRequest(r._id)}
                      disabled={actionLoading || !selectedVehicleId}
                    >
                      {actionLoading ? "Processing..." : "Accept"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* My Trips */}
      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 4,
        }}
      >
        <h3>My Trips</h3>
        {trips.length === 0 ? (
          <p>You have no trips yet.</p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: 12,
            }}
          >
            <thead>
              <tr>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                  Passenger
                </th>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                  Pickup
                </th>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                  Dropoff
                </th>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                  Status
                </th>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                  Started At
                </th>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                  Completed At
                </th>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t._id}>
                  <td style={{ padding: "6px 4px" }}>
                    {t.request?.passenger?.name || t.passengerName || "-"}
                  </td>
                  <td style={{ padding: "6px 4px" }}>
                    {t.request?.pickupAddress || t.pickupAddress}
                  </td>
                  <td style={{ padding: "6px 4px" }}>
                    {t.request?.dropoffAddress || t.dropoffAddress}
                  </td>
                  <td style={{ padding: "6px 4px" }}>{t.status}</td>
                  <td style={{ padding: "6px 4px" }}>
                    {formatDate(t.startedAt)}
                  </td>
                  <td style={{ padding: "6px 4px" }}>
                    {formatDate(t.completedAt)}
                  </td>
                  <td style={{ padding: "6px 4px" }}>
                    {t.status === "ON_GOING" ? (
                      <>
                        <button
                          onClick={() => handleCompleteTrip(t._id)}
                          disabled={actionLoading}
                          style={{ marginRight: 8 }}
                        >
                          {actionLoading ? "..." : "Complete"}
                        </button>
                        <button
                          onClick={() => handleCancelTrip(t._id)}
                          disabled={actionLoading}
                        >
                          {actionLoading ? "..." : "Cancel"}
                        </button>
                      </>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}