import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Owner-only: every butchery compared against every other, and every
// bakery against every other, for one date range — revenue, expenses,
// profit — so it's obvious at a glance which branch of each kind is
// pulling ahead or falling behind.
function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

function Group({ title, rows }) {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginBottom: 40 }}>
      <h2>{title}</h2>
      <div style={{ width: "100%", height: 280, marginBottom: 16 }}>
        <ResponsiveContainer>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="branch_name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => `KSh ${Number(v).toLocaleString()}`} />
            <Legend />
            <Bar dataKey="revenue" name="Revenue" fill="#4c8c6b" />
            <Bar dataKey="expenses" name="Expenses" fill="#c97a4a" />
            <Bar dataKey="profit" name="Profit" fill="#3a6ea5" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table>
        <thead><tr><th>Branch</th><th>Revenue</th><th>Expenses</th><th>Profit</th></tr></thead>
        <tbody>
          {[...rows].sort((a, b) => b.profit - a.profit).map((r) => (
            <tr key={r.branch_id}>
              <td>{r.branch_name}</td>
              <td>KSh {r.revenue.toLocaleString()}</td>
              <td>KSh {r.expenses.toLocaleString()}</td>
              <td style={{ color: r.profit >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 500 }}>
                KSh {r.profit.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Variance() {
  const [start, setStart] = useState(firstOfMonth());
  const [end, setEnd] = useState(today());
  const [data, setData] = useState(null);
  const [message, setMessage] = useState(null);

  function load() {
    setMessage(null);
    api.get(`/reports/variance?start=${start}&end=${end}`)
      .then((res) => setData(res.data))
      .catch((err) => setMessage(err.response?.data?.message || "Could not load variance report."));
  }
  useEffect(load, []);

  return (
    <div>
      <h1>Variance</h1>
      <div className="subtitle">Compare every butchery against every other, and every bakery against every other</div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", margin: "20px 0", flexWrap: "wrap" }}>
        <div className="field">
          <label>From</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label>To</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <button className="btn" style={{ width: "auto" }} onClick={load}>Update</button>
      </div>

      {message && <p style={{ color: "var(--danger)", fontSize: 13 }}>{message}</p>}

      {data && (
        <>
          <Group title="Butcheries" rows={data.butcheries} />
          <Group title="Bakeries" rows={data.bakeries} />
        </>
      )}
    </div>
  );
}
