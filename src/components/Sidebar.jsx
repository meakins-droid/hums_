import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const isOwner = user?.role === "owner";
  // A merged login (butchery manager whose account now also carries its
  // linked hotel) needs BOTH sets of nav items — so branch type is checked
  // as a set of one or two, not a single value.
  const branchTypes = [user?.branch_type, user?.linked_branch_type].filter(Boolean);
  const isRestaurantStaff = branchTypes.includes("restaurant");
  const isButcheryStaff = branchTypes.includes("butchery");
  const isBakeryStaff = branchTypes.includes("bakery");
  const isMerged = !!user?.linked_branch_id;
  // A butchery account with no linked hotel at all — no item-by-item POS,
  // Daily Summary (cash + expenses + physical stock count) instead.
  const isStandaloneButchery = isButcheryStaff && !isMerged && !isOwner;

  // Production Batch is for turning ingredients into a finished item —
  // butcheries sell meat as-is, they don't "produce" anything, so this
  // never applies there.
  const canProduce = ["owner", "manager", "baker"].includes(user?.role) && (isOwner || isBakeryStaff || isRestaurantStaff);

  // Meat Delivery (receiving stock) applies to any butchery. Meat Transfer
  // (pushing it onward into a kitchen) only makes sense when there's an
  // attached hotel to push it into.
  const canReceiveMeatDelivery = ["owner", "manager"].includes(user?.role) && (isOwner || isButcheryStaff);
  const canTransferMeat = ["owner", "manager"].includes(user?.role) && (isOwner || (isButcheryStaff && isMerged));

  // Scheduled Orders (pre-orders/advance orders) exist ONLY for Home
  // Bakery, which works order-first (order -> buy ingredients -> bake ->
  // deliver). Nduani Bakery bakes and sells same-day with no prior order,
  // and the hotels don't take advance table bookings through this system.
  const canScheduleOrders = isOwner || isBakeryStaff;

  return (
    <aside className="sidebar">
      <div className="brand">Hebrews Urgencies</div>
      <div className="brand-sub">{user?.branch_name || "Management System"}{isMerged ? ` + ${user.linked_branch_name}` : ""}</div>

      <nav>
        {(isOwner || isMerged) && <NavLink to="/" end>Dashboard</NavLink>}
        {!isOwner && !isMerged && (
          isStandaloneButchery
            ? <NavLink to="/" end>Daily Summary</NavLink>
            : isBakeryStaff
            ? <NavLink to="/" end>Dashboard</NavLink>
            : <NavLink to="/" end>Table Orders</NavLink>
        )}
        {isMerged && isButcheryStaff && <NavLink to="/butchery-pos">Butchery Sales</NavLink>}
        {isMerged && isRestaurantStaff && <NavLink to="/hotel-orders">Table Orders</NavLink>}
        {!isOwner && !isMerged && isBakeryStaff && <NavLink to="/pos">Point of Sale</NavLink>}
        <NavLink to="/inventory">Inventory</NavLink>
        <NavLink to="/expenses">Expenses</NavLink>
        {canProduce && <NavLink to="/ingredients">Ingredients</NavLink>}
        {canProduce && <NavLink to="/recipes">Recipes</NavLink>}
        {canProduce && <NavLink to="/production">Production Batch</NavLink>}
        {(isOwner || isBakeryStaff) && <NavLink to="/market-sales">Market Sales</NavLink>}
        {canScheduleOrders && <NavLink to="/scheduled-orders">Scheduled Orders</NavLink>}
        {canTransferMeat && <NavLink to="/meat-transfer">Meat Transfer</NavLink>}
        {(isOwner || isRestaurantStaff) && <NavLink to="/staff-sign-in">Staff Sign In</NavLink>}
        <NavLink to="/sales-history">Sales History</NavLink>
        <NavLink to="/reports">Reports</NavLink>
        {isOwner && <NavLink to="/variance">Variance</NavLink>}
        {canReceiveMeatDelivery && <NavLink to="/meat">Meat Delivery</NavLink>}
      </nav>

      <div className="user-box">
        <div>{user?.full_name}</div>
        <div style={{ textTransform: "capitalize" }}>{user?.role}</div>
        <button className="logout" onClick={logout}>Log out</button>
      </div>
    </aside>
  );
}
