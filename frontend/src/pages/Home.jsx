// src/pages/Home.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const { user, loading } = useAuth();

  // Token kontrolü vs. devam ederken
  if (loading) {
    return <div>Loading...</div>;
  }

  // Giriş yapmamışsa -> login sayfasına
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Giriş yapmışsa rolüne göre dashboard'a
  switch (user.role) {
    case "DRIVER":
      return <Navigate to="/driver" replace />;
    case "ADMIN":
      return <Navigate to="/admin/users" replace />;
    case "COORDINATOR":
      return <Navigate to="/admin/requests" replace />;
    case "PASSENGER":
    default:
      return <Navigate to="/passenger" replace />;
  }
}
