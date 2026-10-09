import { useEffect, useState } from "react";
import api, { downloadFile } from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

// The recipe book. A recipe is ONE proportion mix (the ingredients, taken from
// what is in this branch's stock) plus ONE product that one batch of that mix
// makes. Written once here; after that a baker only says "I made 2 batches"
// on Production Batch. The same ingredient can appear in as many different
// recipes as needed — that's already just how recipe_ingredients works.
export default function Recipes() {
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
  const [recipes, setRecipes] = useState([]);
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [message, setMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const canImport = ["owner", "manager"].includes(user.role);

  async function submitImport(e) {
    e.preventDefault();
    if (!importFile || !selectedBranch) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await api.post(`/exports/recipes/branch/${selectedBranch}/import`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportResult({ type: "success", data: res.data });
      setImportFile(null);
      load(selectedBranch);
    } catch (err) {
      setImportResult({ type: "error", message: err.response?.data?.message || "Import failed." });
    } finally {
      setImporting(false);
    }
  }

  const emptyLine = { ingredient_id: "", packs: "", each: "", quantity_required: "" };
  // One recipe, one product — the same ingredient (e.g. Wheat Flour) can
  // still be reused across as many different recipes as you like; that was
  // always true and still is. What changed is a single recipe no longer
  // tries to produce several different products at once, which was more
  // confusing than useful in practice.
  const emptyForm = { recipe_name: "", output: "", quantity: "", lines: [{ ...emptyLine }] };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    // Owner sees a full branch picker; a merged login (butchery+hotel) also
    // gets one, scoped to their two linked branches.
    if (user.role === "owner" || user.linked_branch_id) {
      api.get("/branches").then((res) => {
        const producing = res.data.filter((b) => ["bakery", "restaurant"].includes(b.branch_type));
        setBranches(producing);
        if (user.role === "owner" && producing.length > 0) setSelectedBranch(producing[0].branch_id);
      });
    }
  }, [user]);

  function load(branchId) {
    if (!branchId) return;
    api.get(`/recipes/branch/${branchId}`).then((res) => setRecipes(res.data));
    api.get(`/products/branch/${branchId}`).then((res) => setProducts(res.data));
    api.get(`/ingredients/branch/${branchId}`).then((res) => setIngredients(res.data));
  }
  useEffect(() => { cancelEdit(); load(selectedBranch); }, [selectedBranch]);

  // Encoded as "product:12" / "ingredient:4".
  const outputOptions = [
    ...products.map((p) => ({ value: `product:${p.product_id}`, label: `${p.product_name} (sellable product)`, unit: p.unit })),
    ...ingredients.map((i) => ({ value: `ingredient:${i.ingredient_id}`, label: `${i.ingredient_name} (re-usable ingredient)`, unit: i.unit })),
  ];

  // ---- ingredient lines (the mix) ----
  // "12 packs x 2 each" fills the total quantity (24) for you; you can still type the total directly.
  function setLine(index, field, value) {
    setForm({
      ...form,
      lines: form.lines.map((l, i) => {
        if (i !== index) return l;
        const next = { ...l, [field]: value };
        if ((field === "packs" || field === "each") && Number(next.packs) > 0 && Number(next.each) > 0) {
          next.quantity_required = String(Math.round(Number(next.packs) * Number(next.each) * 100) / 100);
        }
        return next;
      }),
    });
  }
  const addLine = () => setForm({ ...form, lines: [...form.lines, { ...emptyLine }] });
  const removeLine = (index) => setForm({ ...form, lines: form.lines.filter((_, i) => i !== index) });

  function cancelEdit() { setEditingId(null); setForm(emptyForm); }

  function startEdit(r) {
    setMessage(null);
    setEditingId(r.recipe_id);
    const o = r.outputs[0]; // single output now — a recipe from before this change may have had several; editing it keeps only the first and drops the rest
    setForm({
      recipe_name: r.recipe_name,
      output: o ? (o.product_id ? `product:${o.product_id}` : `ingredient:${o.output_ingredient_id}`) : "",
      quantity: o ? String(o.quantity) : "",
      lines: r.ingredients.map((l) => ({ ingredient_id: String(l.ingredient_id), packs: "", each: "", quantity_required: String(Number(l.quantity_required)) })),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveRecipe(e) {
    e.preventDefault();
    setMessage(null);
    const [type, id] = form.output.split(":");
    const payload = {
      recipe_name: form.recipe_name,
      outputs: [{ ...(type === "product" ? { product_id: Number(id) } : { output_ingredient_id: Number(id) }), quantity: Number(form.quantity) }],
      ingredients: form.lines
        .filter((l) => l.ingredient_id && l.quantity_required)
        .map((l) => ({ ingredient_id: Number(l.ingredient_id), quantity_required: Number(l.quantity_required) })),
    };
    try {
      if (editingId) {
        await api.put(`/recipes/${editingId}`, payload);
        setMessage({ type: "success", text: "Recipe updated. New production batches will use the new mix; past batches keep their recorded cost." });
      } else {
        await api.post("/recipes", payload);
        setMessage({ type: "success", text: "Recipe saved. It now appears in Production Batch." });
      }
      cancelEdit();
      load(selectedBranch);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not save recipe." });
    }
  }

  async function removeRecipe(r) {
    if (!window.confirm(`Delete the recipe "${r.recipe_name}"?`)) return;
    setMessage(null);
    try {
      await api.delete(`/recipes/${r.recipe_id}`);
      if (editingId === r.recipe_id) cancelEdit();
      setMessage({ type: "success", text: "Recipe deleted." });
      load(selectedBranch);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not delete recipe." });
    }
  }

  const canCreate = ["owner", "manager"].includes(user.role);
  const grey = { width: "auto", padding: "4px 10px", fontSize: 12, background: "#ddd6c9", color: "#333" };
  const cell = { border: "1px solid #d9d2c5", padding: "6px 10px", verticalAlign: "top" };

  return (
    <div>
      <h1>Recipes</h1>
      <div className="subtitle">
        Write each recipe once — the ingredients from your stock, and what one batch makes. The same
        ingredient can be reused across as many different recipes as you like. Production Batch then
        does the maths every time you bake.
      </div>

      {(user.role === "owner" || user.linked_branch_id) && (
        <div className="field" style={{ maxWidth: 300 }}>
          <label>Branch</label>
          <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
            {branches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
          </select>
        </div>
      )}

      {message && (
        <p style={{ color: message.type === "success" ? "var(--success)" : "var(--danger)", fontSize: 13 }}>{message.text}</p>
      )}

      {canCreate && (
        <form onSubmit={saveRecipe} className="stat-card" style={{ maxWidth: 640, marginBottom: 32 }}>
          <h2 style={{ marginTop: 0 }}>{editingId ? "Edit recipe" : "New recipe"}</h2>
          <div className="field">
            <label>Recipe name</label>
            <input required value={form.recipe_name} onChange={(e) => setForm({ ...form, recipe_name: e.target.value })} placeholder="e.g. Daily dough mix" />
          </div>

          <label style={{ fontSize: 13, fontWeight: 500 }}>One batch makes</label>
          {(() => {
            const unit = outputOptions.find((x) => x.value === form.output)?.unit;
            return (
              <div style={{ display: "flex", gap: 8, margin: "8px 0 16px" }}>
                <select style={{ flex: 2 }} value={form.output} onChange={(e) => setForm({ ...form, output: e.target.value })} required>
                  <option value="">Product…</option>
                  {outputOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <input style={{ flex: 1 }} type="number" min="0.01" step="0.01" placeholder={unit ? `How many (${unit})` : "How many"} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
              </div>
            );
          })()}
          {outputOptions.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--muted)" }}>Add the product on the Inventory page first (and ingredients on the Ingredients page).</p>
          )}

          <div style={{ display: "block" }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Proportion mix — ingredients for ONE batch (from your stock)</label>
          </div>
          {form.lines.map((line, i) => {
            const ing = ingredients.find((x) => x.ingredient_id === Number(line.ingredient_id));
            const short = ing && Number(line.quantity_required) > Number(ing.current_stock);
            return (
              <div key={i} style={{ margin: "10px 0" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select style={{ flex: 2 }} value={line.ingredient_id} onChange={(e) => setLine(i, "ingredient_id", e.target.value)}>
                    <option value="">Ingredient…</option>
                    {ingredients.map((x) => (
                      <option key={x.ingredient_id} value={x.ingredient_id}>{x.ingredient_name} — {Number(x.current_stock)} {x.unit} in stock</option>
                    ))}
                  </select>
                  <input style={{ flex: 1 }} type="number" min="0.01" step="0.01" placeholder={ing ? `Total (${ing.unit})` : "Total"} value={line.quantity_required} onChange={(e) => setLine(i, "quantity_required", e.target.value)} />
                  {form.lines.length > 1 && (
                    <button type="button" className="btn" style={grey} onClick={() => removeLine(i)}>✕</button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  or bundle:
                  <input style={{ width: 70 }} type="number" min="0" step="1" placeholder="packs" value={line.packs} onChange={(e) => setLine(i, "packs", e.target.value)} />
                  ×
                  <input style={{ width: 70 }} type="number" min="0" step="0.01" placeholder={ing ? `${ing.unit} each` : "size each"} value={line.each} onChange={(e) => setLine(i, "each", e.target.value)} />
                  {short && <span style={{ color: "var(--danger)" }}>More than the {Number(ing.current_stock)} {ing.unit} in stock right now</span>}
                </div>
              </div>
            );
          })}
          {ingredients.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--muted)" }}>No ingredients in stock yet — buy/add them on the Ingredients page first.</p>
          )}
          <button type="button" className="btn" style={{ ...grey, padding: "6px 12px", marginBottom: 16 }} onClick={addLine}>+ Add ingredient</button>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" type="submit">{editingId ? "Save changes" : "Save recipe"}</button>
            {editingId && <button type="button" className="btn" style={{ background: "#ddd6c9", color: "#333" }} onClick={cancelEdit}>Cancel</button>}
          </div>
        </form>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, maxWidth: 900 }}>
        <h2 style={{ margin: 0 }}>Recipe list</h2>
        {recipes.length > 0 && selectedBranch && (
          <button className="btn" style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}
            onClick={() => downloadFile(`/exports/recipes/branch/${selectedBranch}`, "Recipes.xlsx")}>
            Download Excel
          </button>
        )}
      </div>

      {canImport && selectedBranch && (
        <div className="stat-card" style={{ maxWidth: 480, marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>Import Recipe Mix from Excel</h2>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            Edit the downloaded sheet's <code>Qty per batch</code> column and re-upload to bulk-update
            ingredient quantities. Matches by <code>Recipe</code> and <code>Ingredient</code> name — the
            recipe and ingredient must already exist here; this doesn't create new recipes or change what
            a recipe produces. For that, use the form above.
          </p>
          <form onSubmit={submitImport} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => setImportFile(e.target.files[0])} />
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

      {recipes.length === 0 && <p style={{ color: "var(--muted)" }}>No recipes yet for this branch.</p>}

      {recipes.length > 0 && (
        <div style={{ overflowX: "auto", maxWidth: 900 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {["Recipe", "One batch makes", "Ingredient", "Qty per batch", "Unit", "In stock", ""].map((h) => (
                  <th key={h} style={{ ...cell, background: "#f0ebe1", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recipes.map((r) =>
                r.ingredients.map((l, idx) => (
                  <tr key={`${r.recipe_id}-${l.ingredient_id}`}>
                    {idx === 0 && (
                      <>
                        <td style={{ ...cell, fontWeight: 500 }} rowSpan={r.ingredients.length}>{r.recipe_name}</td>
                        <td style={cell} rowSpan={r.ingredients.length}>
                          {r.outputs.map((o, k) => <div key={k}>{o.name}: {o.quantity} {o.unit}</div>)}
                        </td>
                      </>
                    )}
                    <td style={cell}>{l.ingredient_name}</td>
                    <td style={cell}>{Number(l.quantity_required)}</td>
                    <td style={cell}>{l.unit}</td>
                    <td style={{ ...cell, color: Number(l.current_stock) < Number(l.quantity_required) ? "var(--danger)" : "inherit" }}>{Number(l.current_stock)}</td>
                    {idx === 0 && (
                      <td style={{ ...cell, whiteSpace: "nowrap" }} rowSpan={r.ingredients.length}>
                        {canCreate && (
                          <>
                            <button className="btn" style={{ ...grey, marginRight: 6 }} onClick={() => startEdit(r)}>Edit</button>
                            <button className="btn" style={grey} onClick={() => removeRecipe(r)}>Delete</button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
