import { useEffect, useState } from "react";
import api, { downloadFile } from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Inventory() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(user?.branch_id || "");
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [topUpTarget, setTopUpTarget] = useState(null); // product being manually topped up (no cost)
  const [topUpQuantity, setTopUpQuantity] = useState("");
  const [topUpMessage, setTopUpMessage] = useState(null);

  // Manually add a product you have on display to sell — just a name, plus
  // an optional packaging note (e.g. "500g packet", "tray of 6"). No
  // separate category field; packaging covers that need.
  const emptyNewProduct = { product_name: "", package_description: "", unit: "piece", unit_price: "", reorder_level: 5 };
  const [newProduct, setNewProduct] = useState(emptyNewProduct);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [addMessage, setAddMessage] = useState(null);
  const canAddProduct = ["owner", "manager"].includes(user.role);

  async function submitNewProduct(e) {
    e.preventDefault();
    setAddMessage(null);
    try {
      await api.post("/products", { ...newProduct, branch_id: selectedBranch, current_stock: 0 });
      setAddMessage({ type: "success", text: `${newProduct.product_name} added.` });
      setNewProduct(emptyNewProduct);
      setShowAddProduct(false);
      const prodRes = await api.get(`/products/branch/${selectedBranch}`);
      setProducts(prodRes.data);
    } catch (err) {
      setAddMessage({ type: "error", text: err.response?.data?.message || "Could not add product." });
    }
  }

  const selectedBranchType = branches.find((b) => b.branch_id === Number(selectedBranch))?.branch_type
    || user.branch_type;
  // A branch manager can bulk-restock their own branch's stock this way
  // too now, not just the owner — the backend branch-scopes it so a
  // manager can only ever import into their own (or linked) branch.
  const canImport = ["owner", "manager"].includes(user.role) && (selectedBranchType === "bakery" || selectedBranchType === "restaurant");

  async function submitTopUp(e) {
    e.preventDefault();
    setTopUpMessage(null);
    try {
      await api.post(`/products/${topUpTarget.product_id}/top-up`, { quantity: Number(topUpQuantity) });
      setTopUpMessage({ type: "success", text: `${topUpTarget.product_name} topped up by ${topUpQuantity}${topUpTarget.unit} — no expense logged.` });
      setTopUpTarget(null);
      setTopUpQuantity("");
      const prodRes = await api.get(`/products/branch/${selectedBranch}`);
      setProducts(prodRes.data);
    } catch (err) {
      setTopUpMessage({ type: "error", text: err.response?.data?.message || "Top-up failed." });
    }
  }

  async function submitImport(e) {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await api.post(`/exports/inventory/branch/${selectedBranch}/import`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportResult({ type: "success", data: res.data });
      setImportFile(null);
      const prodRes = await api.get(`/products/branch/${selectedBranch}`);
      setProducts(prodRes.data);
    } catch (err) {
      setImportResult({ type: "error", message: err.response?.data?.message || "Import failed." });
    } finally {
      setImporting(false);
    }
  }

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

  useEffect(() => {
    if (selectedBranch) {
      api.get(`/products/branch/${selectedBranch}`).then((res) => setProducts(res.data));
    }
  }, [selectedBranch]);

  return (
    <div>
      <h1>Inventory{user.role !== "owner" ? ` — ${user.branch_name}` : ""}</h1>
      <div className="subtitle">Live stock levels for {user.role === "owner" || user.linked_branch_id ? "the selected branch" : "your branch"}</div>

      {(user.role === "owner" || user.linked_branch_id) && (
        <div className="field" style={{ maxWidth: 300, marginBottom: 20 }}>
          <label>Branch</label>
          <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
            {branches.map((b) => (
              <option key={b.branch_id} value={b.branch_id}>{b.branch_name} ({b.branch_type})</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <button
          className="btn"
          style={{ width: "auto" }}
          onClick={() => downloadFile(`/exports/inventory/branch/${selectedBranch}`, "inventory.xlsx")}
          disabled={!selectedBranch}
        >
          Download this branch (Excel)
        </button>
        {user.role === "owner" && (
          <button
            className="btn"
            style={{ width: "auto", background: "#ddd6c9", color: "#333" }}
            onClick={() => downloadFile("/exports/inventory/all", "inventory_all_branches.xlsx")}
          >
            Download ALL branches (Excel)
          </button>
        )}
        {canAddProduct && (
          <button
            className="btn"
            style={{ width: "auto" }}
            onClick={() => { setShowAddProduct((v) => !v); setAddMessage(null); }}
            disabled={!selectedBranch}
          >
            {showAddProduct ? "Cancel" : "+ Add Product"}
          </button>
        )}
      </div>

      {addMessage && (
        <p style={{ color: addMessage.type === "success" ? "var(--success)" : "var(--danger)", fontSize: 13 }}>
          {addMessage.text}
        </p>
      )}

      {showAddProduct && (
        <form onSubmit={submitNewProduct} className="stat-card" style={{ maxWidth: 420, marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>Add a Product</h2>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            For something you have on display to sell. Packaging is optional — only fill it in if it helps
            tell items apart (e.g. "500g packet").
          </p>
          <div className="field">
            <label>Name</label>
            <input required value={newProduct.product_name} onChange={(e) => setNewProduct({ ...newProduct, product_name: e.target.value })} />
          </div>
          <div className="field">
            <label>Packaging (optional)</label>
            <input
              placeholder='e.g. "500g packet", "tray of 6"'
              value={newProduct.package_description}
              onChange={(e) => setNewProduct({ ...newProduct, package_description: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Unit</label>
            <select value={newProduct.unit} onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}>
              <option value="piece">piece</option>
              <option value="kg">kg</option>
              <option value="plate">plate</option>
              <option value="batch">batch</option>
              <option value="packet">packet</option>
            </select>
          </div>
          <div className="field">
            <label>Selling Price (KSh)</label>
            <input type="number" step="0.01" min="0" required value={newProduct.unit_price} onChange={(e) => setNewProduct({ ...newProduct, unit_price: e.target.value })} />
          </div>
          <div className="field">
            <label>Reorder Level (optional)</label>
            <input type="number" step="0.1" min="0" value={newProduct.reorder_level} onChange={(e) => setNewProduct({ ...newProduct, reorder_level: e.target.value })} />
          </div>
          <button className="btn" type="submit">Add Product</button>
        </form>
      )}

      {canImport && (
        <div className="stat-card" style={{ maxWidth: 480, marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>Import Stock from Excel</h2>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            File needs columns: <code>item_name</code>, <code>type</code> (product or ingredient),
            <code> quantity</code>, and optionally <code>total_cost</code> — giving a cost logs it as a Raw
            Materials expense automatically, same as a manual restock. The item must already exist in this
            branch; this tops it up, it doesn't create new items.
          </p>
          <form onSubmit={submitImport} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setImportFile(e.target.files[0])}
            />
            <button className="btn" type="submit" style={{ width: "auto" }} disabled={!importFile || importing}>
              {importing ? "Importing..." : "Import"}
            </button>
          </form>
          {importResult?.type === "success" && (
            <p style={{ color: "var(--success)", fontSize: 13, marginTop: 10 }}>
              {importResult.data.message}
              {importResult.data.skipped?.length > 0 && (
                <span style={{ display: "block", color: "var(--danger)", marginTop: 4 }}>
                  Skipped rows: {importResult.data.skipped.map((s) => `#${s.row} (${s.reason})`).join("; ")}
                </span>
              )}
            </p>
          )}
          {importResult?.type === "error" && (
            <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{importResult.message}</p>
          )}
        </div>
      )}

      {topUpMessage && (
        <p style={{ color: topUpMessage.type === "success" ? "var(--success)" : "var(--danger)", fontSize: 13 }}>
          {topUpMessage.text}
        </p>
      )}

      <table>
        <thead>
          <tr><th>Product</th><th>Packaging</th><th>Stock</th><th>Unit Price</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const isLow = Number(p.current_stock) <= Number(p.reorder_level);
            return (
              <tr key={p.product_id}>
                <td>{p.product_name}</td>
                <td>{p.package_description || "—"}</td>
                <td>{p.current_stock} {p.unit}</td>
                <td>KSh {Number(p.unit_price).toLocaleString()}</td>
                <td><span className={`badge ${isLow ? "low" : "ok"}`}>{isLow ? "Low Stock" : "OK"}</span></td>
                <td>
                  <button
                    className="btn"
                    style={{ width: "auto", padding: "6px 12px", fontSize: 12, background: "#ddd6c9", color: "#333" }}
                    onClick={() => { setTopUpTarget(p); setTopUpMessage(null); }}
                  >
                    Top Up
                  </button>
                </td>
              </tr>
            );
          })}
          {products.length === 0 && (
            <tr><td colSpan="6" style={{ color: "var(--muted)" }}>No products recorded yet.</td></tr>
          )}
        </tbody>
      </table>

      {topUpTarget && (
        <div className="card-grid" style={{ maxWidth: 420, marginTop: 24 }}>
          <form onSubmit={submitTopUp} className="stat-card">
            <h2 style={{ marginTop: 0 }}>Top Up {topUpTarget.product_name}</h2>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>
              No cost, no expense — just marks more as ready (e.g. "a fresh tray of cakes is ready, +10").
            </p>
            <div className="field">
              <label>Quantity ready ({topUpTarget.unit})</label>
              <input
                type="number" step="0.1" min="0.1" required
                value={topUpQuantity}
                onChange={(e) => setTopUpQuantity(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" type="submit">Confirm Top Up</button>
              <button
                type="button"
                className="btn"
                style={{ background: "#ddd6c9", color: "#333" }}
                onClick={() => setTopUpTarget(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
