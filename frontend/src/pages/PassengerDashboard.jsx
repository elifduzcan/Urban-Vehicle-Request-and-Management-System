// src/pages/PassengerDashboard.jsx
import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function PassengerDashboard() {
  const { user } = useAuth();

  const [form, setForm] = useState({
    pickupAddress: "",
    dropoffAddress: "",
  });

  const [requests, setRequests] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Tarih formatlayıcı
  const formatDate = (iso) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleString();
  };

  useEffect(() => {
    fetchMyRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kendi request’lerini çek
  async function fetchMyRequests() {
    setLoadingList(true);
    setError("");

    try {
      const res = await api.get("/requests/my");
      const data = res.data;

      let list = [];
      // Backend direkt array döndürebilir veya { requests: [...] } şeklinde olabilir
      if (Array.isArray(data)) {
        list = data;
      } else if (Array.isArray(data?.requests)) {
        list = data.requests;
      }

      setRequests(list);
    } catch (err) {
      console.error("Error fetching my requests", err);
      setError(
        err.response?.data?.message ||
          "Failed to load your requests. Please try again."
      );
    } finally {
      setLoadingList(false);
    }
  }

  // Form değişim
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Yeni request oluştur
  const handleCreateRequest = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setCreating(true);

    try {
      await api.post("/requests", {
        pickupAddress: form.pickupAddress,
        dropoffAddress: form.dropoffAddress,
      });

      setSuccessMsg("Request created successfully.");
      setForm({ pickupAddress: "", dropoffAddress: "" });

      // Listeyi yenile
      await fetchMyRequests();
    } catch (err) {
      console.error("Error creating request", err);
      setError(
        err.response?.data?.message ||
          "Failed to create request. Please try again."
      );
    } finally {
      setCreating(false);
    }
  };

  // Request iptal et (sadece PENDING iken)
  async function handleCancelRequest(requestId) {
    setError("");
    setSuccessMsg("");

    try {
      await api.patch(`/requests/${requestId}/cancel`);
      setSuccessMsg("Request cancelled successfully.");
      await fetchMyRequests();
    } catch (err) {
      console.error("Error cancelling request", err);
      setError(
        err?.response?.data?.message ||
          "Failed to cancel request. Please try again."
      );
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h2>Passenger Dashboard</h2>
      <p>
        Welcome, <strong>{user?.name}</strong> ({user?.email})
      </p>

      {/* Request oluşturma bölümü */}
      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 4,
          padding: 16,
          marginTop: 16,
          marginBottom: 24,
        }}
      >
        <h3>Create New Ride Request</h3>
        <form onSubmit={handleCreateRequest}>
          <div style={{ marginBottom: 12 }}>
            <label>Pickup Address</label>
            <input
              type="text"
              name="pickupAddress"
              value={form.pickupAddress}
              onChange={handleChange}
              required
              style={{ width: "100%", padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Dropoff Address</label>
            <input
              type="text"
              name="dropoffAddress"
              value={form.dropoffAddress}
              onChange={handleChange}
              required
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          {error && (
            <p style={{ color: "red", marginBottom: 8 }}>{error}</p>
          )}
          {successMsg && (
            <p style={{ color: "green", marginBottom: 8 }}>{successMsg}</p>
          )}

          <button type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create Request"}
          </button>
        </form>
      </section>

      {/* Request listesi */}
      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 4,
          padding: 16,
        }}
      >
        <h3>My Requests</h3>

        {loadingList ? (
          <p>Loading your requests...</p>
        ) : requests.length === 0 ? (
          <p>You have no requests yet.</p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: 8,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    borderBottom: "1px solid #ccc",
                    textAlign: "left",
                    paddingBottom: 4,
                  }}
                >
                  Pickup
                </th>
                <th
                  style={{
                    borderBottom: "1px solid #ccc",
                    textAlign: "left",
                    paddingBottom: 4,
                  }}
                >
                  Dropoff
                </th>
                <th
                  style={{
                    borderBottom: "1px solid #ccc",
                    textAlign: "left",
                    paddingBottom: 4,
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    borderBottom: "1px solid #ccc",
                    textAlign: "left",
                    paddingBottom: 4,
                  }}
                >
                  Created At
                </th>
                <th
                  style={{
                    borderBottom: "1px solid #ccc",
                    textAlign: "left",
                    paddingBottom: 4,
                  }}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req._id}>
                  <td
                    style={{
                      borderBottom: "1px solid #eee",
                      padding: "4px 0",
                    }}
                  >
                    {req.pickupAddress}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #eee",
                      padding: "4px 0",
                    }}
                  >
                    {req.dropoffAddress}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #eee",
                      padding: "4px 0",
                      textTransform: "capitalize",
                    }}
                  >
                    {req.status}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #eee",
                      padding: "4px 0",
                    }}
                  >
                    {formatDate(req.createdAt)}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid #eee",
                      padding: "4px 0",
                    }}
                  >
                    {req.status === "PENDING" ? (
                      <button
                        onClick={() => handleCancelRequest(req._id)}
                        disabled={loadingList}
                      >
                        Cancel
                      </button>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}