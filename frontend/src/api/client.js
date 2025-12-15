// src/api/client.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5001/api", // backend URL
});

// Her request'e otomatik Authorization ekleyelim
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
