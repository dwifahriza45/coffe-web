import type { AuthenticatedUser } from "../types/auth";

export const ROLE_HOME_ROUTES = [
  { roles: ["admin"], route: "/dashboard" },
  { roles: ["hris_admin"], route: "/user-management" },
  { roles: ["inventory"], route: "/unit-management" },
] as const;

export const getUserRoleNames = (user: AuthenticatedUser | null) =>
  user?.roles?.map((role) => role.roles_name.toLowerCase()) ?? [];

export const userHasRole = (
  user: AuthenticatedUser | null,
  allowed: readonly string[],
) => {
  const roles = getUserRoleNames(user);
  return allowed.some((role) => roles.includes(role.toLowerCase()));
};

export const getHomeRoute = (user: AuthenticatedUser | null) => {
  const match = ROLE_HOME_ROUTES.find(({ roles }) => userHasRole(user, roles));
  if (match) return match.route;
  return "/unauthorized";
};
