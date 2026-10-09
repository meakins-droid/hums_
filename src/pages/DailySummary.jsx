import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

// For a standalone butchery with no hotel and no item-by-item POS. Once a
// day: count the cash, log the day's expenses (same Expenses page/endpoint
// as everywhere else), and count each product's physical stock. Submitting
// sets each product's stock to the counted figure — that's what tomorrow's
// restocking is judged against.
export default function DailySummary() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(user.role === "owner" ? "" : user.branch_id);
  const branchId = selectedBranch;
  const [products, setProducts] = useState([]);
  const [cashCounted, setCashCounted] = useState("");
  const [counts, setCounts] = useState({}); // { product_id: counted_stock }
  const [todayExpenses, setTodayExpenses] = useState([]);
  const [newExpense, setNewExpense] = useState({ category: "", description: "", amount: "" });
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState(null);
  const [result, setResult] = useState(null);

  const today = new Date().toISOString().slice(0, 10);

  // Owner picks from standalone butcheries only — the ones with no hotel
  // attached (neither linked as a parent nor a child of another branch).
  // This page doesn't apply to a merged butchery+hotel account.
  useEffect(() => {
    if (user.role === "owner") {
      api.get("/branches").then((res) => {
        const standalone = res.data.filter((b) =>
          b.branch_type === "butchery" && !b.parent_branch_id && !res.data.some((o) => o.parent_branch_id === b.branch_id)
        );
        setBranches(standalone);
        if (standalone.length > 0) setSelectedBranch(standalone[0].branch_id);
      });
    }
  }, [user]);

  function load() {
    if (!branchId) return;
    api.get(`/products/branch/${branchId}`).then((res) => setProducts(res.data));
    api.get(`/expenses/branch/${branchId}?start=${today}&end=${today}`).then((res) => setTodayExpenses(res.data));
    api.get(`/daily-summaries/branch/${branchId}`).then((res) => setHistory(res.data));
  }
  useEffect(load, [branchId]);

  const alreadySubmittedToday = history.some((h) => h.summary_date.slice(0, 10) === today);
  const totalExpensesToday = todayExpenses.reduce((s, e) => s + Number(e.amount), 0);

  async function addExpense(e) {
    e.preventDefault();
    if (!newExpense.category || !newExpense.amount) return;
    try {
      await api.post("/expenses", { ...newExpense, branch_id: branchId, expense_date: today });
      setNewExpense({ category: "", description: "", amount: "" });
      load();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not log expense." });
    }
  }

  async function submit(e) {
    e.preventDefault();
    setMessage(null);
    const items = products
      .filter((p) => counts[p.product_id] !== undefined && counts[p.product_id] !== "")
      .map((p) => ({ product_id: p.product_id, counted_stock: Number(counts[p.product_id]) }));
    if (items.length === 0) {
      setMessage({ type: "error", text: "Enter at least one product's physical count." });
      return;
    }
    try {
      const res = await api.post("/daily-summaries", {
        branch_id: branchId, summary_date: today, cash_counted: Number(cashCounted), items,
      });
      setResult(res.data);
      setMessage({ type: "success", text: "Daily Summary submitted." });
      setCashCounted("");
      setCounts({});
      load();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not submit Daily Summary." });
    }
  }

  return (
    <div>
      <h1>Daily Summary{user.role !== "owner" ? ` — ${user.branch_name}` : ""}</h1>
      <div className="subtitle">Cash counted, today's expenses, and a physical stock count — once a day</div>

      {user.role === "owner" && (
        <div className="field" style={{ maxWidth: 300, marginBottom: 20 }}>
          <label>Branch</label>
          <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
            {branches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
          </select>
          {branches.length === 0 && <p style={{ fontSize: 12, color: "var(--muted)" }}>No standalone butcheries found.</p>}
        </div>
      )}

      {message && (
        <p style={{ color: message.type === "success" ? "var(--success)" : "var(--danger)", fontSize: 13 }}>{message.text}</p>
      )}

      {result && (
        <div className="stat-card" style={{ maxWidth: 480, marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>Today's result</h2>
          <p style={{ fontSize: 13 }}>
            Stock movement suggests about <strong>KSh {Number(result.expected_cash).toLocaleString()}</strong> should have
            come in. You counted <strong>KSh {Number(cashCounted || 0).toLocaleString()}</strong>
            {result.cash_variance !== 0 && (
              <span style={{ color: result.cash_variance < 0 ? "var(--danger)" : "var(--success)" }}>
                {" "}({result.cash_variance < 0 ? "short" : "over"} by KSh {Math.abs(Number(result.cash_variance)).toLocaleString()})
              </span>
            )}.
          </p>
        </div>
      )}

      {alreadySubmittedToday ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Today's Daily Summary has already been submitted.</p>
      ) : (
        <form onSubmit={submit} style={{ maxWidth: 520, marginBottom: 32 }}>
          <div className="field">
            <label>Cash Counted Today (KSh)</label>
            <input type="number" step="0.01" min="0" required value={cashCounted} onChange={(e) => setCashCounted(e.target.value)} />
          </div>

          <h2>Physical Stock Count</h2>
          <table style={{ marginBottom: 16 }}>
            <thead><tr><th>Product</th><th>System has</th><th>Physical count</th></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.product_id}>
                  <td>{p.product_name}</td>
                  <td>{Number(p.current_stock)} {p.unit}</td>
                  <td>
                    <input
                      type="number" step="0.1" min="0" style={{ maxWidth: 110 }}
                      value={counts[p.product_id] ?? ""}
                      onChange={(e) => setCounts({ ...counts, [p.product_id]: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button className="btn" type="submit">Submit Daily Summary</button>
        </form>
      )}

      <h2>Today's Expenses (KSh {totalExpensesToday.toLocaleString()} so far)</h2>
      <form onSubmit={addExpense} style={{ display: "flex", gap: 8, flexWrap: "wrap", maxWidth: 520, marginBottom: 12 }}>
        <input style={{ flex: 1 }} placeholder="Category (e.g. Labour, Fuel)" value={newExpense.category} onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })} />
        <input style={{ flex: 1 }} placeholder="Description (optional)" value={newExpense.description} onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })} />
        <input style={{ width: 110 }} type="number" step="0.01" min="0" placeholder="Amount" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} />
        <button className="btn" type="submit" style={{ width: "auto" }}>Log Expense</button>
      </form>
      <table style={{ marginBottom: 32, maxWidth: 520 }}>
        <tbody>
          {todayExpenses.map((e) => (
            <tr key={e.expense_id}><td>{e.category}</td><td>{e.description || "—"}</td><td>KSh {Number(e.amount).toLocaleString()}</td></tr>
          ))}
          {todayExpenses.length === 0 && <tr><td style={{ color: "var(--muted)" }}>No expenses logged yet today.</td></tr>}
        </tbody>
      </table>

      <h2>History</h2>
      <table>
        <thead><tr><th>Date</th><th>Cash Counted</th><th>Expected</th><th>Variance</th><th>Submitted By</th></tr></thead>
        <tbody>
          {history.map((h) => (
            <tr key={h.summary_id}>
              <td>{new Date(h.summary_date).toLocaleDateString()}</td>
              <td>KSh {Number(h.cash_counted).toLocaleString()}</td>
              <td>KSh {Number(h.expected_cash).toLocaleString()}</td>
              <td style={{ color: Number(h.cash_variance) < 0 ? "var(--danger)" : "var(--success)" }}>
                KSh {Number(h.cash_variance).toLocaleString()}
              </td>
              <td>{h.submitted_by_name}</td>
            </tr>
          ))}
          {history.length === 0 && <tr><td colSpan="5" style={{ color: "var(--muted)" }}>No Daily Summaries submitted yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
