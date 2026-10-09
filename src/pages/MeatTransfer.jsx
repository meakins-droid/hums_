import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function MeatTransfer() {
  const { user } = useAuth();
  const [butcheries, setButcheries] = useState([]);
  const [selectedButchery, setSelectedButchery] = useState("");
  const [attachedRestaurant, setAttachedRestaurant] = useState(null);
  const [meatProducts, setMeatProducts] = useState([]);
  const [form, setForm] = useState({ from_product_id: "", quantity_kg: "" });
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.get("/branches").then((res) => {
      const allBranches = res.data;
      const butcheryList = user.role === "owner"
        ? allBranches.filter((b) => b.branch_type === "butchery")
        : allBranches.filter((b) => b.branch_id === user.branch_id && b.branch_type === "butchery");
      setButcheries(butcheryList);

      if (butcheryList.length > 0) {
        const first = butcheryList[0];
        setSelectedButchery(first.branch_id);
        const restaurant = allBranches.find((b) => b.parent_branch_id === first.branch_id);
        setAttachedRestaurant(restaurant || null);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!selectedButchery) return;
    api.get("/branches").then((res) => {
      const restaurant = res.data.find((b) => b.parent_branch_id === Number(selectedButchery));
      setAttachedRestaurant(restaurant || null);
    });
    api.get(`/products/branch/${selectedButchery}`).then((res) => setMeatProducts(res.data));
    api.get(`/meat-transfers/branch/${selectedButchery}`).then((res) => setHistory(res.data));
  }, [selectedButchery]);

  async function submitTransfer(e) {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await api.post("/meat-transfers", {
        from_branch_id: selectedButchery,
        from_product_id: form.from_product_id,
        to_branch_id: attachedRestaurant.branch_id,
        quantity_kg: Number(form.quantity_kg),
      });
      setMessage({ type: "success", text: res.data.message });
      setForm({ from_product_id: "", quantity_kg: "" });
      const [prodRes, histRes] = await Promise.all([
        api.get(`/products/branch/${selectedButchery}`),
        api.get(`/meat-transfers/branch/${selectedButchery}`),
      ]);
      setMeatProducts(prodRes.data);
      setHistory(histRes.data);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Transfer failed." });
    }
  }

  return (
    <div>
      <h1>Meat Transfer to Kitchen</h1>
      <div className="subtitle">Move raw meat from a butchery's retail stock into its attached restaurant's kitchen — it lands under the same item name automatically</div>

      {user.role === "owner" && (
        <div className="field" style={{ maxWidth: 320, marginBottom: 20 }}>
          <label>Butchery</label>
          <select value={selectedButchery} onChange={(e) => setSelectedButchery(e.target.value)}>
            {butcheries.map((b) => (
              <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
            ))}
          </select>
        </div>
      )}

      {!attachedRestaurant ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          This butchery has no restaurant linked to it yet. Set that branch's <code>parent_branch_id</code> to this
          butchery's ID before transfers can happen.
        </p>
      ) : (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
            Transferring into: <strong>{attachedRestaurant.branch_name}</strong>
          </p>

          <form onSubmit={submitTransfer} style={{ maxWidth: 420, marginBottom: 32 }}>
            {message && (
              <p style={{ color: message.type === "success" ? "var(--success)" : "var(--danger)", fontSize: 13 }}>
                {message.text}
              </p>
            )}

            <div className="field">
              <label>Meat Product (from butchery stock)</label>
              <select
                value={form.from_product_id}
                onChange={(e) => setForm({ ...form, from_product_id: e.target.value })}
                required
              >
                <option value="">Select...</option>
                {meatProducts.map((p) => (
                  <option key={p.product_id} value={p.product_id}>{p.product_name} ({p.current_stock}kg available)</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Quantity (kg)</label>
              <input
                type="number" step="0.1" min="0.1"
                value={form.quantity_kg}
                onChange={(e) => setForm({ ...form, quantity_kg: e.target.value })}
                required
              />
            </div>

            <button className="btn" type="submit">Transfer to Kitchen</button>
          </form>

          <h2>Transfer History</h2>
          <table>
            <thead><tr><th>Date</th><th>From</th><th>To</th><th>Ingredient</th><th>Kg</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.transfer_id}>
                  <td>{new Date(h.transfer_date).toLocaleDateString()}</td>
                  <td>{h.from_branch_name} ({h.from_product_name})</td>
                  <td>{h.to_branch_name}</td>
                  <td>{h.to_ingredient_name}</td>
                  <td>{h.quantity_kg} kg</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan="5" style={{ color: "var(--muted)" }}>No transfers logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
