import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function MeatDelivery() {
  const { user } = useAuth();
  const blocked = user.role !== "owner" && user.branch_type !== "butchery";
  const [butcheries, setButcheries] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(user.branch_id || "");
  const [products, setProducts] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [form, setForm] = useState({
    product_id: "", animal_type: "goat", supplier_name: "",
    total_kg_received: "", total_cost: "", delivery_date: "",
  });
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (user.role === "owner") {
      api.get("/branches").then((res) => {
        const list = res.data.filter((b) => b.branch_type === "butchery");
        setButcheries(list);
        if (list.length > 0) setSelectedBranch(list[0].branch_id);
      });
    }
    // A manager is locked to their own branch — no dropdown needed, and the
    // backend would reject any other branch_id from them anyway.
  }, [user]);

  useEffect(() => {
    if (!selectedBranch) return;
    api.get(`/products/branch/${selectedBranch}`).then((res) => setProducts(res.data));
    api.get(`/meat/deliveries?branch_id=${selectedBranch}`).then((res) => setDeliveries(res.data));
  }, [selectedBranch]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function submitDelivery(e) {
    e.preventDefault();
    setMessage(null);
    try {
      await api.post("/meat/deliveries", { ...form, branch_id: selectedBranch });
      setMessage({ type: "success", text: "Delivery recorded — stock updated immediately." });
      setForm({ product_id: "", animal_type: "goat", supplier_name: "", total_kg_received: "", total_cost: "", delivery_date: "" });
      const [prodRes, delRes] = await Promise.all([
        api.get(`/products/branch/${selectedBranch}`),
        api.get(`/meat/deliveries?branch_id=${selectedBranch}`),
      ]);
      setProducts(prodRes.data);
      setDeliveries(delRes.data);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to record delivery." });
    }
  }

  if (blocked) {
    return (
      <div>
        <h1>Meat Delivery</h1>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Only used at a butchery — bakeries and hotels use Inventory instead.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Meat Delivery</h1>
      <div className="subtitle">A delivery goes straight into that butchery's stock — record another one later and it just adds on top</div>

      {user.role === "owner" && (
        <div className="field" style={{ maxWidth: 320, marginBottom: 20 }}>
          <label>Butchery</label>
          <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
            {butcheries.map((b) => (
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

      <form onSubmit={submitDelivery} style={{ maxWidth: 420, marginBottom: 32 }}>
        <div className="field">
          <label>Product (which stock this tops up)</label>
          <select name="product_id" value={form.product_id} onChange={handleChange} required>
            <option value="">Select...</option>
            {products.map((p) => (
              <option key={p.product_id} value={p.product_id}>{p.product_name} ({p.current_stock}kg currently)</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Animal Type</label>
          <select name="animal_type" value={form.animal_type} onChange={handleChange}>
            <option value="goat">Goat</option>
            <option value="cow">Cow</option>
            <option value="chicken">Chicken</option>
            <option value="pig">Pig</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="field">
          <label>Delivered By (person or agent's name)</label>
          <input
            name="supplier_name"
            placeholder="Who physically brought this delivery"
            value={form.supplier_name}
            onChange={handleChange}
          />
        </div>
        <div className="field">
          <label>Kg Delivered</label>
          <input name="total_kg_received" type="number" step="0.1" value={form.total_kg_received} onChange={handleChange} required />
        </div>
        <div className="field">
          <label>Total Cost (KSh)</label>
          <input name="total_cost" type="number" step="0.01" value={form.total_cost} onChange={handleChange} required />
        </div>
        <div className="field">
          <label>Delivery Date</label>
          <input name="delivery_date" type="date" value={form.delivery_date} onChange={handleChange} required />
        </div>
        <button className="btn" type="submit">Record Delivery — Add to Stock</button>
      </form>

      <h2>Current Stock at This Butchery</h2>
      <table style={{ marginBottom: 32 }}>
        <thead><tr><th>Product</th><th>Current Stock</th><th>Reorder Level</th><th>Status</th></tr></thead>
        <tbody>
          {products.map((p) => {
            const isLow = Number(p.current_stock) <= Number(p.reorder_level);
            return (
              <tr key={p.product_id}>
                <td>{p.product_name}</td>
                <td style={{ fontWeight: 600 }}>{p.current_stock} {p.unit}</td>
                <td>{p.reorder_level} {p.unit}</td>
                <td><span className={`badge ${isLow ? "low" : "ok"}`}>{isLow ? "Restock Needed" : "OK"}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>Delivery History</h2>
      <table>
        <thead>
          <tr><th>Date</th><th>Product</th><th>Animal</th><th>Delivered By</th><th>Kg Added</th><th>Cost</th></tr>
        </thead>
        <tbody>
          {deliveries.map((d) => (
            <tr key={d.delivery_id}>
              <td>{new Date(d.delivery_date).toLocaleDateString()}</td>
              <td>{d.product_name}</td>
              <td style={{ textTransform: "capitalize" }}>{d.animal_type}</td>
              <td>{d.supplier_name || "—"}</td>
              <td>{d.total_kg_received} kg</td>
              <td>KSh {Number(d.total_cost).toLocaleString()}</td>
            </tr>
          ))}
          {deliveries.length === 0 && (
            <tr><td colSpan="6" style={{ color: "var(--muted)" }}>No deliveries recorded yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
