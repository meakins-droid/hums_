import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";
import Receipt from "../components/Receipt.jsx";

export default function CashierPOS() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]); // [{ product, quantity }]
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [message, setMessage] = useState("");
  const [completedSale, setCompletedSale] = useState(null);

  useEffect(() => {
    if (user?.branch_id) {
      api.get(`/products/branch/${user.branch_id}`).then((res) => setProducts(res.data));
    }
  }, [user]);

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((line) => line.product.product_id === product.product_id);
      if (existing) {
        return prev.map((line) =>
          line.product.product_id === product.product_id
            ? { ...line, quantity: line.quantity + 1 }
            : line
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function updateQty(productId, qty) {
    setCart((prev) => prev.map((line) =>
      line.product.product_id === productId ? { ...line, quantity: Number(qty) } : line
    ));
  }

  function removeLine(productId) {
    setCart((prev) => prev.filter((line) => line.product.product_id !== productId));
  }

  if (completedSale) {
    return (
      <div>
        <h1>Sale Complete</h1>
        <Receipt
          businessName="Hebrews Urgencies"
          branchName={user.branch_name || ""}
          saleId={completedSale.sale_id}
          dateTime={completedSale.dateTime}
          items={completedSale.items}
          totalAmount={completedSale.totalAmount}
          paymentMethod={completedSale.paymentMethod}
          cashierName={user.full_name}
          onClose={() => setCompletedSale(null)}
        />
      </div>
    );
  }

  const total = cart.reduce((sum, line) => sum + line.product.unit_price * line.quantity, 0);

  async function checkout() {
    setMessage("");
    try {
      const res = await api.post("/sales", {
        branch_id: user.branch_id,
        payment_method: paymentMethod,
        items: cart.map((line) => ({ product_id: line.product.product_id, quantity: line.quantity })),
      });
      setMessage("Sale recorded successfully.");
      setCompletedSale({
        sale_id: res.data.sale_id,
        dateTime: new Date().toISOString(),
        items: cart.map((line) => ({ product_name: line.product.product_name, quantity: line.quantity, subtotal: line.product.unit_price * line.quantity })),
        totalAmount: res.data.total_amount,
        paymentMethod,
      });
      setCart([]);
      const prodRes = await api.get(`/products/branch/${user.branch_id}`);
      setProducts(prodRes.data);
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to record sale.");
    }
  }

  return (
    <div>
      <h1>{user.branch_name} — Point of Sale</h1>
      <div className="subtitle">Tap a product to add it to the sale</div>

      {message && <p style={{ color: "var(--accent)", fontSize: 13 }}>{message}</p>}

      <div className="pos-grid">
        <div className="product-tiles">
          {products.map((prod) => (
            <button key={prod.product_id} className="product-tile" onClick={() => addToCart(prod)}>
              <div className="name">{prod.product_name}</div>
              <div className="price">KSh {Number(prod.unit_price).toLocaleString()} / {prod.unit}</div>
            </button>
          ))}
          {products.length === 0 && <p style={{ color: "var(--muted)" }}>No products found for this branch yet.</p>}
        </div>

        <div className="cart">
          <h2 style={{ marginTop: 0 }}>Current Sale</h2>
          {cart.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>Cart is empty.</p>}
          {cart.map((line) => (
            <div className="cart-line" key={line.product.product_id}>
              <span>{line.product.product_name}</span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={line.quantity}
                  onChange={(e) => updateQty(line.product.product_id, e.target.value)}
                  style={{ width: 55 }}
                />
                <button onClick={() => removeLine(line.product.product_id)} style={{ border: "none", background: "none", cursor: "pointer" }}>✕</button>
              </span>
            </div>
          ))}

          <div className="field" style={{ marginTop: 16 }}>
            <label>Payment Method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="mpesa_till">M-Pesa Till</option>
            </select>
          </div>

          <div className="cart-total">
            <span>Total</span>
            <span>KSh {total.toLocaleString()}</span>
          </div>

          <button className="btn" style={{ marginTop: 16 }} disabled={cart.length === 0} onClick={checkout}>
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  );
}
