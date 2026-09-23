import { BrowserRouter, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/auth/LoginPage";
import CategoryManagementPage from "../pages/CategoryManagement/CategoryManagementPage";
import CategoryDetailPage from "../pages/CategoryDetail/CategoryDetailPage";
import DashboardPage from "../pages/Dashboard/DashboardPage";
import IngredientDetailPage from "../pages/IngredientDetail/IngredientDetailPage";
import IngredientManagementPage from "../pages/IngredientManagement/IngredientManagementPage";
import NotFoundPage from "../pages/NotFound/NotFoundPage";
import ProductDetailPage from "../pages/ProductDetail/ProductDetailPage";
import RoleManagementPage from "../pages/RoleManagement/RoleManagementPage";
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
        <Route
          path="/unit-management"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "inventory"]}>
                <UnitManagementPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/ingredient-management"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "inventory"]}>
                <IngredientManagementPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/ingredient-management/:ingredientID"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "inventory"]}>
                <IngredientDetailPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/category-management"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "inventory"]}>
                <CategoryManagementPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/category-management/:categoryID"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "inventory"]}>
                <CategoryDetailPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/category-management/:categoryID/products/:productID"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["admin", "inventory"]}>
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
