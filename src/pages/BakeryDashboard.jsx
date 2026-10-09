import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

// Landing page for a plain (non-merged) bakery account — today's revenue
// and expenses up top, then quick links to the bakery's own tools
// underneath. Reuses the same endpoint the hotel+butchery merged dashboard
// uses — for a single branch with no linked branch, it just returns that
// one branch's own numbers, so nothing new was needed on the backend.
// Revenue here includes any Scheduled Order marked Delivered today (it
// becomes a real sale at that point), so a paid delivery shows up the
// same day it's actually paid for.
export default function BakeryDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/reports/merged-dashboard/${user.branch_id}`).then((res) => setData(res.data));
  }, [user.branch_id]);

  if (!data) return <div><h1>{user.branch_name}</h1><p style={{ color: "var(--muted)" }}>Loading…</p></div>;

  const net = data.total_revenue - data.total_expenses;

  return (
    <div>
      <h1>{user.branch_name}</h1>
      <div className="subtitle">Today's figures at a glance — tools for running the bakery are below.</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, marginBottom: 32 }}>
        <div className="stat-card"><p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}>Revenue today</p><p style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>KSh {data.total_revenue.toLocaleString()}</p></div>
        <div className="stat-card"><p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}>Expenses today</p><p style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>KSh {data.total_expenses.toLocaleString()}</p></div>
        <div className="stat-card"><p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}>Net today</p><p style={{ fontSize: 24, fontWeight: 500, margin: 0, color: net >= 0 ? "var(--success)" : "var(--danger)" }}>KSh {net.toLocaleString()}</p></div>
      </div>

      {data.outstanding_scheduled_orders?.count > 0 && (
        <div className="stat-card" style={{ maxWidth: 360, marginBottom: 32, borderColor: "#f0c36d" }}>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}>Unpaid / partial scheduled orders</p>
          <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>
            {data.outstanding_scheduled_orders.count} order{data.outstanding_scheduled_orders.count === 1 ? "" : "s"} —
            KSh {data.outstanding_scheduled_orders.balance.toLocaleString()} owing
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 280 }}>
        <Link className="btn" style={{ textAlign: "left" }} to="/pos">Point of Sale</Link>
        {user.branch_name === "Home Bakery" && (
          <Link className="btn" style={{ textAlign: "left" }} to="/scheduled-orders">Scheduled Orders</Link>
        )}
        <Link className="btn" style={{ textAlign: "left" }} to="/recipes">Recipes</Link>
        <Link className="btn" style={{ textAlign: "left" }} to="/production">Production Batch</Link>
        <Link className="btn" style={{ textAlign: "left" }} to="/ingredients">Ingredients</Link>
        <Link className="btn" style={{ textAlign: "left" }} to="/market-sales">Market Sales</Link>
        <Link className="btn" style={{ textAlign: "left", background: "#ddd6c9", color: "#333" }} to="/inventory">Inventory</Link>
      </div>
    </div>
  );
}
