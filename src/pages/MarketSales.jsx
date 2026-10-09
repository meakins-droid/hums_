import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function MarketSales() {
  const { user } = useAuth();
  const [bakeryBranches, setBakeryBranches] = useState([]); // every branch_type='bakery' branch, fetched live — never hardcoded
  const [products, setProducts] = useState([]); // merged from every bakery
  const [sellingBranch, setSellingBranch] = useState(user.branch_id || ""); // which bakery this sale is credited to — the owner has no branch of their own, so they pick
  const [basket, setBasket] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [qty, setQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [message, setMessage] = useState(null);
  const [lastSale, setLastSale] = useState(null); // { sale_id, items: [...] }
  const [returnQty, setReturnQty] = useState({}); // { sale_item_id: value }
  const [summary, setSummary] = useState(null);

  function loadProducts() {
    api.get("/products/bakery-group").then((res) => {
      setBakeryBranches(res.data.branches);
      setProducts(res.data.products);
      if (res.data.products.length > 0) setSelectedProduct(res.data.products[0].product_id);
      // Owner has no branch of their own — default to the first bakery once we know what they are.
      setSellingBranch((prev) => prev || (res.data.branches[0] && res.data.branches[0].branch_id) || "");
    });
  }

  function loadSummary() {
    api.get("/sales/bakery-summary").then((res) => setSummary(res.data));
  }

  useEffect(() => {
    loadProducts();
    loadSummary();
  }, []);

  function addToBasket() {
    const product = products.find((p) => p.product_id === Number(selectedProduct));
    if (!product || !qty || qty <= 0) return;
    setBasket([...basket, { ...product, quantity: Number(qty) }]);
    setQty(1);
  }

  function removeFromBasket(index) {
    setBasket(basket.filter((_, i) => i !== index));
  }

  const basketTotal = basket.reduce((sum, b) => sum + Number(b.unit_price) * b.quantity, 0);

  async function submitSale() {
    if (basket.length === 0) return;
    setMessage(null);
    try {
      const res = await api.post("/sales", {
        branch_id: sellingBranch,
        payment_method: paymentMethod,
        items: basket.map((b) => ({ product_id: b.product_id, quantity: b.quantity })),
      });
      const itemsRes = await api.get(`/sales/${res.data.sale_id}/items`);
      setLastSale({ sale_id: res.data.sale_id, items: itemsRes.data });
      setMessage({ type: "success", text: `Sale #${res.data.sale_id} recorded — KSh ${Number(res.data.total_amount).toLocaleString()} total.` });
      setBasket([]);
      loadProducts();
      loadSummary();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Sale failed." });
    }
  }

  async function submitReturn(saleItemId) {
    const value = Number(returnQty[saleItemId]);
    if (!value || value <= 0) return;
    try {
      await api.put(`/sales/items/${saleItemId}/return`, { quantity_returned: value });
      setMessage({ type: "success", text: "Return recorded — added back to stock." });
      setReturnQty({ ...returnQty, [saleItemId]: "" });
      const itemsRes = await api.get(`/sales/${lastSale.sale_id}/items`);
      setLastSale({ ...lastSale, items: itemsRes.data });
      loadSummary();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Return failed." });
    }
  }

  const totalRevenue = summary?.by_branch.reduce((s, b) => s + b.revenue, 0) || 0;
  const totalExpenses = summary?.by_branch.reduce((s, b) => s + b.expenses, 0) || 0;
  const totalReturns = summary?.by_branch.reduce((s, b) => s + b.return_inwards_value, 0) || 0;

  return (
    <div>
      <h1>Market Sales</h1>
      <div className="subtitle">
        One basket for whatever's going to market — mixing Nduani Bakery and Home Bakery products in the same
        sale is fine, revenue still splits per bakery automatically below.
      </div>

      {message && (
        <p style={{ color: message.type === "success" ? "var(--success)" : "var(--danger)", fontSize: 13 }}>
          {message.text}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, marginBottom: 24 }}>
        <div className="stat-card"><p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}>Today's revenue</p><p style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>KSh {totalRevenue.toLocaleString()}</p></div>
        <div className="stat-card"><p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}>Today's expenses</p><p style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>KSh {totalExpenses.toLocaleString()}</p></div>
        <div className="stat-card"><p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}>Return inwards</p><p style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>KSh {totalReturns.toLocaleString()}</p></div>
      </div>

      {summary && (
        <table style={{ marginBottom: 32 }}>
          <thead><tr><th>Bakery</th><th>Revenue</th><th>Expenses</th><th>Return inwards</th></tr></thead>
          <tbody>
            {summary.by_branch.map((b) => (
              <tr key={b.branch_id}>
                <td>{bakeryBranches.find((x) => x.branch_id === b.branch_id)?.branch_name}</td>
                <td>KSh {b.revenue.toLocaleString()}</td>
                <td>KSh {b.expenses.toLocaleString()}</td>
                <td>KSh {b.return_inwards_value.toLocaleString()} ({b.return_inwards_qty} units)</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Build a sale</h2>
      {user.role === "owner" && (
        <div className="field" style={{ maxWidth: 260, marginBottom: 12 }}>
          <label>Selling as (which bakery this sale is credited to)</label>
          <select value={sellingBranch} onChange={(e) => setSellingBranch(e.target.value)}>
            {bakeryBranches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
          </select>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
        <div className="field" style={{ minWidth: 240 }}>
          <label>Product</label>
          <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
            {products.map((p) => (
              <option key={p.product_id} value={p.product_id}>
                {p.product_name} — {p.branch_name} (KSh {Number(p.unit_price).toLocaleString()}/{p.unit})
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ width: 100 }}>
          <label>Qty</label>
          <input type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <button className="btn" style={{ width: "auto", padding: "8px 16px" }} onClick={addToBasket}>Add</button>
      </div>

      {basket.length > 0 && (
        <>
          <table style={{ marginBottom: 12 }}>
            <thead><tr><th>Product</th><th>Bakery</th><th>Qty</th><th>Subtotal</th><th></th></tr></thead>
            <tbody>
              {basket.map((b, i) => (
                <tr key={i}>
                  <td>{b.product_name}</td>
                  <td>{b.branch_name}</td>
                  <td>{b.quantity} {b.unit}</td>
                  <td>KSh {(Number(b.unit_price) * b.quantity).toLocaleString()}</td>
                  <td><button className="btn" style={{ width: "auto", padding: "4px 10px", fontSize: 12 }} onClick={() => removeFromBasket(i)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 32 }}>
            <div className="field" style={{ width: 160, margin: 0 }}>
              <label>Payment method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="mpesa_till">M-Pesa till</option>
              </select>
            </div>
            <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>Total: KSh {basketTotal.toLocaleString()}</p>
            <button className="btn" style={{ width: "auto", padding: "8px 20px" }} onClick={submitSale}>Confirm sale</button>
          </div>
        </>
      )}

      {lastSale && (
        <>
          <h2>Return inwards — sale #{lastSale.sale_id}</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            Anything that didn't sell and came back — enter the quantity returned per line. It's added back to
            stock and netted out of that bakery's revenue automatically.
          </p>
          <table>
            <thead><tr><th>Product</th><th>Sold</th><th>Already returned</th><th>Return qty</th><th></th></tr></thead>
            <tbody>
              {lastSale.items.map((item) => (
                <tr key={item.sale_item_id}>
                  <td>{item.product_name}</td>
                  <td>{item.quantity} {item.unit}</td>
                  <td>{item.quantity_returned} {item.unit}</td>
                  <td style={{ width: 100 }}>
                    <input
                      type="number" min="0" step="0.1"
                      value={returnQty[item.sale_item_id] || ""}
                      onChange={(e) => setReturnQty({ ...returnQty, [item.sale_item_id]: e.target.value })}
                    />
                  </td>
                  <td>
                    <button className="btn" style={{ width: "auto", padding: "4px 10px", fontSize: 12 }} onClick={() => submitReturn(item.sale_item_id)}>
                      Record return
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
