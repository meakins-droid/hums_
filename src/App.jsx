import { Routes, Route } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Login from "./pages/Login.jsx";
import OwnerDashboard from "./pages/OwnerDashboard.jsx";
import CashierPOS from "./pages/CashierPOS.jsx";
import Inventory from "./pages/Inventory.jsx";
import Reports from "./pages/Reports.jsx";
import MeatDelivery from "./pages/MeatDelivery.jsx";
import ProductionBatch from "./pages/ProductionBatch.jsx";
import RestaurantPOS from "./pages/RestaurantPOS.jsx";
import MeatTransfer from "./pages/MeatTransfer.jsx";
import Ingredients from "./pages/Ingredients.jsx";
import ScheduledOrders from "./pages/ScheduledOrders.jsx";
import Expenses from "./pages/Expenses.jsx";
import MarketSales from "./pages/MarketSales.jsx";
import Recipes from "./pages/Recipes.jsx";
import MergedDashboard from "./pages/MergedDashboard.jsx";
import SalesHistory from "./pages/SalesHistory.jsx";
import StaffSignIn from "./pages/StaffSignIn.jsx";
import DailySummary from "./pages/DailySummary.jsx";
import Variance from "./pages/Variance.jsx";
import BakeryDashboard from "./pages/BakeryDashboard.jsx";

function Layout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

// Home route shows: the owner dashboard for owners, the MERGED dashboard for
// a butchery+hotel combined login, the table-order POS for standalone
// restaurant staff, and the flat-cart POS for standalone butchery/bakery.
function Home() {
  const { user } = useAuth();
  if (user.role === "owner") return <OwnerDashboard />;
  if (user.linked_branch_id) return <MergedDashboard />;
  if (user.branch_type === "restaurant") return <RestaurantPOS />;
  // A butchery with no linked hotel at all (reached this line only when
  // linked_branch_id above was falsy) — no item-by-item POS, Daily Summary
  // instead.
  if (user.branch_type === "butchery") return <DailySummary />;
  // Only a plain bakery account reaches this line — give it a dashboard
  // (today's revenue/expenses) instead of landing straight on the POS.
  // The POS itself is still one click away at /pos.
  return <BakeryDashboard />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={
        <ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>
      } />
      <Route path="/inventory" element={
        <ProtectedRoute><Layout><Inventory /></Layout></ProtectedRoute>
      } />
      <Route path="/butchery-pos" element={
        <ProtectedRoute allowedRoles={["owner", "manager", "cashier"]}><Layout><CashierPOS /></Layout></ProtectedRoute>
      } />
      <Route path="/pos" element={
        <ProtectedRoute allowedRoles={["owner", "manager", "cashier"]}><Layout><CashierPOS /></Layout></ProtectedRoute>
      } />
      <Route path="/hotel-orders" element={
        <ProtectedRoute allowedRoles={["owner", "manager", "cashier"]}><Layout><RestaurantPOS /></Layout></ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute><Layout><Reports /></Layout></ProtectedRoute>
      } />
      <Route path="/meat" element={
        <ProtectedRoute allowedRoles={["owner", "manager"]}><Layout><MeatDelivery /></Layout></ProtectedRoute>
      } />
      <Route path="/production" element={
        <ProtectedRoute allowedRoles={["owner", "manager", "baker"]}><Layout><ProductionBatch /></Layout></ProtectedRoute>
      } />
      <Route path="/meat-transfer" element={
        <ProtectedRoute allowedRoles={["owner", "manager"]}><Layout><MeatTransfer /></Layout></ProtectedRoute>
      } />
      <Route path="/ingredients" element={
        <ProtectedRoute allowedRoles={["owner", "manager", "baker"]}><Layout><Ingredients /></Layout></ProtectedRoute>
      } />
      <Route path="/scheduled-orders" element={
        <ProtectedRoute allowedRoles={["owner", "manager", "baker", "cashier"]}><Layout><ScheduledOrders /></Layout></ProtectedRoute>
      } />
      <Route path="/expenses" element={
        <ProtectedRoute allowedRoles={["owner", "manager"]}><Layout><Expenses /></Layout></ProtectedRoute>
      } />
      <Route path="/recipes" element={
        <ProtectedRoute allowedRoles={["owner", "manager", "baker"]}><Layout><Recipes /></Layout></ProtectedRoute>
      } />
      <Route path="/market-sales" element={
        <ProtectedRoute allowedRoles={["owner", "manager", "baker", "cashier"]}><Layout><MarketSales /></Layout></ProtectedRoute>
      } />
      <Route path="/staff-sign-in" element={
        <ProtectedRoute allowedRoles={["owner", "manager"]}><Layout><StaffSignIn /></Layout></ProtectedRoute>
      } />
      <Route path="/daily-summary" element={
        <ProtectedRoute allowedRoles={["owner", "manager"]}><Layout><DailySummary /></Layout></ProtectedRoute>
      } />
      <Route path="/variance" element={
        <ProtectedRoute allowedRoles={["owner"]}><Layout><Variance /></Layout></ProtectedRoute>
      } />
      <Route path="/sales-history" element={
        <ProtectedRoute allowedRoles={["owner", "manager", "cashier", "baker"]}><Layout><SalesHistory /></Layout></ProtectedRoute>
      } />
    </Routes>
  );
}
