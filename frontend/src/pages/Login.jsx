// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Rol'e göre yönlendirme yapan yardımcı fonksiyon
  const redirectByRole = (role) => {
    switch (role) {
      case "DRIVER":
        navigate("/driver");
        break;
      case "ADMIN":
        // Admin kullanıcı yönetimi ekranı
        navigate("/admin/users");
        break;
      case "COORDINATOR":
        // Koordinatör global request ekranı
        navigate("/admin/requests");
        break;
      case "PASSENGER":
      default:
        navigate("/passenger");
        break;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      // Backend: POST /api/auth/login
      const res = await api.post("/auth/login", form);

      // Beklenen cevap: { token, user: { ... } }
      const { token, user } = res.data || {};

      if (!token || !user) {
        setError("Unexpected response from server.");
        return;
      }

      // AuthContext'e kullanıcı ve token'ı yaz
      login(user, token);

      // Rol'e göre sayfaya yönlendir
      redirectByRole(user.role);
    } catch (err) {
      console.error("Login error:", err);
      const message =
        err?.response?.data?.message ||
        "Login failed. Please check your credentials.";
      setError(message);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "40px auto" }}>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 8 }}>
          <label>
            Email:
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              style={{ width: "100%", padding: "4px 8px", marginTop: 4 }}
            />
          </label>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label>
            Password:
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              style={{ width: "100%", padding: "4px 8px", marginTop: 4 }}
            />
          </label>
        </div>

        {error && (
          <p style={{ color: "red", marginBottom: 8 }}>
            {error}
          </p>
        )}

        <button type="submit" style={{ padding: "8px 16px" }}>
          Login
        </button>
      </form>
    </div>
  );
}