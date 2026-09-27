import StockMovementPage from "../pages/StockMovement/StockMovementPage";
import SupplierManagementPage from "../pages/SupplierManagement/SupplierManagementPage";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/auth/LoginPage";
import BusinessDayPage from "../pages/BusinessDay/BusinessDayPage";
import CategoryManagementPage from "../pages/CategoryManagement/CategoryManagementPage";
import CategoryDetailPage from "../pages/CategoryDetail/CategoryDetailPage";
import DashboardPage from "../pages/Dashboard/DashboardPage";
import IngredientDetailPage from "../pages/IngredientDetail/IngredientDetailPage";
import IngredientManagementPage from "../pages/IngredientManagement/IngredientManagementPage";
import InventoryCountPage from "../pages/InventoryCount/InventoryCountPage";
import InventoryCountDetailPage from "../pages/InventoryCountDetail/InventoryCountDetailPage";
import MenuItemsPage from "../pages/MenuItems/MenuItemsPage";
import NotFoundPage from "../pages/NotFound/NotFoundPage";
import ProductDetailPage from "../pages/ProductDetail/ProductDetailPage";
import RoleManagementPage from "../pages/RoleManagement/RoleManagementPage";
import StockReceiptPage from "../pages/StockReceipt/StockReceiptPage";
import StockReceiptDetailPage from "../pages/StockReceiptDetail/StockReceiptDetailPage";
import UnitManagementPage from "../pages/UnitManagement/UnitManagementPage";
import UserManagementPage from "../pages/UserManagement/UserManagementPage";
import UnauthorizedPage from "../pages/Unauthorized/UnauthorizedPage";
import {
  RedirectIfAuthenticated,
  RequireAuth,
  RequireRole,
  RoleHomeRedirect,
} from "./AuthGuard";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <RequireAuth>
              <RoleHomeRedirect />
            </RequireAuth>
          }
        />
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin"]}>
                <DashboardPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/business-days"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "leader"]}>
                <BusinessDayPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/business-days/:businessDayID/inventory-counts"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "leader", "inventory"]}>
                <InventoryCountPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/business-days/:businessDayID/inventory-counts/:inventoryCountID"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "leader", "inventory"]}>
                <InventoryCountDetailPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/stock-count"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "leader", "inventory"]}>
                <InventoryCountPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/stock-count/:inventoryCountID"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "leader", "inventory"]}>
                <InventoryCountDetailPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/stock-in"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "leader", "inventory"]}>
                <StockReceiptPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/stock-in/:stockReceiptID"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "leader", "inventory"]}>
                <StockReceiptDetailPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/unauthorized"
          element={
            <RequireAuth>
              <UnauthorizedPage />
            </RequireAuth>
          }
        />
        <Route
          path="/user-management"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "hris_admin"]}>
                <UserManagementPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/role-management"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "hris_admin"]}>
                <RoleManagementPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route path="/supplier-management" element={<RequireAuth><RequireRole allowedRoles={["admin", "leader", "inventory"]}><SupplierManagementPage /></RequireRole></RequireAuth>} />
        <Route path="/stock-movements" element={<RequireAuth><RequireRole allowedRoles={["admin", "leader", "inventory"]}><StockMovementPage /></RequireRole></RequireAuth>} />
        <Route
          path="/unit-management"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "leader", "inventory"]}>
                <UnitManagementPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/ingredient-management"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "leader", "inventory"]}>
                <IngredientManagementPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/ingredient-management/:ingredientID"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "leader", "inventory"]}>
                <IngredientDetailPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/category-management"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "ballista", "leader"]}>
                <CategoryManagementPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/category-management/:categoryID"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "ballista", "leader"]}>
                <CategoryDetailPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/category-management/:categoryID/products/:productID"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "ballista", "leader", "inventory"]}>
                <ProductDetailPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/menu-items"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "ballista", "leader"]}>
                <MenuItemsPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/menu-items/:productID"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "ballista", "leader", "inventory"]}>
                <ProductDetailPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
