// src/pages/DriverDashboard.jsx
import { Link, Outlet } from "react-router-dom";

function DriverDashboard() {
  return (
    <div style={{ padding: "20px" }}>
      <h2>Driver Dashboard</h2>
      <p>
        Welcome! From this page you can manage your pending requests and your trips.
      </p>

      <div style={{ marginTop: "20px", display: "flex", gap: "16px" }}>
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "16px",
            minWidth: "220px",
          }}
        >
          <h3>Available Requests</h3>
          <p>See all pending requests and accept a new trip.</p>
          <Link to="/driver/requests">Go to Available Requests</Link>
        </div>

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "16px",
            minWidth: "220px",
          }}
        >
          <h3>My Trips</h3>
          <p>View your ongoing and completed trips.</p>
          <Link to="/driver/my-trips">Go to My Trips</Link>
        </div>
      </div>

      {/* 🔴 BU SATIR YOKSA ALT SAYFALAR ASLA GÖZÜKMEZ */}
      <div style={{ marginTop: "30px" }}>
        <Outlet />
      </div>
    </div>
  );
}

export default DriverDashboard;
