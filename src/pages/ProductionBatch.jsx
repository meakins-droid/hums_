import { Fragment, useEffect, useState } from "react";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProductionBatch() {
  const { user } = useAuth();
  // A merged login's OWN branch_type is the butchery; the restaurant/bakery
  // side (the one that actually produces things) only shows up via
  // linked_branch_type. Checking branch_type alone here was blocking every
  // merged butchery+hotel manager out of Production Batch entirely, even
  // though the sidebar correctly showed the link.
  const branchTypes = [user.branch_type, user.linked_branch_type].filter(Boolean);
  const blocked = user.role !== "owner" && !branchTypes.includes("restaurant") && !branchTypes.includes("bakery");
  // For a merged login (own branch_type is the butchery, the restaurant/
  // bakery side only exists via linked_branch_type), default straight to
  // whichever of the two actually produces things — not the raw branch_id,
  // which for a merged account is the butchery and has neither recipes nor
  // ingredients. Falls back to branch_id for anyone not merged.
  const defaultProducingBranch = ["restaurant", "bakery"].includes(user.branch_type)
    ? user.branch_id
    : ["restaurant", "bakery"].includes(user.linked_branch_type)
    ? user.linked_branch_id
    : (user.branch_id || "");
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(user.role === "owner" ? "" : defaultProducingBranch);
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState("");
  const [batchesProduced, setBatchesProduced] = useState(1);
  // Overrides keyed by ingredient_id — the recipe's proportion is the
  // default, but what actually went into the mix today can differ (recipe
  // says 2kg, 4kg actually used). Empty/untouched means "use the default."
  const [actualQuantities, setActualQuantities] = useState({});
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState(null);
  const [closeOutTarget, setCloseOutTarget] = useState(null);
  const [detail, setDetail] = useState(null); // { batch, ingredients } for the batch currently expanded
  const [detailLoading, setDetailLoading] = useState(null); // batch_id currently being fetched

  async function viewDetails(batchId) {
    if (detail?.batch?.batch_id === batchId) { setDetail(null); return; } // toggle closed
    setDetailLoading(batchId);
    try {
      const res = await api.get(`/production/batches/${batchId}/ingredients`);
      setDetail(res.data);
    } finally {
      setDetailLoading(null);
    }
  }
  const [soldQty, setSoldQty] = useState("");
  const [wasteTarget, setWasteTarget] = useState(null);
  const [wasteForm, setWasteForm] = useState({ quantity: "", reason: "" });
  const [showLifecycle, setShowLifecycle] = useState(false);

  useEffect(() => {
    // Owner sees a full branch picker; a merged login (butchery+hotel) also
    // gets one, scoped to their two linked branches.
    if (user.role === "owner" || user.linked_branch_id) {
      api.get("/branches").then((res) => {
        const producing = res.data.filter((b) => b.branch_type === "bakery" || b.branch_type === "restaurant");
        setBranches(producing);
        if (user.role === "owner" && producing.length > 0) setSelectedBranch(producing[0].branch_id);
      });
    }
  }, [user]);

  function loadRecipesAndHistory(branchId) {
    if (!branchId) return;
    api.get(`/recipes/branch/${branchId}`).then((res) => {
      setRecipes(res.data);
      setSelectedRecipe(res.data[0]?.recipe_id || "");
    });
    api.get(`/production/branch/${branchId}`).then((res) => setHistory(res.data));
  }

  useEffect(() => {
    loadRecipesAndHistory(selectedBranch);
  }, [selectedBranch]);

  const activeRecipe = recipes.find((r) => r.recipe_id === Number(selectedRecipe));
  const projectedYield = activeRecipe ? activeRecipe.yield_quantity * Number(batchesProduced || 0) : 0;
  const anyIngredientShort = activeRecipe?.ingredients.some((ing) => {
    const defaultQty = Number(ing.quantity_required) * Number(batchesProduced || 0);
    const override = actualQuantities[ing.ingredient_id];
    const used = override !== undefined && override !== "" ? Number(override) : defaultQty;
    return Number(ing.current_stock) - used < 0;
  }) || false;

  // The hotel's Production Batch stays exactly as it was — this live stock
  // panel (what's in stock, what this batch uses, what's left for the next
  // restock) is specifically for the bakeries' accountability flow.
  const selectedBranchType = branches.find((b) => b.branch_id === Number(selectedBranch))?.branch_type || user.branch_type;
  const showBakeryStockPanel = selectedBranchType === "bakery";

  async function submitBatch(e) {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await api.post("/production/batches", {
        recipe_id: selectedRecipe,
        branch_id: selectedBranch,
        batches_produced: Number(batchesProduced),
        actual_quantities: actualQuantities,
      });
      setMessage({
        type: "success",
        text: `Batch #${res.data.batch_number} logged: ${res.data.outputs.map((o) => `${o.quantity} ${o.name}`).join(", ")}. Ingredient cost KSh ${Number(res.data.total_ingredient_cost).toFixed(2)} (KSh ${res.data.cost_per_unit} per unit).`,
      });
      setActualQuantities({});
      loadRecipesAndHistory(selectedBranch);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to log production batch." });
    }
  }

  async function submitCloseOut(e) {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await api.put(`/production/batches/${closeOutTarget.batch_id}/close-out`, {
        quantity_sold: Number(soldQty),
      });
      const d = res.data;
      setMessage({
        type: "success",
        text: `Reconciled: ${d.quantity_sold} sold, ${d.quantity_waste} total waste (${d.already_logged_waste} of that already logged earlier). Revenue KSh ${Number(d.revenue).toLocaleString()} against cost KSh ${Number(d.ingredient_cost).toLocaleString()} — ${d.profit >= 0 ? "profit" : "loss"} of KSh ${Math.abs(d.profit).toLocaleString()}.`,
      });
      setCloseOutTarget(null);
      setSoldQty("");
      loadRecipesAndHistory(selectedBranch);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Reconciliation failed." });
    }
  }

  async function submitWaste(e) {
    e.preventDefault();
    setMessage(null);
    try {
      await api.post(`/production/batches/${wasteTarget.batch_id}/waste`, {
        quantity: Number(wasteForm.quantity),
        reason: wasteForm.reason || undefined,
      });
      setMessage({ type: "success", text: `${wasteForm.quantity} units logged as waste for batch #${wasteTarget.batch_number}.` });
      setWasteTarget(null);
      setWasteForm({ quantity: "", reason: "" });
      loadRecipesAndHistory(selectedBranch);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to log waste." });
    }
  }

  if (blocked) {
    return (
      <div>
        <h1>Production Batch</h1>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Not used at a butchery — meat is sold as-is, nothing is produced here. Use the counter POS instead.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>Production Batch</h1>
      <div className="subtitle">Pick the product, say how many batches were made — ingredients deduct and stock updates automatically</div>
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 380px", minWidth: 320 }}>

      {(user.role === "owner" || user.linked_branch_id) && (
        <div className="field" style={{ maxWidth: 320, marginBottom: 20 }}>
          <label>Branch</label>
          <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
            {branches.map((b) => (
              <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
            ))}
          </select>
        </div>
      )}

      {recipes.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          No recipes exist yet for this branch. A recipe (Bill of Materials) needs to be defined for a product before
          you can log a production batch against it.
        </p>
      ) : (
        <form onSubmit={submitBatch} style={{ maxWidth: 420, marginBottom: 32 }}>
          {message && (
            <p style={{ color: message.type === "success" ? "var(--success)" : "var(--danger)", fontSize: 13 }}>
              {message.text}
            </p>
          )}

          <div className="field">
            <label>Recipe</label>
            <select value={selectedRecipe} onChange={(e) => { setSelectedRecipe(e.target.value); setActualQuantities({}); }}>
              {recipes.map((r) => (
                <option key={r.recipe_id} value={r.recipe_id}>
                  {r.recipe_name}: {r.outputs.map((o) => `${o.quantity} ${o.name}`).join(", ")} per batch
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>How many batches produced today?</label>
            <input
              type="number"
              min="1"
              step="1"
              value={batchesProduced}
              onChange={(e) => setBatchesProduced(e.target.value)}
              required
            />
          </div>

          {activeRecipe && (
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
              This will add to stock:{" "}
              {activeRecipe.outputs.map((o, i) => (
                <span key={i}><strong>{o.quantity * Number(batchesProduced || 0)} {o.unit}</strong> of <strong>{o.name}</strong>{i < activeRecipe.outputs.length - 1 ? ", " : ""}</span>
              ))}
              , and deduct the ingredients accordingly.
            </p>
          )}

          <button className="btn" type="submit">Log Production Batch</button>
        </form>
      )}

      {closeOutTarget && (
        <div className="card-grid" style={{ maxWidth: 440, marginBottom: 28 }}>
          <form onSubmit={submitCloseOut} className="stat-card">
            <h2 style={{ marginTop: 0 }}>Reconcile batch #{closeOutTarget.batch_number}</h2>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>
              Produced {closeOutTarget.quantity_produced}
              {Number(closeOutTarget.total_waste_logged) > 0 && ` (${closeOutTarget.total_waste_logged} already logged as waste)`}.
              Enter how many actually sold — whatever's left over is recorded as waste and cleared from stock,
              so this batch doesn't linger as phantom inventory once it's done for.
            </p>
            <div className="field">
              <label>Quantity sold</label>
              <input
                type="number" step="0.1" min="0" max={closeOutTarget.quantity_produced} required
                value={soldQty}
                onChange={(e) => setSoldQty(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" type="submit">Confirm reconciliation</button>
              <button
                type="button"
                className="btn"
                style={{ background: "#ddd6c9", color: "#333" }}
                onClick={() => setCloseOutTarget(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {wasteTarget && (
        <div className="card-grid" style={{ maxWidth: 440, marginBottom: 28 }}>
          <form onSubmit={submitWaste} className="stat-card">
            <h2 style={{ marginTop: 0 }}>Log waste — batch #{wasteTarget.batch_number}</h2>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>
              For a partial loss right now (e.g. some of this batch has gone past its 84-hour mark) — not a
              full end-of-day reconciliation. You can log this as many times as needed for one batch.
            </p>
            <div className="field">
              <label>Quantity wasted</label>
              <input
                type="number" step="0.1" min="0.1" required
                value={wasteForm.quantity}
                onChange={(e) => setWasteForm({ ...wasteForm, quantity: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Reason (optional)</label>
              <input
                type="text" placeholder="e.g. gone stale, dropped, burnt"
                value={wasteForm.reason}
                onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" type="submit">Log waste</button>
              <button
                type="button"
                className="btn"
                style={{ background: "#ddd6c9", color: "#333" }}
                onClick={() => setWasteTarget(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      </div>

      {showBakeryStockPanel && (
        <div className="stat-card" style={{ flex: "1 1 320px", minWidth: 300, maxWidth: 420 }}>
          <h2 style={{ marginTop: 0 }}>Ingredient Stock — This Batch</h2>
          {!activeRecipe ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Pick a recipe on the left to see live stock numbers here.</p>
          ) : (
            <table style={{ fontSize: 13 }}>
              <thead>
                <tr><th>Ingredient</th><th>In stock</th><th>Used now</th><th>Remains</th></tr>
              </thead>
              <tbody>
                {activeRecipe.ingredients.map((ing) => {
                  const defaultQty = Number(ing.quantity_required) * Number(batchesProduced || 0);
                  const override = actualQuantities[ing.ingredient_id];
                  const used = override !== undefined && override !== "" ? Number(override) : defaultQty;
                  const remains = Number(ing.current_stock) - used;
                  const isOverridden = override !== undefined && override !== "" && Number(override) !== defaultQty;
                  return (
                    <tr key={ing.ingredient_id}>
                      <td>{ing.ingredient_name}</td>
                      <td>{Number(ing.current_stock)} {ing.unit}</td>
                      <td>
                        <input
                          type="number" min="0" step="0.001"
                          value={override !== undefined ? override : String(defaultQty)}
                          onChange={(e) => setActualQuantities({ ...actualQuantities, [ing.ingredient_id]: e.target.value })}
                          style={{ width: 70, fontSize: 13, padding: "2px 6px", border: isOverridden ? "1px solid var(--accent)" : "1px solid #d9d2c5" }}
                        />
                        <span style={{ marginLeft: 4 }}>{ing.unit}</span>
                        {isOverridden && <div style={{ fontSize: 10, color: "var(--accent)" }}>recipe says {defaultQty}</div>}
                      </td>
                      <td style={{ color: remains < 0 ? "var(--danger)" : "inherit", fontWeight: 500 }}>
                        {remains} {ing.unit}
                        {remains < 0 && <div style={{ fontSize: 10, fontWeight: 400 }}>won't submit — not enough in stock</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {activeRecipe && (
            <>
              <h3 style={{ marginBottom: 6 }}>What this batch produces</h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {activeRecipe.outputs.map((o, i) => (
                  <li key={i}>{o.quantity * Number(batchesProduced || 0)} {o.unit} of {o.name}</li>
                ))}
              </ul>
            </>
          )}
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 12 }}>
            "Remains" is what's left in stock for the next restocking once this batch is logged.
          </p>
        </div>
      )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Recent Production</h2>
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={showLifecycle} onChange={(e) => setShowLifecycle(e.target.checked)} />
          Show batch #, expiry &amp; waste tools
        </label>
      </div>

      <table>
        <thead>
          <tr>
            {showLifecycle && <th>Batch #</th>}
            <th>Date</th><th>Recipe</th><th>Produced</th><th>Sold</th><th>Waste</th>
            <th>Ingredient Cost</th><th>Profit</th>
            {showLifecycle && <th>Expiry</th>}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {history.map((h) => {
            const profit = h.closed_out ? Number(h.revenue) - Number(h.total_ingredient_cost) : null;
            return (
              <Fragment key={h.batch_id}>
              <tr>
                {showLifecycle && <td>#{h.batch_number}</td>}
                <td>{new Date(h.production_date).toLocaleDateString()}</td>
                <td>{h.output_name || h.recipe_name}</td>
                <td>{h.quantity_produced}</td>
                <td>{h.closed_out ? h.quantity_sold : "—"}</td>
                <td>{h.closed_out ? h.quantity_waste : (Number(h.total_waste_logged) > 0 ? `${h.total_waste_logged} (partial)` : "—")}</td>
                <td>KSh {Number(h.total_ingredient_cost).toLocaleString()}</td>
                <td style={{ color: profit == null ? "var(--muted)" : profit >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {profit == null ? "—" : `KSh ${profit.toLocaleString()}`}
                </td>
                {showLifecycle && (
                  <td>
                    {h.is_expired ? (
                      <span className="badge low">Past 84h</span>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        {new Date(h.expires_at).toLocaleString([], { timeZone: "Africa/Nairobi" })}
                      </span>
                    )}
                  </td>
                )}
                <td style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn"
                    style={{ width: "auto", padding: "6px 10px", fontSize: 12, background: "#ddd6c9", color: "#333" }}
                    onClick={() => viewDetails(h.batch_id)}
                  >
                    {detailLoading === h.batch_id ? "Loading…" : "Details"}
                  </button>
                  {showLifecycle && h.product_id && (
                    <button
                      className="btn"
                      style={{ width: "auto", padding: "6px 10px", fontSize: 12, background: "#ddd6c9", color: "#333" }}
                      onClick={() => { setWasteTarget(h); setWasteForm({ quantity: "", reason: "" }); setMessage(null); }}
                    >
                      Log waste
                    </button>
                  )}
                  {!h.closed_out && h.product_id && (
                    <button
                      className="btn"
                      style={{ width: "auto", padding: "6px 10px", fontSize: 12 }}
                      onClick={() => { setCloseOutTarget(h); setSoldQty(""); setMessage(null); }}
                    >
                      Reconcile
                    </button>
                  )}
                </td>
              </tr>
              {detail?.batch?.batch_id === h.batch_id ? (
                <tr>
                  <td colSpan={showLifecycle ? "10" : "8"} style={{ background: "var(--surface-2, #f7f4ee)", padding: 16 }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>Batch #{detail.batch.batch_number}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                      Recorded {new Date(detail.batch.produced_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" })} by {detail.batch.produced_by_name}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Ingredients used</div>
                    <table style={{ maxWidth: 420, marginBottom: 12 }}>
                      <thead><tr><th>Ingredient</th><th>Quantity used</th></tr></thead>
                      <tbody>
                        {detail.ingredients.map((ing) => (
                          <tr key={ing.ingredient_id}><td>{ing.ingredient_name}</td><td>{Number(ing.quantity_used)} {ing.unit}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Products made</div>
                    <div style={{ fontSize: 13, marginBottom: 8 }}>{detail.batch.quantity_produced} {detail.batch.output_unit} of {detail.batch.output_name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      This is the exact mix used for this batch, snapshotted at the moment it was made — useful for a physical stock count afterwards, since it won't drift even if the recipe is edited later.
                    </div>
                  </td>
                </tr>
              ) : null}
              </Fragment>
            );
          })}
          {history.length === 0 && (
            <tr><td colSpan={showLifecycle ? "10" : "8"} style={{ color: "var(--muted)" }}>No production batches logged yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
