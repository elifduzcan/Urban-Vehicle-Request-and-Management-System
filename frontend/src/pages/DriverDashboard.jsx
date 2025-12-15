// frontend/src/pages/DriverDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function DriverDashboard() {
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Driver profile
  const [driverProfile, setDriverProfile] = useState(null);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseClass, setLicenseClass] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // Vehicles
  const [vehicles, setVehicles] = useState([]);
  const [plateNumber, setPlateNumber] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [vehicleSubmitting, setVehicleSubmitting] = useState(false);

  const fetchDriverProfile = async () => {
    try {
      // /drivers/me -> profil yoksa backend 404 döndürebilir
      const res = await api.get("/drivers/me");
      setDriverProfile(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setDriverProfile(null);
      } else {
        throw err;
      }
    }
  };

  const fetchVehicles = async () => {
    try {
      const res = await api.get("/vehicles/my");
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : raw?.vehicles || [];
      setVehicles(list);
    } catch (err) {
      console.error("fetchVehicles error:", err);
      // bunu kritik hata yapmayalım; sadece uyarı basalım
    }
  };

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError("");
      setSuccessMsg("");
      try {
        await Promise.all([fetchDriverProfile(), fetchVehicles()]);
      } catch (err) {
        console.error("DriverDashboard init error:", err);
        setError(err.response?.data?.message || "Failed to load driver data.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const verifiedAndActiveVehicleCount = useMemo(() => {
    return vehicles.filter((v) => v.isVerified && v.isActive).length;
  }, [vehicles]);

  const handleCreateProfile = async (e) => {
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
      await api.post("/drivers/profile", { licenseNumber: ln, licenseClass: lc });
      await fetchDriverProfile();
      setSuccessMsg("Driver profile created. Waiting for coordinator approval.");
      setLicenseNumber("");
      setLicenseClass("");
    } catch (err) {
      console.error("create profile error:", err);
      setError(err.response?.data?.message || "Failed to create driver profile.");
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handleAddVehicle = async (e) => {
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
      await fetchVehicles();
      setSuccessMsg("Vehicle added. Waiting for coordinator verification.");
      setPlateNumber("");
      setBrand("");
      setModel("");
    } catch (err) {
      console.error("add vehicle error:", err);
      setError(err.response?.data?.message || "Failed to add vehicle.");
    } finally {
      setVehicleSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <p>Loading driver dashboard...</p>
      </div>
    );
  }

  const canDrive = Boolean(driverProfile?.isApproved) && verifiedAndActiveVehicleCount > 0;

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>Driver Dashboard</h2>
          <p style={{ marginTop: 6 }}>
            Welcome, <strong>{user?.name}</strong> ({user?.email})
          </p>
        </div>
        <button onClick={logout}>Logout</button>
      </header>

      {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}
      {successMsg && <p style={{ color: "green", marginTop: 10 }}>{successMsg}</p>}

      {/* (2) Driver profile create UI */}
      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14, marginTop: 16 }}>
        <h3>Driver Profile</h3>

        {driverProfile ? (
          <div style={{ fontSize: 14 }}>
            <p>
              License: <strong>{driverProfile.licenseNumber}</strong> — Class:{" "}
              <strong>{driverProfile.licenseClass}</strong>
            </p>
            <p>
              Status:{" "}
              <strong>{driverProfile.isApproved ? "Approved" : "Pending coordinator approval"}</strong>
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 14, color: "#a15c00" }}>
              You don&apos;t have a driver profile yet. Create it to be eligible for approval.
            </p>

            <form onSubmit={handleCreateProfile} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="licenseNumber"
                style={{ padding: 8, minWidth: 220 }}
              />
              <input
                value={licenseClass}
                onChange={(e) => setLicenseClass(e.target.value)}
                placeholder="licenseClass (e.g., B)"
                style={{ padding: 8, minWidth: 180 }}
              />
              <button type="submit" disabled={profileSubmitting}>
                {profileSubmitting ? "Creating..." : "Create Profile"}
              </button>
            </form>
          </>
        )}
      </section>

      {/* (3) Add Vehicle UI */}
      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14, marginTop: 16 }}>
        <h3>My Vehicles</h3>

        <form onSubmit={handleAddVehicle} style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <input
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value)}
            placeholder="plateNumber"
            style={{ padding: 8, minWidth: 180 }}
          />
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="brand"
            style={{ padding: 8, minWidth: 160 }}
          />
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="model"
            style={{ padding: 8, minWidth: 160 }}
          />
          <button type="submit" disabled={vehicleSubmitting}>
            {vehicleSubmitting ? "Adding..." : "Add Vehicle"}
          </button>
        </form>

        {vehicles.length === 0 ? (
          <p style={{ fontSize: 14 }}>No vehicles yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", paddingBottom: 6 }}>Plate</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", paddingBottom: 6 }}>Brand/Model</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", paddingBottom: 6 }}>Verified</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", paddingBottom: 6 }}>Active</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v._id}>
                  <td style={{ padding: "6px 0" }}>{(v.plateNumber || "").toUpperCase()}</td>
                  <td style={{ padding: "6px 0" }}>
                    {v.brand} {v.model}
                  </td>
                  <td style={{ padding: "6px 0" }}>{v.isVerified ? "Yes" : "No (pending)"}</td>
                  <td style={{ padding: "6px 0" }}>{v.isActive ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p style={{ fontSize: 13, marginTop: 10, color: canDrive ? "green" : "#a15c00" }}>
          {canDrive
            ? "You are ready to accept requests."
            : "To accept requests: your profile must be approved AND you must have at least 1 verified & active vehicle."}
        </p>
      </section>

      {/* Links to existing pages */}
      <section style={{ marginTop: 18 }}>
        <h3>Actions</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link to="/driver/requests">
            <button>Available Requests</button>
          </Link>
          <Link to="/driver/my-trips">
            <button>My Trips</button>
          </Link>
        </div>
      </section>
    </div>
  );
}