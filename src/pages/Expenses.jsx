import { useEffect, useState } from "react";
import api, { downloadFile } from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

// Raw Materials is written automatically by the Ingredients page when stock is
// bought, so it isn't offered here — everything else is entered by hand.
const CATEGORIES = ["Labour", "Fuel", "Transport", "Rent", "Utilities", "Repairs", "Licences", "Other"];

export default function Expenses() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(user.branch_id || "");
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState({
    category: "Labour",
    description: "",
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
  });
  const [message, setMessage] = useState(null);

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

  function loadExpenses(branchId) {
    if (!branchId) return;
    api.get(`/expenses/branch/${branchId}`).then((res) => setExpenses(res.data));
  }

  useEffect(() => { loadExpenses(selectedBranch); }, [selectedBranch]);

  async function submitExpense(e) {
    e.preventDefault();
    setMessage(null);
    try {
      await api.post("/expenses", { ...form, branch_id: selectedBranch, amount: Number(form.amount) });
      setMessage({ type: "success", text: "Expense recorded." });
      setForm({ ...form, description: "", amount: "" });
      loadExpenses(selectedBranch);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to record expense." });
    }
  }

  // Group by category so the branch's spending pattern is visible at a glance.
  const byCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {});
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const branchName = branches.find((b) => b.branch_id === Number(selectedBranch))?.branch_name;

  return (
    <div>
      <h1>Expenses</h1>

      {(user.role === "owner" || user.linked_branch_id) && (
        <div className="field" style={{ maxWidth: 340, marginBottom: 20 }}>
          <label>Branch</label>
          <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
            {branches.map((b) => (
              <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
            ))}
          </select>
        </div>
      )}

      {message && (
        <p style={{ color: message.type === "success" ? "var(--success)" : "var(--danger)", fontSize: 13 }}>
          {message.text}
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <button
          className="btn"
          style={{ width: "auto" }}
          onClick={() => downloadFile(`/exports/expenses/branch/${selectedBranch}`, "expenses.xlsx")}
          disabled={!selectedBranch}
        >
          Download this branch's expenses (Excel)
        </button>
      </div>

      <div className="card-grid">
        <div className="stat-card">
          <div className="label">Total Recorded{branchName ? ` — ${branchName}` : ""}</div>
          <div className="value">KSh {total.toLocaleString()}</div>
        </div>
        {Object.entries(byCategory).slice(0, 3).map(([cat, amt]) => (
          <div className="stat-card" key={cat}>
            <div className="label">{cat}</div>
            <div className="value">KSh {amt.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <h2>Record an Expense</h2>
      <form onSubmit={submitExpense} style={{ maxWidth: 440, marginBottom: 32 }}>
        <div className="field">
          <label>Category</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Description</label>
          <input
            placeholder="e.g. Daily wages - two staff, or Motorcycle fuel - mandazi delivery round"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Amount (KSh)</label>
          <input
            type="number" step="0.01" min="0" required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Date</label>
          <input
            type="date" required
            value={form.expense_date}
            onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
          />
        </div>
        <button className="btn" type="submit">Record Expense</button>
      </form>

      <h2>Recent Expenses</h2>
      <table>
        <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.expense_id}>
              <td>{new Date(e.expense_date).toLocaleDateString()}</td>
              <td>{e.category}</td>
              <td>{e.description || "—"}</td>
              <td>KSh {Number(e.amount).toLocaleString()}</td>
            </tr>
          ))}
          {expenses.length === 0 && (
            <tr><td colSpan="4" style={{ color: "var(--muted)" }}>No expenses recorded yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
