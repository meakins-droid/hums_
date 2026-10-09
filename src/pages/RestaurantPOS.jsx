import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";
import Receipt from "../components/Receipt.jsx";

export default function RestaurantPOS() {
  const { user } = useAuth();
  // A standalone restaurant login IS the branch. A merged login (butchery
  // manager) reaches this page via "Table Orders" for their LINKED hotel —
  // their own branch_id is the butchery, which has no table orders.
  const branchId = user.branch_type === "restaurant" ? user.branch_id : user.linked_branch_id;
  const branchName = user.branch_type === "restaurant" ? user.branch_name : user.linked_branch_name;
  const [openOrders, setOpenOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null); // full detail of the order being worked on
  const [products, setProducts] = useState([]);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [signedInServers, setSignedInServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState("");
  const [message, setMessage] = useState("");
  const [closedReceipt, setClosedReceipt] = useState(null);

  function loadOpenOrders() {
    api.get(`/orders/branch/${branchId}?status=open`).then((res) => setOpenOrders(res.data));
  }

  function loadServers() {
    api.get(`/servers/branch/${branchId}`).then((res) => {
      const onShift = res.data.filter((s) => s.signed_in);
      setSignedInServers(onShift);
      // Auto-pick when there's exactly one server on shift; otherwise the
      // person opening the table chooses from whoever's actually signed in.
      setSelectedServer((prev) => (onShift.some((s) => String(s.server_id) === prev) ? prev : (onShift.length === 1 ? String(onShift[0].server_id) : "")));
    });
  }

  useEffect(() => {
    if (branchId) {
      loadOpenOrders();
      loadServers();
      api.get(`/products/branch/${branchId}`).then((res) => setProducts(res.data));
    }
  }, [branchId]);

  async function openTable(e) {
    e.preventDefault();
    if (!newTableNumber) return;
    setMessage("");
    try {
      await api.post("/orders/open", { branch_id: branchId, table_number: newTableNumber, server_id: selectedServer || null });
      setNewTableNumber("");
      loadOpenOrders();
    } catch (err) {
      setMessage(err.response?.data?.message || "Could not open table.");
    }
  }

  async function viewOrder(saleId) {
    const res = await api.get(`/orders/${saleId}`);
    setActiveOrder(res.data);
    setMessage("");
    loadServers();
  }

  async function addItem(productId) {
    setMessage("");
    try {
      await api.post(`/orders/${activeOrder.sale_id}/items`, { product_id: productId, quantity: 1 });
      const res = await api.get(`/orders/${activeOrder.sale_id}`);
      setActiveOrder(res.data);
    } catch (err) {
      setMessage(err.response?.data?.message || "Could not add item.");
    }
  }

  async function reassignServer(serverId) {
    setMessage("");
    try {
      await api.put(`/orders/${activeOrder.sale_id}/server`, { server_id: serverId });
      const res = await api.get(`/orders/${activeOrder.sale_id}`);
      setActiveOrder(res.data);
      loadOpenOrders();
    } catch (err) {
      setMessage(err.response?.data?.message || "Could not reassign.");
    }
  }

  async function closeBill(paymentMethod) {
    await api.post(`/orders/${activeOrder.sale_id}/close`, { payment_method: paymentMethod });
    setClosedReceipt({
      sale_id: activeOrder.sale_id,
      dateTime: new Date().toISOString(),
      items: activeOrder.items,
      totalAmount: activeOrder.total_amount,
      paymentMethod,
      tableNumber: activeOrder.table_number,
      serverName: activeOrder.server_name,
      cashierName: activeOrder.cashier_name,
    });
    setActiveOrder(null);
    loadOpenOrders();
    const res = await api.get(`/products/branch/${branchId}`);
    setProducts(res.data);
  }

  if (closedReceipt) {
    return (
      <div>
        <h1>Bill Closed</h1>
        <Receipt
          businessName="Hebrews Urgencies"
          branchName={branchName || ""}
          saleId={closedReceipt.sale_id}
          dateTime={closedReceipt.dateTime}
          items={closedReceipt.items}
          totalAmount={closedReceipt.totalAmount}
          paymentMethod={closedReceipt.paymentMethod}
          tableNumber={closedReceipt.tableNumber}
          serverName={closedReceipt.serverName}
          cashierName={closedReceipt.cashierName}
          onClose={() => setClosedReceipt(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <h1>{branchName} — Table Orders</h1>
      <div className="subtitle">Open a table, add dishes as they're ordered, close the bill when the table pays</div>

      {!activeOrder && (
        <>
          <form onSubmit={openTable} style={{ display: "flex", gap: 8, maxWidth: 460, marginBottom: 8, flexWrap: "wrap" }}>
            <input
              style={{ flex: 1, minWidth: 140 }}
              placeholder="Table number e.g. 4"
              value={newTableNumber}
              onChange={(e) => setNewTableNumber(e.target.value)}
            />
            <select style={{ flex: 1, minWidth: 160 }} value={selectedServer} onChange={(e) => setSelectedServer(e.target.value)} required>
              <option value="">Served by…</option>
              {signedInServers.map((s) => <option key={s.server_id} value={s.server_id}>{s.full_name}</option>)}
            </select>
            <button className="btn" type="submit" style={{ width: "auto" }}>Open Table</button>
          </form>
          {signedInServers.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>
              No staff signed in yet — sign someone in on the Staff Sign In page first.
            </p>
          )}
          {message && <p style={{ color: "var(--danger)", fontSize: 13 }}>{message}</p>}

          <h2>Open Tables</h2>
          {openOrders.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>No open tables right now.</p>
          ) : (
            <div className="product-tiles">
              {openOrders.map((o) => (
                <button key={o.sale_id} className="product-tile" onClick={() => viewOrder(o.sale_id)}>
                  <div className="name">Table {o.table_number}</div>
                  <div className="price">KSh {Number(o.total_amount).toLocaleString()} so far</div>
                  {o.server_name && <div style={{ fontSize: 11, color: "var(--muted)" }}>{o.server_name}</div>}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {activeOrder && (
        <div>
          <button className="btn" style={{ width: "auto", background: "#ddd6c9", color: "#333", marginBottom: 20 }} onClick={() => setActiveOrder(null)}>
            ← Back to tables
          </button>

          {message && <p style={{ color: "var(--danger)", fontSize: 13 }}>{message}</p>}

          <div className="pos-grid">
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <h2 style={{ marginTop: 0, marginBottom: 0 }}>Table {activeOrder.table_number} — Add Items</h2>
                <div className="field" style={{ margin: 0, width: 180 }}>
                  <label style={{ fontSize: 11 }}>Served by</label>
                  <select value={activeOrder.server_id || ""} onChange={(e) => reassignServer(e.target.value)}>
                    <option value="">Unassigned</option>
                    {signedInServers.map((s) => <option key={s.server_id} value={s.server_id}>{s.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="product-tiles">
                {products.map((p) => (
                  <button key={p.product_id} className="product-tile" onClick={() => addItem(p.product_id)}>
                    <div className="name">{p.product_name}</div>
                    <div className="price">KSh {Number(p.unit_price).toLocaleString()}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="cart">
              <h2 style={{ marginTop: 0 }}>Running Bill</h2>
              {activeOrder.items.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No items yet.</p>}
              {activeOrder.items.map((item, i) => (
                <div className="cart-line" key={i}>
                  <span>{item.product_name} × {item.quantity}</span>
                  <span>KSh {Number(item.subtotal).toLocaleString()}</span>
                </div>
              ))}
              <div className="cart-total">
                <span>Total</span>
                <span>KSh {Number(activeOrder.total_amount).toLocaleString()}</span>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button className="btn" onClick={() => closeBill("cash")}>Close — Cash</button>
                <button className="btn" onClick={() => closeBill("mpesa_till")}>Close — Till</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
