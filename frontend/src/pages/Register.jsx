// src/pages/Register.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "PASSENGER", // default rol
  });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Login'deki ile aynı: rol bazlı yönlendirme
  const redirectByRole = (role) => {
    switch (role) {
      case "DRIVER":
        navigate("/driver");
        break;
      case "ADMIN":
        // Register'dan ADMIN seçilemiyor ama
        // admin panelinden atanan kullanıcılar için bırakıyoruz.
        navigate("/admin/users");
        break;
      case "COORDINATOR":
        // Coordinator da admin panelinden atanıyor.
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
      // Backend: POST /api/auth/register
      const res = await api.post("/auth/register", form);

      // Beklenen cevap: { token, user: { ... } }
      const { token, user } = res.data || {};

      if (!token || !user) {
        setError("Unexpected response from server.");
        return;
      }

      // Kayıt olur olmaz direkt login etmiş gibi sisteme al
      login(user, token);

      // Rol'e göre yönlendir
      redirectByRole(user.role);
    } catch (err) {
      console.error("Register error:", err);
      const message =
        err?.response?.data?.message ||
        "Registration failed. Please try again.";
      setError(message);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "40px auto" }}>
      <h1>Register</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 8 }}>
          <label>
            Name:
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              style={{ width: "100%", padding: "4px 8px", marginTop: 4 }}
            />
          </label>
        </div>

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

        <div style={{ marginBottom: 8 }}>
          <label>
            Role:
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            >
              <option value="PASSENGER">Passenger</option>
              <option value="DRIVER">Driver</option>
              {/* ADMIN ve COORDINATOR rolleri,
                  sadece mevcut bir admin tarafından
                  admin panelinden atanır. */}
            </select>
          </label>
        </div>

        {error && (
          <p style={{ color: "red", marginBottom: 8 }}>
            {error}
          </p>
        )}

        <button type="submit" style={{ padding: "8px 16px" }}>
          Register
        </button>
      </form>
    </div>
  );
}