import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

export default function AdminConsistency() {
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchConsistency() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/consistency");
      setChecks(res.data?.checks || res.data || []);
    } catch (err) {
      console.error("Consistency error:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load consistency checks"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchConsistency();
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h1>Admin Panel – Consistency Checks</h1>

      <div style={{ marginBottom: 10 }}>
        <Link to="/admin/users">← Back to Admin</Link>
        <button onClick={fetchConsistency} style={{ marginLeft: 10 }}>
          Refresh
        </button>
      </div>

      {loading && <p>Running checks…</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && checks.length === 0 && (
        <p>No consistency issues found.</p>
      )}

      {!loading && checks.length > 0 && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Rule
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Description
              </th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                Count
              </th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c, idx) => (
              <tr key={idx}>
                <td style={{ borderBottom: "1px solid #f0f0f0" }}>
                  {c.rule || "-"}
                </td>
                <td style={{ borderBottom: "1px solid #f0f0f0" }}>
                  {c.message || c.description || "-"}
                </td>
                <td style={{ borderBottom: "1px solid #f0f0f0" }}>
                  {c.count ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
