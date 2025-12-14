// src/App.jsx
import { Route, Routes, Navigate, Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import PassengerDashboard from "./pages/PassengerDashboard";
import DriverDashboard from "./pages/DriverDashboard";
import AvailableRequests from "./pages/AvailableRequests";
import MyTrips from "./pages/MyTrips";


import AdminUserManagement from "./pages/AdminUserManagement";
import AdminPendingDrivers from "./pages/AdminPendingDrivers";
import AdminPendingVehicles from "./pages/AdminPendingVehicles";
import AdminGlobalRequests from "./pages/AdminGlobalRequests";
import AdminGlobalTrips from "./pages/AdminGlobalTrips";

import HomePage from "./pages/Home";
import PassengerTrips from "./pages/PassengerTrips"; // ✅ yeni trip history sayfası

// Küçük helper: tarih formatlayıcı (admin & coordinator sayfalarında kullanacağız)
export function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString();
}

// Ortak küçük component: Admin / Coordinator sekme menüsü
export function AdminTabs() {
  return (
    <div style={{ marginBottom: 16 }}>
      <Link to="/admin/users" style={{ marginRight: 8 }}>
        Users
      </Link>
      <Link to="/admin/pending-drivers" style={{ marginRight: 8 }}>
        Pending Drivers
      </Link>
      <Link to="/admin/pending-vehicles" style={{ marginRight: 8 }}>
        Pending Vehicles
      </Link>
      <Link to="/admin/requests" style={{ marginRight: 8 }}>
        Global Requests
      </Link>
      <Link to="/admin/trips">Global Trips</Link>
    </div>
  );
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p>Loading...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <p>Access denied for role: {user.role}</p>;
  }

  return children;
}

export default function App() {
  const { user, logout } = useAuth();

  return (
    <div>
      {/* ÜST MENÜ */}
      <nav style={{ padding: 8, borderBottom: "1px solid #ddd" }}>
        <Link to="/" style={{ marginRight: 12 }}>
          Home
        </Link>

        {user ? (
          <>
            <span style={{ marginRight: 16 }}>
              Logged in as: <strong>{user.name}</strong> ({user.role})
            </span>

            {/* Passenger linkleri */}
            {user.role === "PASSENGER" && (
              <>
                <Link to="/passenger" style={{ marginRight: 12 }}>
                  Passenger Dashboard
                </Link>
                <Link to="/passenger/trips" style={{ marginRight: 12 }}>
                  Trip History
                </Link>
              </>
            )}

            {/* Driver linkleri */}
            {user.role === "DRIVER" && (
              <Link to="/driver" style={{ marginRight: 12 }}>
                Driver Dashboard
              </Link>
            )}

            {/* Admin linkleri */}
            {user.role === "ADMIN" && (
              <>
                <Link to="/admin/users" style={{ marginRight: 12 }}>
                  Admin – Users
                </Link>
                <Link to="/admin/requests" style={{ marginRight: 12 }}>
                  Admin – Requests
                </Link>
                <Link to="/admin/trips" style={{ marginRight: 12 }}>
                  Admin – Trips
                </Link>
              </>
            )}

            {/* COORDINATOR linkleri (admin ile aynı operasyon ekranlarına gider) */}
            {user.role === "COORDINATOR" && (
              <>
                <Link to="/admin/pending-drivers" style={{ marginRight: 12 }}>
                  Coordinator – Drivers
                </Link>
                <Link to="/admin/pending-vehicles" style={{ marginRight: 12 }}>
                  Coordinator – Vehicles
                </Link>
                <Link to="/admin/requests" style={{ marginRight: 12 }}>
                  Coordinator – Requests
                </Link>
                <Link to="/admin/trips" style={{ marginRight: 12 }}>
                  Coordinator – Trips
                </Link>
              </>
            )}

            <button
              onClick={logout}
              style={{ marginLeft: 16, padding: "4px 8px" }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={{ marginRight: 8 }}>
              Login
            </Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </nav>

      {/* ROUTES */}
      <Routes>
        {/* / artık HomePage → giriş yapmışsa role göre redirect, değilse login */}
        <Route path="/" element={<HomePage />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* PASSENGER DASHBOARD */}
        <Route
          path="/passenger"
          element={
            <ProtectedRoute allowedRoles={["PASSENGER"]}>
              <PassengerDashboard />
            </ProtectedRoute>
          }
        />

        {/* DRIVER DASHBOARD -> ANA SAYFA */}
        <Route
          path="/driver"
          element={
            <ProtectedRoute allowedRoles={["DRIVER"]}>
              <DriverDashboard />
            </ProtectedRoute>
          }
        />

        {/* DRIVER -> AVAILABLE REQUESTS */}
        <Route
          path="/driver/requests"
          element={
            <ProtectedRoute allowedRoles={["DRIVER"]}>
              <AvailableRequests />
            </ProtectedRoute>
          }
        />

        {/* DRIVER -> MY TRIPS */}
        <Route
          path="/driver/my-trips"
          element={
            <ProtectedRoute allowedRoles={["DRIVER"]}>
              <MyTrips />
            </ProtectedRoute>
          }
        />
      </Routes>


    </div>
  );
}