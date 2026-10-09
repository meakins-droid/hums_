import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

// Landing page for a merged login (one manager account covering a butchery
// AND its attached hotel) — one screen, combined numbers up top, then a
// panel per business underneath linking to that business's own functions.
// Nothing from either original separate page is missing here, it's just
// reached through one login instead of two.
export default function MergedDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/reports/merged-dashboard/${user.branch_id}`).then((res) => setData(res.data));
  }, [user.branch_id]);

  if (!data) return <div><h1>Dashboard</h1><p style={{ color: "var(--muted)" }}>Loading…</p></div>;

  return (
    <div>
      <h1>{user.branch_name} + {user.linked_branch_name}</h1>
      <div className="subtitle">One login, both businesses — figures below are combined; each business's own tools are underneath.</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, marginBottom: 32 }}>
        <div className="stat-card"><p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}>Combined revenue today</p><p style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>KSh {data.total_revenue.toLocaleString()}</p></div>
        <div className="stat-card"><p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}>Combined expenses</p><p style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>KSh {data.total_expenses.toLocaleString()}</p></div>
        <div className="stat-card"><p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}>Net today</p><p style={{ fontSize: 24, fontWeight: 500, margin: 0, color: "var(--success)" }}>KSh {(data.total_revenue - data.total_expenses).toLocaleString()}</p></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {data.by_branch.map((b) => (
          <div key={b.branch_id} className="stat-card">
            <p style={{ fontSize: 15, fontWeight: 500, margin: "0 0 4px" }}>{b.branch_name}</p>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
              Revenue KSh {b.revenue.toLocaleString()} · Expenses KSh {b.expenses.toLocaleString()}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {b.branch_type === "butchery" && (
                <>
                  <Link className="btn" style={{ textAlign: "left" }} to="/butchery-pos">Butchery sales</Link>
                  <Link className="btn" style={{ textAlign: "left" }} to="/meat">Meat delivery</Link>
                  <Link className="btn" style={{ textAlign: "left" }} to="/meat-transfer">Meat transfer</Link>
                </>
              )}
              {b.branch_type === "restaurant" && (
                <>
                  <Link className="btn" style={{ textAlign: "left" }} to="/hotel-orders">Table orders</Link>
                  <Link className="btn" style={{ textAlign: "left" }} to="/staff-sign-in">Staff sign in</Link>
                  <Link className="btn" style={{ textAlign: "left" }} to="/ingredients">Ingredients</Link>
                  <Link className="btn" style={{ textAlign: "left" }} to="/recipes">Recipes</Link>
                  <Link className="btn" style={{ textAlign: "left" }} to="/production">Production batch</Link>
                </>
              )}
              <Link className="btn" style={{ textAlign: "left", background: "#ddd6c9", color: "#333" }} to="/inventory">Inventory</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
