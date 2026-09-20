import type { AuthenticatedUser } from "../types/auth";

export const userHasRole = (
  user: AuthenticatedUser | null,
  allowed: string[],
) => {
  const roles = user?.roles?.map((role) => role.roles_name.toLowerCase()) ?? [];
  return allowed.some((role) => roles.includes(role.toLowerCase()));
};

export const getHomeRoute = (user: AuthenticatedUser | null) => {
  if (userHasRole(user, ["admin"])) return "/dashboard";
  if (userHasRole(user, ["hris_admin"])) return "/user-management";
  return "/unauthorized";
};
