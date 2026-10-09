import { useEffect, useState } from "react";
import api, { downloadFile } from "../api/axios.js";

export default function OwnerDashboard() {
  const [data, setData] = useState(null);
  const [upcomingOrders, setUpcomingOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/reports/dashboard"),
      api.get("/scheduled-orders/upcoming"),
    ])
      .then(([dashRes, ordersRes]) => {
        setData(dashRes.data);
        setUpcomingOrders(ordersRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading dashboard...</p>;
  if (!data) return <p>Could not load dashboard data.</p>;

  return (
    <div>
      <h1>Owner Dashboard</h1>
      <div className="subtitle">Consolidated view across all Hebrews Urgencies branches</div>

      <div className="card-grid">
        <div className="stat-card">
          <div className="label">Total Sales Today</div>
          <div className="value">KSh {Number(data.total_sales_today).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="label">Active Branches</div>
          <div className="value">{data.branches.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Low Stock Alerts</div>
          <div className="value">{data.low_stock_alerts.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Orders Due This Week</div>
          <div className="value">{upcomingOrders.length}</div>
        </div>
      </div>

      <h2>Organization-Wide Profit &amp; Loss</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {["daily", "weekly", "monthly"].map((per) => (
          <button
            key={per}
            className="btn"
            style={{ width: "auto", background: "#ddd6c9", color: "#333", fontSize: 13 }}
            onClick={() => downloadFile(`/exports/profit-loss?period=${per}`, `profit_loss_${per}.xlsx`)}
          >
            Download {per} P&amp;L
          </button>
        ))}
        <button
          className="btn"
          style={{ width: "auto", background: "#ddd6c9", color: "#333", fontSize: 13 }}
          onClick={() => downloadFile("/exports/recipes", "recipe_bom_reference.xlsx")}
        >
          Download Recipe BOM Reference
        </button>
      </div>
      <table style={{ marginBottom: 28 }}>
        <thead><tr><th>Period</th><th>Revenue (all branches)</th><th>Expenses (all branches)</th><th>Profit</th></tr></thead>
        <tbody>
          {["today", "week", "month"].map((period) => {
            const p = data.organization_summary[period];
            return (
              <tr key={period}>
                <td style={{ textTransform: "capitalize" }}>{period === "today" ? "Today" : period === "week" ? "This Week" : "This Month"}</td>
                <td>KSh {Number(p.revenue).toLocaleString()}</td>
                <td>KSh {Number(p.expenses).toLocaleString()}</td>
                <td style={{ color: p.profit >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                  KSh {Number(p.profit).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>Branch Performance</h2>
      <table>
        <thead>
          <tr>
            <th>Branch</th><th>Type</th><th>Today</th><th>This Week</th><th>This Month</th>
          </tr>
        </thead>
        <tbody>
          {data.branches.map((b) => (
            <tr key={b.branch_id}>
              <td>{b.branch_name}</td>
              <td style={{ textTransform: "capitalize" }}>{b.branch_type}</td>
              <td>KSh {Number(b.today_sales).toLocaleString()}</td>
              <td>KSh {Number(b.week_sales).toLocaleString()}</td>
              <td>KSh {Number(b.month_sales).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Upcoming Scheduled Orders (Next 7 Days)</h2>
      {upcomingOrders.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>No advance orders due this week.</p>
      ) : (
        <table>
          <thead><tr><th>Due</th><th>Branch</th><th>Customer</th><th>Item</th><th>Status</th></tr></thead>
          <tbody>
            {upcomingOrders.map((o) => (
              <tr key={o.order_id}>
                <td>{new Date(o.due_date).toLocaleDateString()}{o.due_time ? ` ${o.due_time}` : ""}</td>
                <td>{o.branch_name}</td>
                <td>{o.customer_name}</td>
                <td>{o.product_name}</td>
                <td style={{ textTransform: "capitalize" }}>{o.status.replace("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Low Stock Alerts</h2>
      {data.low_stock_alerts.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>All branches are stocked above their reorder levels.</p>
      ) : (
        <table>
          <thead><tr><th>Branch</th><th>Product</th><th>Current Stock</th><th>Reorder Level</th></tr></thead>
          <tbody>
            {data.low_stock_alerts.map((item) => (
              <tr key={item.product_id}>
                <td>{item.branch_name}</td>
                <td>{item.product_name}</td>
                <td><span className="badge low">{item.current_stock} {item.unit}</span></td>
                <td>{item.reorder_level} {item.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
