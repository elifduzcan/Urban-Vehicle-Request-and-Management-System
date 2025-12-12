// src/App.jsx
import { Route, Routes, Navigate, Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import PassengerDashboard from "./pages/PassengerDashboard";
import DriverDashboard from "./pages/DriverDashboard";

import AdminUserManagement from "./pages/AdminUserManagement";
import AdminPendingDrivers from "./pages/AdminPendingDrivers";
import AdminPendingVehicles from "./pages/AdminPendingVehicles";
import AdminGlobalRequests from "./pages/AdminGlobalRequests";
import AdminGlobalTrips from "./pages/AdminGlobalTrips";

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
              <Link to="/passenger" style={{ marginRight: 12 }}>
                Passenger Dashboard
              </Link>
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
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Passenger */}
        <Route
          path="/passenger"
          element={
            <ProtectedRoute allowedRoles={["PASSENGER"]}>
              <PassengerDashboard />
            </ProtectedRoute>
          }
        />

        {/* Driver */}
        <Route
          path="/driver"
          element={
            <ProtectedRoute allowedRoles={["DRIVER"]}>
              <DriverDashboard />
            </ProtectedRoute>
          }
        />

        {/* ADMIN PANELİ – sadece ADMIN user listesine girebilir */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminUserManagement />
            </ProtectedRoute>
          }
        />

        {/* Pending Drivers – ADMIN + COORDINATOR */}
        <Route
          path="/admin/pending-drivers"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "COORDINATOR"]}>
              <AdminPendingDrivers />
            </ProtectedRoute>
          }
        />

        {/* Pending Vehicles – ADMIN + COORDINATOR */}
        <Route
          path="/admin/pending-vehicles"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "COORDINATOR"]}>
              <AdminPendingVehicles />
            </ProtectedRoute>
          }
        />

        {/* Global Requests – ADMIN + COORDINATOR */}
        <Route
          path="/admin/requests"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "COORDINATOR"]}>
              <AdminGlobalRequests />
            </ProtectedRoute>
          }
        />

        {/* Global Trips – ADMIN + COORDINATOR */}
        <Route
          path="/admin/trips"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "COORDINATOR"]}>
              <AdminGlobalTrips />
            </ProtectedRoute>
          }
        />

        {/* Bilinmeyen route → 404 */}
        <Route path="*" element={<p>Page not found.</p>} />
      </Routes>
    </div>
  );
}