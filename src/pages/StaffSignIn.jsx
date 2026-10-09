import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

// The staff roster for THIS branch (a hotel's restaurant, or any other
// restaurant-type branch). Not a login system — just names — so a waiter
// doesn't need a username/password for their name to appear correctly on a
// printed table-order receipt. Sign in at the start of a shift, sign out at
// the end; whoever is signed in shows up in the "Served by" list on
// Table Orders.
export default function StaffSignIn() {
  const { user } = useAuth();
  // A standalone restaurant login IS the branch. A merged login (butchery
  // manager) reaches this page for their LINKED hotel's staff — their own
  // branch_id is the butchery, which has no servers.
  const branchId = user.branch_type === "restaurant" ? user.branch_id : user.linked_branch_id;
  const branchName = user.branch_type === "restaurant" ? user.branch_name : user.linked_branch_name;
  const [servers, setServers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState(null);

  function load() {
    if (branchId) {
      api.get(`/servers/branch/${branchId}`).then((res) => setServers(res.data));
      api.get(`/servers/branch/${branchId}/attendance`).then((res) => setAttendance(res.data));
    }
  }
  useEffect(() => {
    load();
    // Keeps this live if someone else signs in/out from another device —
    // without this, you'd only see a change after manually refreshing.
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [branchId]);

  const fmtTime = (t) => t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" }) : "—";

  async function addServer(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setMessage(null);
    try {
      await api.post("/servers", { branch_id: branchId, full_name: newName.trim() });
      setNewName("");
      load();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not add staff member." });
    }
  }

  async function toggle(server) {
    setMessage(null);
    try {
      if (server.signed_in) await api.post(`/servers/${server.server_id}/sign-out`);
      else await api.post(`/servers/${server.server_id}/sign-in`);
      load();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not update sign-in status." });
    }
  }

  const row = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", border: "1px solid #d9d2c5", borderRadius: 8, marginBottom: 8 };

  return (
    <div>
      <h1>Staff Sign In — {branchName}</h1>
      <div className="subtitle">Sign a server in at the start of their shift and out at the end. Whoever is signed in appears in the "Served by" list when opening a table.</div>

      {message && <p style={{ color: "var(--danger)", fontSize: 13 }}>{message.text}</p>}

      <form onSubmit={addServer} style={{ display: "flex", gap: 8, maxWidth: 360, margin: "20px 0" }}>
        <input placeholder="Add a staff member's name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn" type="submit" style={{ width: "auto" }}>Add</button>
      </form>

      <div style={{ maxWidth: 480 }}>
        {servers.length === 0 && <p style={{ color: "var(--muted)" }}>No staff on the roster yet — add one above.</p>}
        {servers.map((s) => (
          <div key={s.server_id} style={row}>
            <div>
              <div style={{ fontWeight: 500 }}>{s.full_name}</div>
              {s.signed_in && (
                <div style={{ fontSize: 12, color: "var(--success)" }}>
                  Signed in since {new Date(s.signed_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" })}
                </div>
              )}
            </div>
            <button
              className="btn"
              style={{ width: "auto", padding: "6px 14px", background: s.signed_in ? "#ddd6c9" : undefined, color: s.signed_in ? "#333" : undefined }}
              onClick={() => toggle(s)}
            >
              {s.signed_in ? "Sign Out" : "Sign In"}
            </button>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 32 }}>Today's attendance</h2>
      <div className="subtitle">Every sign-in for today, in order — this is the accountability record, kept even after someone signs out.</div>
      <table style={{ maxWidth: 520 }}>
        <thead><tr><th>Name</th><th>Time In</th><th>Time Out</th></tr></thead>
        <tbody>
          {attendance.map((a) => (
            <tr key={a.shift_id}>
              <td>{a.full_name}</td>
              <td>{fmtTime(a.signed_in_at)}</td>
              <td>{a.signed_out_at ? fmtTime(a.signed_out_at) : <span style={{ color: "var(--success)" }}>Still in</span>}</td>
            </tr>
          ))}
          {attendance.length === 0 && (
            <tr><td colSpan="3" style={{ color: "var(--muted)" }}>No one has signed in yet today.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
