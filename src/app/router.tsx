import OrderHistoryPage from "../pages/Order/OrderHistoryPage";
import OrderPage from "../pages/Order/OrderPage";
import SellingPriceHPPPage from "../pages/SellingPriceHPP/SellingPriceHPPPage";
import OperationalMenuPage from "../pages/OperationalMenu/OperationalMenuPage";
import IngredientDetailPage from "../pages/IngredientDetail/IngredientDetailPage";
import IngredientSubcategoriesPage from "../pages/IngredientSubcategories/IngredientSubcategoriesPage";
import CategoryIngredientManagementPage from "../pages/CategoryIngredientManagement/CategoryIngredientManagementPage";
import PackagingManagementPage from "../pages/PackagingManagement/PackagingManagementPage";
import InventoryCountEntryPage from "../pages/InventoryCount/InventoryCountEntryPage";
import StockMovementPage from "../pages/StockMovement/StockMovementPage";
import SupplierDetailPage from "../pages/SupplierDetail/SupplierDetailPage";
import PurchaseOrderPage from "../pages/PurchaseOrder/PurchaseOrderPage";
import SupplierManagementPage from "../pages/SupplierManagement/SupplierManagementPage";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/auth/LoginPage";
import BusinessDayPage from "../pages/BusinessDay/BusinessDayPage";
import BrandTypeManagementPage from "../pages/BrandTypeManagement/BrandTypeManagementPage";
import CategoryManagementPage from "../pages/CategoryManagement/CategoryManagementPage";
import CategoryDetailPage from "../pages/CategoryDetail/CategoryDetailPage";
import DashboardPage from "../pages/Dashboard/DashboardPage";
import CurrentStockPage from "../pages/CurrentStock/CurrentStockPage";
import CurrentStockDetailPage from "../pages/CurrentStock/CurrentStockDetailPage";
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
        <Route path="/ingredient-management/:ingredientID" element={<RequireAuth><RequirePermission menuKey="ingredients"><IngredientDetailPage /></RequirePermission></RequireAuth>} />
        <Route path="/category-ingredient-management/:categoryID" element={<RequireAuth><RequirePermission menuKey="category_ingredient"><IngredientSubcategoriesPage /></RequirePermission></RequireAuth>} />
        <Route path="/category-ingredient-management" element={<RequireAuth><RequirePermission menuKey="category_ingredient"><CategoryIngredientManagementPage /></RequirePermission></RequireAuth>} />
        <Route path="/packaging-management" element={<RequireAuth><RequirePermission menuKey="packagings"><PackagingManagementPage /></RequirePermission></RequireAuth>} />
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
        <Route path="/stock-in" element={<Navigate to="/supplier-management" replace />} />
        <Route path="/stock-in/:stockReceiptID" element={<Navigate to="/supplier-management" replace />} />
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
        <Route path="/supplier-management/:supplierID" element={<RequireAuth><RequirePermission menuKey="suppliers"><SupplierDetailPage /></RequirePermission></RequireAuth>} />
        <Route path="/supplier-management" element={<RequireAuth><RequirePermission menuKey="suppliers"><SupplierManagementPage /></RequirePermission></RequireAuth>} />
        <Route path="/order-history" element={<RequireAuth><RequirePermission menuKey="orders"><OrderHistoryPage /></RequirePermission></RequireAuth>} />
        <Route path="/order" element={<RequireAuth><RequirePermission menuKey="orders"><OrderPage /></RequirePermission></RequireAuth>} />
        <Route path="/purchase-orders" element={<RequireAuth><RequirePermission menuKey="suppliers"><PurchaseOrderPage /></RequirePermission></RequireAuth>} />
        <Route path="/selling-price-hpp" element={<RequireAuth><RequirePermission menuKey="selling_price_hpp"><SellingPriceHPPPage /></RequirePermission></RequireAuth>} />
        <Route path="/operational-menu" element={<RequireAuth><RequirePermission menuKey="menu_items"><OperationalMenuPage /></RequirePermission></RequireAuth>} />
        <Route path="/operational-menu/products/:productID" element={<RequireAuth><RequirePermission menuKey="menu_items"><OperationalMenuPage /></RequirePermission></RequireAuth>} />
        <Route path="/operational-menu/recipes/:recipeID" element={<RequireAuth><RequirePermission menuKey="menu_items"><OperationalMenuPage /></RequirePermission></RequireAuth>} />
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
          path="/brand-type-management"
          element={
            <RequireAuth>
              <RequirePermission menuKey="brand_types">
                <BrandTypeManagementPage />
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
              <RequirePermission menuKey="products">
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
