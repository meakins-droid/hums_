import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";
import Receipt from "../components/Receipt.jsx";

// Every sale ever rung up at this branch, reprintable at any time — but the
// receipt always shows the ORIGINAL sale time, never the moment it's being
// reprinted. That's the whole point: it's what stops someone pocketing a
// sale and then printing a receipt later claiming it happened "just now."
export default function SalesHistory() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(user.branch_id || "");
  const [date, setDate] = useState("");
  const [sales, setSales] = useState([]);
  const [viewing, setViewing] = useState(null); // { sale_id, items, ... } currently open for reprint

  useEffect(() => {
    if (user.role === "owner" || user.linked_branch_id) {
      api.get("/branches").then((res) => {
        setBranches(res.data);
        if (user.role === "owner" && res.data.length > 0) setSelectedBranch(res.data[0].branch_id);
      });
    }
  }, [user]);

  function load() {
    if (!selectedBranch) return;
    const q = date ? `?date=${date}` : "";
    api.get(`/sales/branch/${selectedBranch}${q}`).then((res) => setSales(res.data));
  }
  useEffect(() => { load(); }, [selectedBranch, date]);

  async function openReceipt(sale) {
    const res = await api.get(`/sales/${sale.sale_id}/items`);
    setViewing({
      sale_id: sale.sale_id,
      dateTime: sale.sale_date, // the ORIGINAL time — never Date.now()
      items: res.data,
      totalAmount: sale.total_amount,
      paymentMethod: sale.payment_method,
      tableNumber: sale.table_number,
      cashierName: sale.cashier_name,
    });
  }

  return (
    <div>
      <h1>Sales History</h1>
      <div className="subtitle">
        Every sale, reprintable any time — the receipt always shows when the sale actually happened, not when you reprint it.
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {(user.role === "owner" || user.linked_branch_id) && (
          <div className="field" style={{ maxWidth: 260, margin: 0 }}>
            <label>Branch</label>
            <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
              {branches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
            </select>
          </div>
        )}
        <div className="field" style={{ maxWidth: 200, margin: 0 }}>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {date && (
          <button className="btn" style={{ width: "auto", padding: "8px 14px", alignSelf: "end" }} onClick={() => setDate("")}>
            Clear date
          </button>
        )}
      </div>

      <table>
        <thead><tr><th>Sale #</th><th>Date &amp; Time</th><th>Cashier</th><th>Payment</th><th>Total</th><th></th></tr></thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.sale_id}>
              <td>#{s.sale_id}</td>
              <td>{new Date(s.sale_date).toLocaleString([], { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" })}</td>
              <td>{s.cashier_name}</td>
              <td>{s.payment_method}</td>
              <td>KSh {Number(s.total_amount).toLocaleString()}</td>
              <td>
                <button className="btn" style={{ width: "auto", padding: "6px 12px", fontSize: 12 }} onClick={() => openReceipt(s)}>
                  View / Print
                </button>
              </td>
            </tr>
          ))}
          {sales.length === 0 && (
            <tr><td colSpan="6" style={{ color: "var(--muted)" }}>No sales recorded for this branch{date ? " on this date" : ""} yet.</td></tr>
          )}
        </tbody>
      </table>

      {viewing && (
        <Receipt
          businessName={user.branch_name || ""}
          branchName={user.branch_name || ""}
          saleId={viewing.sale_id}
          dateTime={viewing.dateTime}
          items={viewing.items}
          totalAmount={viewing.totalAmount}
          paymentMethod={viewing.paymentMethod}
          tableNumber={viewing.tableNumber}
          cashierName={viewing.cashierName}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
