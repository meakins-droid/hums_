import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

const COLORS = { expenses: "#B13A2F", profit: "#2F6B3C", loss: "#8A3324" };

function dateRangeFor(period) {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  let start;
  if (period === "daily") {
    start = end;
  } else if (period === "weekly") {
    const d = new Date(today);
    const day = d.getDay() === 0 ? 7 : d.getDay(); // Monday-start week
    d.setDate(d.getDate() - (day - 1));
    start = d.toISOString().slice(0, 10);
  } else {
    start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  }
  return { start, end };
}

export default function Reports() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(user.branch_id || "");
  const [period, setPeriod] = useState("daily");
  const [report, setReport] = useState(null);
  const [pl, setPl] = useState(null);

  useEffect(() => {
    // Owner sees a full branch picker; a merged login (butchery+hotel) also
    // gets one, scoped to their two linked branches.
    if (user.role === "owner" || user.linked_branch_id) {
      api.get("/branches").then((res) => {
        setBranches(res.data);
        if (user.role === "owner" && res.data.length > 0) setSelectedBranch(res.data[0].branch_id);
      });
    }
  }, [user]);

  useEffect(() => {
    if (!selectedBranch) return;
    api.get(`/reports/sales/${selectedBranch}?period=${period}`).then((res) => setReport(res.data));
    const { start, end } = dateRangeFor(period);
    api.get(`/reports/profit-loss/${selectedBranch}?start=${start}&end=${end}`).then((res) => setPl(res.data)).catch(() => setPl(null));
  }, [period, selectedBranch]);

  const branchName = branches.find((b) => b.branch_id === Number(selectedBranch))?.branch_name;
  const pieData = pl && pl.profit >= 0
    ? [
        { name: "Expenses", value: pl.expenses },
        { name: "Profit", value: pl.profit },
      ].filter((d) => d.value > 0)
    : null;

  return (
    <div>
      <h1>Reports</h1>
      <div className="subtitle">
        Detailed performance{branchName ? ` for ${branchName}` : ""} — daily, weekly, and monthly
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        {(user.role === "owner" || user.linked_branch_id) && (
          <div className="field" style={{ maxWidth: 300, marginBottom: 0 }}>
            <label>Branch</label>
            <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
              {branches.map((b) => (
                <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Period</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["daily", "weekly", "monthly"].map((p) => (
              <button
                key={p}
                className="btn"
                style={{ width: "auto", background: period === p ? "var(--accent)" : "#ddd6c9", color: period === p ? "#fff" : "#333" }}
                onClick={() => setPeriod(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {report && (
        <div className="card-grid">
          <div className="stat-card">
            <div className="label">Total Sales</div>
            <div className="value">KSh {Number(report.summary.total_sales).toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="label">Transactions</div>
            <div className="value">{report.summary.transaction_count}</div>
          </div>
          {pl && (
            <>
              <div className="stat-card">
                <div className="label">Expenses</div>
                <div className="value">KSh {Number(pl.expenses).toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="label">{pl.profit >= 0 ? "Profit" : "Loss"}</div>
                <div className="value" style={{ color: pl.profit >= 0 ? "var(--success)" : "var(--danger)" }}>
                  KSh {Math.abs(pl.profit).toLocaleString()}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {pl && (
        <>
          <h2>Revenue Breakdown</h2>
          {pieData && pieData.length > 0 ? (
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16, maxWidth: 480, marginBottom: 28 }}>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(d) => `${d.name}: KSh ${Number(d.value).toLocaleString()}`}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.name === "Expenses" ? COLORS.expenses : COLORS.profit} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `KSh ${Number(v).toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 28 }}>
              {pl.revenue === 0 ? "No revenue in this period yet." : "Expenses exceeded revenue this period — a loss doesn't split into a pie, see the figures above."}
            </p>
          )}
        </>
      )}

      {report && (
        <>
          <h2>Top Products</h2>
          <table>
            <thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr></thead>
            <tbody>
              {report.top_products.map((tp, i) => (
                <tr key={i}>
                  <td>{tp.product_name}</td>
                  <td>{tp.total_qty}</td>
                  <td>KSh {Number(tp.total_revenue).toLocaleString()}</td>
                </tr>
              ))}
              {report.top_products.length === 0 && (
                <tr><td colSpan="3" style={{ color: "var(--muted)" }}>No sales in this period yet.</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
