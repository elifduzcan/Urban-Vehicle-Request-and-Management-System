// frontend/src/pages/DriverDashboard.jsx
import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function DriverDashboard() {
  const { user, logout } = useAuth();

  const [driverProfile, setDriverProfile] = useState(null);

  // Driver profile creation form (shown when /drivers/me returns 404 / no profile)
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseClass, setLicenseClass] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // Add vehicle form
  const [plateNumber, setPlateNumber] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [vehicleSubmitting, setVehicleSubmitting] = useState(false);

  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  const [availableRequests, setAvailableRequests] = useState([]);
  const [trips, setTrips] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const formatDate = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleString();
  };

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError("");
      setSuccessMsg("");

      try {
        // 1) Driver profile (404 normal -> show form)
        let profile = null;
        try {
          const driverRes = await api.get("/drivers/me");
          profile = driverRes.data;
        } catch (err) {
          if (err.response?.status === 404) {
            profile = null;
          } else {
            throw err;
          }
        }
        setDriverProfile(profile);

        // 2) Vehicles
        const vehiclesRes = await api.get("/vehicles/my");
        const raw = vehiclesRes.data;
        const list = Array.isArray(raw) ? raw : raw?.vehicles || [];
        setVehicles(list);

        // default select first verified
        const verified = list.filter((v) => v.isVerified);
        if (verified.length > 0) setSelectedVehicleId(verified[0]._id);

        // 3) Available requests
        await fetchAvailableRequests();

        // 4) My trips
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

  async function handleCreateProfile(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const ln = licenseNumber.trim();
    const lc = licenseClass.trim();

    if (!ln || !lc) {
      setError("Please fill in both license number and license class.");
      return;
    }

    setProfileSubmitting(true);
    try {
      await api.post("/drivers/profile", {
        licenseNumber: ln,
        licenseClass: lc,
      });

      const driverRes = await api.get("/drivers/me");
      setDriverProfile(driverRes.data);

      setSuccessMsg(
        "Driver profile created successfully. Waiting for coordinator approval."
      );
    } catch (err) {
      console.error("Error creating driver profile", err);
      setError(
        err.response?.data?.message ||
          "Failed to create driver profile. Please try again."
      );
    } finally {
      setProfileSubmitting(false);
    }
  }

  async function handleAddVehicle(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const p = plateNumber.trim();
    const b = brand.trim();
    const m = model.trim();

    if (!p || !b || !m) {
      setError("Please fill plateNumber, brand and model.");
      return;
    }

    setVehicleSubmitting(true);
    try {
      await api.post("/vehicles", { plateNumber: p, brand: b, model: m });

      setSuccessMsg(
        "Vehicle added successfully. Waiting for coordinator verification."
      );

      // refresh vehicles list
      const vehiclesRes = await api.get("/vehicles/my");
      const raw = vehiclesRes.data;
      const list = Array.isArray(raw) ? raw : raw?.vehicles || [];
      setVehicles(list);

      const verified = list.filter((v) => v.isVerified);
      if (!selectedVehicleId && verified.length > 0) {
        setSelectedVehicleId(verified[0]._id);
      }

      setPlateNumber("");
      setBrand("");
      setModel("");
    } catch (err) {
      console.error("Error adding vehicle", err);
      setError(
        err.response?.data?.message || "Failed to add vehicle. Please try again."
      );
    } finally {
      setVehicleSubmitting(false);
    }
  }

  // PENDING request kabul → trip oluştur (status = ON_GOING)
  async function handleAcceptRequest(requestId) {
    // ✅ Phase 2: prevent accidental accept
    if (!window.confirm("Accept this request and start a trip?")) return;

    if (!driverProfile) {
      setError("Driver profile is missing. Please create your profile first.");
      return;
    }

    if (!driverProfile.isApproved) {
      setError(
        "Your driver profile is not approved yet. Please wait for coordinator approval."
      );
      return;
    }

    if (!selectedVehicleId) {
      setError("You must select a verified vehicle before accepting a request.");
      return;
    }

    setError("");
    setSuccessMsg("");
    setActionLoading(true);

    try {
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
    // ✅ Phase 2: prevent accidental complete
    if (!window.confirm("Complete this trip?")) return;

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
    // ✅ Phase 2: prevent accidental cancel
    if (!window.confirm("Cancel this trip?")) return;

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
  const canDrive = Boolean(driverProfile?.isApproved);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
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

          {driverProfile ? (
            <p style={{ fontSize: 14 }}>
              License: <strong>{driverProfile.licenseNumber}</strong> — Class:{" "}
              <strong>{driverProfile.licenseClass}</strong> — Status:{" "}
              <strong>
                {driverProfile.isApproved ? "Approved" : "Pending approval"}
              </strong>
            </p>
          ) : (
            <p style={{ fontSize: 14, color: "#a15c00" }}>
              You don&apos;t have a driver profile yet. Please create it below.
            </p>
          )}
        </div>

        <button onClick={logout}>Logout</button>
      </header>

      {error && <p style={{ color: "red", marginBottom: 8 }}>{error}</p>}
      {successMsg && (
        <p style={{ color: "green", marginBottom: 8 }}>{successMsg}</p>
      )}

      {/* (1) Driver Profile creation */}
      {!driverProfile && (
        <section
          style={{
            border: "1px solid #ddd",
            padding: 16,
            borderRadius: 6,
            marginBottom: 24,
          }}
        >
          <h3>Create Driver Profile</h3>
          <p style={{ fontSize: 14, marginBottom: 12 }}>
            You must create a driver profile to be eligible for approval and to
            accept requests.
          </p>

          <form onSubmit={handleCreateProfile}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <label style={{ fontSize: 13, marginBottom: 4 }}>
                  License Number
                </label>
                <input
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="licenseNumber"
                  style={{ padding: 8, minWidth: 260 }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                <label style={{ fontSize: 13, marginBottom: 4 }}>
                  License Class
                </label>
                <input
                  value={licenseClass}
                  onChange={(e) => setLicenseClass(e.target.value)}
                  placeholder="licenseClass (e.g., B)"
                  style={{ padding: 8, minWidth: 200 }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "end" }}>
                <button type="submit" disabled={profileSubmitting}>
                  {profileSubmitting ? "Creating..." : "Create Profile"}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* (2) Add Vehicle UI */}
      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 6,
          marginBottom: 24,
        }}
      >
        <h3>Add Vehicle</h3>
        <p style={{ fontSize: 14, marginBottom: 12 }}>
          Add your vehicle. Coordinator verification is required before you can
          use it.
        </p>

        <form onSubmit={handleAddVehicle}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <label style={{ fontSize: 13, marginBottom: 4 }}>
                Plate Number
              </label>
              <input
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                placeholder="plateNumber"
                style={{ padding: 8, minWidth: 220 }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <label style={{ fontSize: 13, marginBottom: 4 }}>Brand</label>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="brand"
                style={{ padding: 8, minWidth: 180 }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <label style={{ fontSize: 13, marginBottom: 4 }}>Model</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="model"
                style={{ padding: 8, minWidth: 180 }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "end" }}>
              <button type="submit" disabled={vehicleSubmitting}>
                {vehicleSubmitting ? "Adding..." : "Add Vehicle"}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* (3) Vehicle selection */}
      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 6,
          marginBottom: 24,
        }}
      >
        <h3>My Vehicles</h3>

        {driverProfile && !driverProfile.isApproved && (
          <p style={{ color: "orange", marginTop: 8 }}>
            Your driver profile is pending coordinator approval. You can view
            requests, but you cannot accept them until you are approved.
          </p>
        )}

        {vehicles.length === 0 ? (
          <p>You have no vehicles yet.</p>
        ) : (
          <>
            <p style={{ fontSize: 14, marginBottom: 8 }}>
              Only verified vehicles can be used to accept requests.
            </p>

            <select
              value={selectedVehicleId}
              onChange={handleVehicleChange}
              style={{ padding: 8, minWidth: 320 }}
            >
              <option value="">Select vehicle</option>
              {verifiedVehicles.map((v) => (
                <option key={v._id} value={v._id}>
                  {(v.plateNumber || "").toUpperCase()} — {v.brand} {v.model}
                </option>
              ))}
            </select>

            {verifiedVehicles.length === 0 && (
              <p style={{ color: "orange", marginTop: 8 }}>
                You currently have no verified vehicles. Coordinator verification
                is required before you can drive.
              </p>
            )}

            {/* Vehicles list (optional view) */}
            <div style={{ marginTop: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                      Plate
                    </th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                      Vehicle
                    </th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                      Verified
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr key={v._id}>
                      <td style={{ padding: "6px 0" }}>
                        {(v.plateNumber || "").toUpperCase()}
                      </td>
                      <td style={{ padding: "6px 0" }}>
                        {v.brand} {v.model}
                      </td>
                      <td style={{ padding: "6px 0" }}>
                        {v.isVerified ? "YES" : "NO"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* (4) Available Requests */}
      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 6,
          marginBottom: 24,
        }}
      >
        <h3>Available Requests</h3>

        {availableRequests.length === 0 ? (
          <p>No pending requests at the moment.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
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
                  <td style={{ padding: "6px 4px" }}>{formatDate(r.createdAt)}</td>
                  <td style={{ padding: "6px 4px" }}>{r.status}</td>
                  <td style={{ padding: "6px 4px" }}>
                    <button
                      onClick={() => handleAcceptRequest(r._id)}
                      disabled={
                        actionLoading ||
                        !selectedVehicleId ||
                        !driverProfile ||
                        !canDrive
                      }
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

      {/* (5) My Trips */}
      <section
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 6,
        }}
      >
        <h3>My Trips</h3>

        {trips.length === 0 ? (
          <p>You have no trips yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
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
                    {t.request?.pickupAddress || t.pickupAddress || "-"}
                  </td>
                  <td style={{ padding: "6px 4px" }}>
                    {t.request?.dropoffAddress || t.dropoffAddress || "-"}
                  </td>
                  <td style={{ padding: "6px 4px" }}>{t.status}</td>
                  <td style={{ padding: "6px 4px" }}>{formatDate(t.startedAt)}</td>
                  <td style={{ padding: "6px 4px" }}>{formatDate(t.completedAt)}</td>
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