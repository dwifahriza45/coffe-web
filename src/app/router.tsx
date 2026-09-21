import { BrowserRouter, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/Dashboard/DashboardPage";
import NotFoundPage from "../pages/NotFound/NotFoundPage";
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
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
