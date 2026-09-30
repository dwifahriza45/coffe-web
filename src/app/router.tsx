import InventoryCountEntryPage from "../pages/InventoryCount/InventoryCountEntryPage";
import StockMovementPage from "../pages/StockMovement/StockMovementPage";
import SupplierManagementPage from "../pages/SupplierManagement/SupplierManagementPage";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/auth/LoginPage";
import BusinessDayPage from "../pages/BusinessDay/BusinessDayPage";
import CategoryManagementPage from "../pages/CategoryManagement/CategoryManagementPage";
import CategoryDetailPage from "../pages/CategoryDetail/CategoryDetailPage";
import DashboardPage from "../pages/Dashboard/DashboardPage";
import CurrentStockPage from "../pages/CurrentStock/CurrentStockPage";
import CurrentStockDetailPage from "../pages/CurrentStock/CurrentStockDetailPage";
import IngredientDetailPage from "../pages/IngredientDetail/IngredientDetailPage";
import IngredientManagementPage from "../pages/IngredientManagement/IngredientManagementPage";
import InventoryCountPage from "../pages/InventoryCount/InventoryCountPage";
import InventoryCountDetailPage from "../pages/InventoryCountDetail/InventoryCountDetailPage";
import HomePage from "../pages/Home/HomePage";
import MenuItemsPage from "../pages/MenuItems/MenuItemsPage";
import NotFoundPage from "../pages/NotFound/NotFoundPage";
import ProductDetailPage from "../pages/ProductDetail/ProductDetailPage";
import ReconciliationPage from "../pages/Reconciliation/ReconciliationPage";
import RoleManagementPage from "../pages/RoleManagement/RoleManagementPage";
import StockAdjustmentPage from "../pages/StockAdjustment/StockAdjustmentPage";
import StockAdjustmentDetailPage from "../pages/StockAdjustmentDetail/StockAdjustmentDetailPage";
import StockReceiptPage from "../pages/StockReceipt/StockReceiptPage";
import StockReceiptDetailPage from "../pages/StockReceiptDetail/StockReceiptDetailPage";
import UnitManagementPage from "../pages/UnitManagement/UnitManagementPage";
import UserManagementPage from "../pages/UserManagement/UserManagementPage";
import UnauthorizedPage from "../pages/Unauthorized/UnauthorizedPage";
import {
  RedirectIfAuthenticated,
  RequireAuth,
  RequirePermission,
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
          path="/home"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <RequirePermission menuKey="dashboard">
                <DashboardPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route
          path="/business-days"
          element={
            <RequireAuth>
              <RequirePermission menuKey="business_days">
                <BusinessDayPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route
          path="/business-days/:businessDayID/inventory-counts"
          element={
            <RequireAuth>
              <RequirePermission menuKey="inventory_counts">
                <InventoryCountPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route
          path="/business-days/:businessDayID/inventory-counts/:inventoryCountID"
          element={
            <RequireAuth>
              <RequirePermission menuKey="inventory_counts">
                <InventoryCountDetailPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route
          path="/stock-count"
          element={
            <RequireAuth>
              <RequirePermission menuKey="inventory_counts">
                <InventoryCountPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route path="/stock-count/opening" element={<RequireAuth><RequirePermission menuKey="inventory_opening_counts"><InventoryCountEntryPage type="OPENING" /></RequirePermission></RequireAuth>} />
        <Route path="/stock-count/closing" element={<RequireAuth><RequirePermission menuKey="inventory_closing_counts"><InventoryCountEntryPage type="CLOSING" /></RequirePermission></RequireAuth>} />
        <Route
          path="/stock-count/:inventoryCountID"
          element={
            <RequireAuth>
              <RequirePermission menuKey="inventory_counts">
                <InventoryCountDetailPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route
          path="/stock-in"
          element={
            <RequireAuth>
              <RequirePermission menuKey="stock_receipts">
                <StockReceiptPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route
          path="/stock-in/:stockReceiptID"
          element={
            <RequireAuth>
              <RequirePermission menuKey="stock_receipts">
                <StockReceiptDetailPage />
              </RequirePermission>
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
              <RequirePermission menuKey="users">
                <UserManagementPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route
          path="/role-management"
          element={
            <RequireAuth>
              <RequirePermission menuKey="roles">
                <RoleManagementPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route path="/supplier-management" element={<RequireAuth><RequirePermission menuKey="suppliers"><SupplierManagementPage /></RequirePermission></RequireAuth>} />
        <Route path="/stock-adjustments" element={<RequireAuth><RequirePermission menuKey="stock_adjustments"><StockAdjustmentPage /></RequirePermission></RequireAuth>} />
        <Route path="/stock-adjustments/:adjustmentID" element={<RequireAuth><RequirePermission menuKey="stock_adjustments"><StockAdjustmentDetailPage /></RequirePermission></RequireAuth>} />
        <Route path="/stock-movements" element={<RequireAuth><RequirePermission menuKey="stock_movements"><StockMovementPage /></RequirePermission></RequireAuth>} />
        <Route path="/current-stock" element={<RequireAuth><RequirePermission menuKey="current_stock"><CurrentStockPage /></RequirePermission></RequireAuth>} />
        <Route path="/current-stock/:ingredientID" element={<RequireAuth><RequirePermission menuKey="current_stock"><CurrentStockDetailPage /></RequirePermission></RequireAuth>} />
        <Route path="/reconciliation" element={<RequireAuth><RequirePermission menuKey="reconciliations"><ReconciliationPage /></RequirePermission></RequireAuth>} />
        <Route
          path="/unit-management"
          element={
            <RequireAuth>
              <RequirePermission menuKey="units">
                <UnitManagementPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route
          path="/ingredient-management"
          element={
            <RequireAuth>
              <RequirePermission menuKey="ingredients">
                <IngredientManagementPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route
          path="/ingredient-management/:ingredientID"
          element={
            <RequireAuth>
              <RequirePermission menuKey="ingredients">
                <IngredientDetailPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route
          path="/category-management"
          element={
            <RequireAuth>
              <RequirePermission menuKey="categories">
                <CategoryManagementPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route
          path="/category-management/:categoryID"
          element={
            <RequireAuth>
              <RequirePermission menuKey="categories">
                <CategoryDetailPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route
          path="/category-management/:categoryID/products/:productID"
          element={
            <RequireAuth>
              <RequirePermission menuKey="products">
                <ProductDetailPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route
          path="/menu-items"
          element={
            <RequireAuth>
              <RequirePermission menuKey="categories">
                <MenuItemsPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route
          path="/menu-items/:productID"
          element={
            <RequireAuth>
              <RequirePermission menuKey="products">
                <ProductDetailPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
