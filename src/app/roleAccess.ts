import type { AuthenticatedUser } from "../types/auth";

export const getUserRoleNames = (user: AuthenticatedUser | null) =>
  user?.roles?.map((role) => role.roles_name.toLowerCase()) ?? [];

export const userHasRole = (
  user: AuthenticatedUser | null,
  allowed: readonly string[],
) => {
  const roles = getUserRoleNames(user);
  return allowed.some((role) => roles.includes(role.toLowerCase()));
};

export type PermissionAction = "read" | "create" | "update" | "delete";

export const userCan = (
  user: AuthenticatedUser | null,
  menuKey: string,
  action: PermissionAction = "read",
) => {
  if (userHasRole(user, ["admin"])) return true;
  const permission = user?.permissions?.find(
    (item) => item.menu_key === menuKey,
  );
  const parent = ["inventory_opening_counts", "inventory_closing_counts", "stock_adjustments", "stock_movements"].includes(menuKey) ? user?.permissions?.find((p) => p.menu_key === "inventory_counts") : undefined;
  if (parent && (menuKey !== "stock_movements" || action === "read")) {
    const allowed = action === "read" ? parent.can_read || parent.can_create || parent.can_update || parent.can_delete : action === "create" ? parent.can_create : action === "update" ? parent.can_update : parent.can_delete;
    if (allowed) return true;
  }
  if (!permission) return false;
  switch (action) {
    case "create":
      return permission.can_create;
    case "update":
      return permission.can_update;
    case "delete":
      return permission.can_delete;
    default:
      return (
        permission.can_read ||
        permission.can_create ||
        permission.can_update ||
        permission.can_delete
      );
  }
};

export const getHomeRoute = (user: AuthenticatedUser | null) => {
  return user ? "/home" : "/login";
};

export const userCanStockDepartment = (user: AuthenticatedUser | null, department: string) => userCan(user, `stock_department_${department}`);
