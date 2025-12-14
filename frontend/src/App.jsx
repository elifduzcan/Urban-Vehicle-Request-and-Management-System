// src/App.jsx
import { Route, Routes, Navigate, Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import PassengerDashboard from "./pages/PassengerDashboard";
import DriverDashboard from "./pages/DriverDashboard";
import AvailableRequests from "./pages/AvailableRequests";
import MyTrips from "./pages/MyTrips";


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
  return (
    <div>
      <nav style={{ padding: 8, borderBottom: "1px solid #ddd" }}>
        <Link to="/login" style={{ marginRight: 8 }}>
          Login
        </Link>
        <Link to="/register" style={{ marginRight: 8 }}>
          Register
        </Link>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
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
