// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);   // { id, name, email, role }
  const [loading, setLoading] = useState(true);

  // Sayfa yenilenince /app açıldığında kullanıcıyı otomatik yükle
  useEffect(() => {
    async function fetchMe() {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get("/auth/me");
        setUser({
          id: res.data._id || res.data.id,
          name: res.data.name,
          email: res.data.email,
          role: res.data.role,
        });
      } catch (err) {
        console.error("Failed to fetch /auth/me", err);
        localStorage.removeItem("token");
      } finally {
        setLoading(false);
      }
    }
    fetchMe();
  }, []);

  // src/context/AuthContext.jsx (sadece ilgili kısım)
  const login = (userData, token) => {
  if (token) {
    localStorage.setItem("token", token);
  }
  setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  const value = { user, loading, login, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
