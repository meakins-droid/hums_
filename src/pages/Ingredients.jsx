import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Ingredients() {
  const { user } = useAuth();
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
  const [ingredients, setIngredients] = useState([]);
  const [newIngredient, setNewIngredient] = useState({ ingredient_name: "", unit: "kg", current_stock: 0, unit_cost: "", reorder_level: "" });
  const [restockTarget, setRestockTarget] = useState(null); // ingredient being restocked
  const [restockForm, setRestockForm] = useState({ quantity: "", total_cost: "" });
  const [message, setMessage] = useState(null);

  useEffect(() => {
    // Owner sees a full branch picker; a merged login (butchery+hotel) also
    // gets one, scoped to their two linked branches, so they can flip
    // between the two businesses' ingredients without switching accounts.
    if (user.role === "owner" || user.linked_branch_id) {
      api.get("/branches").then((res) => {
        const producing = res.data.filter((b) => ["bakery", "restaurant", "butchery"].includes(b.branch_type));
        setBranches(producing);
        if (user.role === "owner" && producing.length > 0) setSelectedBranch(producing[0].branch_id);
      });
    }
  }, [user]);

  function loadIngredients(branchId) {
    if (!branchId) return;
    api.get(`/ingredients/branch/${branchId}`).then((res) => setIngredients(res.data));
  }

  useEffect(() => { loadIngredients(selectedBranch); }, [selectedBranch]);

  async function addIngredient(e) {
    e.preventDefault();
    setMessage(null);
    try {
      await api.post("/ingredients", { ...newIngredient, branch_id: selectedBranch });
      setNewIngredient({ ingredient_name: "", unit: "kg", current_stock: 0, unit_cost: "", reorder_level: "" });
      loadIngredients(selectedBranch);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to add ingredient." });
    }
  }

  async function submitRestock(e) {
    e.preventDefault();
    setMessage(null);
    try {
      await api.post(`/ingredients/${restockTarget.ingredient_id}/restock`, {
        quantity: Number(restockForm.quantity),
        total_cost: Number(restockForm.total_cost),
      });
      setMessage({ type: "success", text: `Restocked ${restockTarget.ingredient_name} — expense logged automatically.` });
      setRestockTarget(null);
      setRestockForm({ quantity: "", total_cost: "" });
      loadIngredients(selectedBranch);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Restock failed." });
    }
  }

  return (
    <div>
      <h1>Ingredients</h1>


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

      {message && (
        <p style={{ color: message.type === "success" ? "var(--success)" : "var(--danger)", fontSize: 13 }}>
          {message.text}
        </p>
      )}

      <table style={{ marginBottom: 28 }}>
        <thead><tr><th>Ingredient</th><th>Stock</th><th>Unit Cost</th><th>Reorder Level</th><th></th></tr></thead>
        <tbody>
          {ingredients.map((ing) => {
            const isLow = Number(ing.current_stock) <= Number(ing.reorder_level);
            return (
              <tr key={ing.ingredient_id}>
                <td>{ing.ingredient_name}</td>
                <td>
                  {ing.current_stock} {ing.unit}{" "}
                  {isLow && <span className="badge low">Low</span>}
                </td>
                <td>KSh {Number(ing.unit_cost).toLocaleString()}/{ing.unit}</td>
                <td>{ing.reorder_level} {ing.unit}</td>
                <td>
                  <button
                    className="btn"
                    style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}
                    onClick={() => { setRestockTarget(ing); setMessage(null); }}
                  >
                    Restock
                  </button>
                </td>
              </tr>
            );
          })}
          {ingredients.length === 0 && (
            <tr><td colSpan="5" style={{ color: "var(--muted)" }}>No ingredients recorded yet.</td></tr>
          )}
        </tbody>
      </table>

      {restockTarget && (
        <div className="card-grid" style={{ maxWidth: 420, marginBottom: 32 }}>
          <form onSubmit={submitRestock} className="stat-card">
            <h2 style={{ marginTop: 0 }}>Restock {restockTarget.ingredient_name}</h2>
            <div className="field">
              <label>Quantity purchased ({restockTarget.unit})</label>
              <input
                type="number" step="0.1" min="0.1" required
                value={restockForm.quantity}
                onChange={(e) => setRestockForm({ ...restockForm, quantity: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Total amount paid (KSh)</label>
              <input
                type="number" step="0.01" min="0" required
                value={restockForm.total_cost}
                onChange={(e) => setRestockForm({ ...restockForm, total_cost: e.target.value })}
              />
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>
              This will be logged as a Raw Materials expense for this branch automatically.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" type="submit">Confirm Restock</button>
              <button
                type="button"
                className="btn"
                style={{ background: "#ddd6c9", color: "#333" }}
                onClick={() => setRestockTarget(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <h2>Add New Ingredient</h2>
      <form onSubmit={addIngredient} style={{ maxWidth: 420 }}>
        <div className="field">
          <label>Name</label>
          <input
            value={newIngredient.ingredient_name}
            onChange={(e) => setNewIngredient({ ...newIngredient, ingredient_name: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label>Unit</label>
          <select
            value={newIngredient.unit}
            onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
          >
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="litre">litre</option>
            <option value="ml">ml</option>
            <option value="piece">piece</option>
            <option value="serving">serving</option>
          </select>
        </div>
        <div className="field">
          <label>Starting Stock</label>
          <input
            type="number" step="0.1"
            value={newIngredient.current_stock}
            onChange={(e) => setNewIngredient({ ...newIngredient, current_stock: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Unit Cost (KSh)</label>
          <input
            type="number" step="0.01" required
            value={newIngredient.unit_cost}
            onChange={(e) => setNewIngredient({ ...newIngredient, unit_cost: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Reorder Level</label>
          <input
            type="number" step="0.1"
            value={newIngredient.reorder_level}
            onChange={(e) => setNewIngredient({ ...newIngredient, reorder_level: e.target.value })}
          />
        </div>
        <button className="btn" type="submit">Add Ingredient</button>
      </form>
    </div>
  );
}
