import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

// Home Bakery's order-first flow: a client orders ahead (e.g. "Kitui School —
// 300 packets of Mandazi, 150 packets of KDF"), THEN ingredients get bought
// for it, THEN it's baked, THEN delivered. Nduani Bakery doesn't work this
// way — it bakes and sells same-day — so this page is Home Bakery only.
// Three states only: an order is Placed, it gets Cancelled, or it's
// Delivered — full payment collected at that point. (The ENUM in the
// database still has the old in-between values for history; nothing
// here ever sets them anymore.)
const STATUS_FLOW = ["placed", "completed"];
const STATUS_LABELS = { placed: "Placed", completed: "Delivered", cancelled: "Cancelled" };

export default function ScheduledOrders() {
  const { user } = useAuth();
  const branchTypes = [user.branch_type, user.linked_branch_type].filter(Boolean);
  const blocked = user.role !== "owner" && !branchTypes.includes("bakery");
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(user.branch_id || "");
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const emptyForm = {
    customer_name: "", customer_phone: "",
    items: [{ product_id: "", quantity: "" }],
    due_date: "", due_time: "", deposit_amount: "", special_instructions: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState(null);
  // Delivery = payment, full stop. No partial-payment-then-deliver — if it's
  // not fully paid, it isn't delivered yet. This stops a delivered order
  // ever sitting there "owing" money.

  useEffect(() => {
    if (user.role === "owner") {
      api.get("/branches").then((res) => {
        const producing = res.data.filter((b) => b.branch_type === "bakery");
        setBranches(producing);
        if (producing.length > 0) setSelectedBranch(producing[0].branch_id);
      });
    }
  }, [user]);

  function loadOrders(branchId) {
    if (!branchId) return;
    api.get(`/scheduled-orders/branch/${branchId}`).then((res) => setOrders(res.data));
  }

  useEffect(() => {
    if (selectedBranch) {
      loadOrders(selectedBranch);
      api.get(`/products/branch/${selectedBranch}`).then((res) => setProducts(res.data));
    }
  }, [selectedBranch]);

  const setItem = (i, field, value) =>
    setForm({ ...form, items: form.items.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)) });
  const addItem = () => setForm({ ...form, items: [...form.items, { product_id: "", quantity: "" }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  const orderTotal = form.items.reduce((sum, it) => {
    const p = products.find((x) => x.product_id === Number(it.product_id));
    return sum + (p ? Number(p.unit_price) * Number(it.quantity || 0) : 0);
  }, 0);

  async function placeOrder(e) {
    e.preventDefault();
    setMessage(null);
    try {
      await api.post("/scheduled-orders", {
        ...form,
        branch_id: selectedBranch,
        items: form.items.filter((it) => it.product_id && it.quantity).map((it) => ({ product_id: Number(it.product_id), quantity: Number(it.quantity) })),
      });
      setForm(emptyForm);
      setMessage({ type: "success", text: "Order placed." });
      loadOrders(selectedBranch);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to place order." });
    }
  }

  async function advanceStatus(order, nextStatus, extra) {
    setMessage(null);
    try {
      await api.put(`/scheduled-orders/${order.order_id}/status`, { status: nextStatus, ...extra });
      loadOrders(selectedBranch);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not update status." });
    }
  }

  async function cancelOrder(order) {
    await advanceStatus(order, "cancelled");
  }

  async function markDelivered(order) {
    if (!window.confirm(`Confirm "${order.customer_name}" has been delivered AND paid in full (KSh ${Number(order.total_amount).toLocaleString()})?`)) return;
    // No amount is sent — the backend defaults to the full total when
    // amount_received is omitted, which is exactly the point: delivery
    // always means fully paid, never a partial amount left owing.
    await advanceStatus(order, "completed", { payment_method: "cash" });
  }

  if (blocked) {
    return (
      <div>
        <h1>Scheduled Orders</h1>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Advance orders are only taken through Home Bakery.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Scheduled Orders</h1>
      <div className="subtitle">Order first, then ingredients are bought, then baking, then delivery</div>

      {user.role === "owner" && (
        <div className="field" style={{ maxWidth: 320, marginBottom: 20 }}>
          <label>Branch</label>
          <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
            {branches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
          </select>
        </div>
      )}

      {message && (
        <p style={{ color: message.type === "success" ? "var(--success)" : "var(--danger)", fontSize: 13 }}>
          {message.text}
        </p>
      )}

      <h2>Order Queue</h2>
      <table style={{ marginBottom: 32 }}>
        <thead>
          <tr><th>Due</th><th>Client</th><th>Items</th><th>Total</th><th>Received</th><th>Paid</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const flowIndex = STATUS_FLOW.indexOf(o.status);
            const nextStatus = flowIndex >= 0 && flowIndex < STATUS_FLOW.length - 1 ? STATUS_FLOW[flowIndex + 1] : null;
            const balance = Number(o.total_amount) - Number(o.amount_received);
            return (
              <tr key={o.order_id}>
                <td>{new Date(o.due_date).toLocaleDateString()}{o.due_time ? ` ${o.due_time}` : ""}</td>
                <td>{o.customer_name}{o.customer_phone ? ` (${o.customer_phone})` : ""}</td>
                <td>{(o.items || []).map((it) => `${it.quantity} ${it.unit} ${it.product_name}`).join(", ")}</td>
                <td>KSh {Number(o.total_amount).toLocaleString()}</td>
                <td>
                  KSh {Number(o.amount_received).toLocaleString()}
                  {balance > 0 && o.status !== "cancelled" && (
                    <span style={{ color: "var(--danger)", fontSize: 11, display: "block" }}>
                      KSh {balance.toLocaleString()} owing
                    </span>
                  )}
                </td>
                <td>
                  {o.status === "cancelled" ? (
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                  ) : (
                    <span className={`badge ${balance <= 0 ? "ok" : Number(o.amount_received) > 0 ? "" : "low"}`} style={balance > 0 && Number(o.amount_received) > 0 ? { background: "#fff3cd", color: "#8a6d00" } : undefined}>
                      {balance <= 0 ? "Paid" : Number(o.amount_received) > 0 ? "Partial" : "Unpaid"}
                    </span>
                  )}
                </td>
                <td>
                  <span className={`badge ${o.status === "cancelled" ? "low" : "ok"}`}>{STATUS_LABELS[o.status]}</span>
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  {nextStatus && nextStatus !== "completed" && (
                    <button className="btn" style={{ width: "auto", padding: "6px 10px", fontSize: 12 }} onClick={() => advanceStatus(o, nextStatus)}>
                      Mark {STATUS_LABELS[nextStatus]}
                    </button>
                  )}
                  {nextStatus === "completed" && (
                    <button
                      className="btn"
                      style={{ width: "auto", padding: "6px 10px", fontSize: 12 }}
                      onClick={() => markDelivered(o)}
                    >
                      Paid — Confirm Delivery
                    </button>
                  )}
                  {o.status !== "completed" && o.status !== "cancelled" && (
                    <button
                      className="btn"
                      style={{ width: "auto", padding: "6px 10px", fontSize: 12, background: "#ddd6c9", color: "#333" }}
                      onClick={() => cancelOrder(o)}
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {orders.length === 0 && (
            <tr><td colSpan="7" style={{ color: "var(--muted)" }}>No scheduled orders yet.</td></tr>
          )}
        </tbody>
      </table>

      {user.role !== "owner" && (
      <>
      <h2>Place a New Order</h2>
      <form onSubmit={placeOrder} style={{ maxWidth: 480 }}>
        <div className="field">
          <label>Client's Name</label>
          <input placeholder='e.g. "Kitui School"' value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
        </div>
        <div className="field">
          <label>Client Phone (optional)</label>
          <input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
        </div>

        <label style={{ fontSize: 13, fontWeight: 500 }}>Products ordered</label>
        {form.items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 8, margin: "8px 0", alignItems: "center" }}>
            <select style={{ flex: 2 }} value={it.product_id} onChange={(e) => setItem(i, "product_id", e.target.value)} required>
              <option value="">Product…</option>
              {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
            </select>
            <input style={{ flex: 1 }} type="number" min="1" step="1" placeholder="Qty" value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} required />
            {form.items.length > 1 && (
              <button type="button" className="btn" style={{ width: "auto", padding: "4px 10px", fontSize: 12, background: "#ddd6c9", color: "#333" }} onClick={() => removeItem(i)}>✕</button>
            )}
          </div>
        ))}
        <button type="button" className="btn" style={{ width: "auto", padding: "6px 12px", fontSize: 12, background: "#ddd6c9", color: "#333", marginBottom: 16 }} onClick={addItem}>
          + Add another product
        </button>

        {orderTotal > 0 && (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Order total: KSh {orderTotal.toLocaleString()}</p>
        )}

        <div className="field">
          <label>Due Date</label>
          <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
        </div>
        <div className="field">
          <label>Due Time (optional)</label>
          <input type="time" value={form.due_time} onChange={(e) => setForm({ ...form, due_time: e.target.value })} />
        </div>
        <div className="field">
          <label>Deposit Paid Now (optional — not every client pays one)</label>
          <input type="number" step="0.01" min="0" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} />
        </div>
        <div className="field">
          <label>Special Instructions</label>
          <input
            placeholder="e.g. packaging preference, delivery address"
            value={form.special_instructions}
            onChange={(e) => setForm({ ...form, special_instructions: e.target.value })}
          />
        </div>
        <button className="btn" type="submit">Place Order</button>
      </form>
      </>
      )}
    </div>
  );
}
