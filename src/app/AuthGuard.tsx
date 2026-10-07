import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { getSessionUser } from "./authSession";
import {
  getHomeRoute,
  userCan,
  userHasRole,
  type PermissionAction,
} from "./roleAccess";

type AuthState = "checking" | "authenticated" | "unauthenticated";

function useAuthentication() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const { setUser } = useAuth();

  useEffect(() => {
    let current = true;
    void getSessionUser().then((user) => {
      if (!current) return;
      setUser(user);
      setAuthState(user ? "authenticated" : "unauthenticated");
    });
    return () => {
      current = false;
    };
  }, [setUser]);

  return authState;
}

function AuthLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-brand-cream)]">
      <div className="flex items-center gap-3 text-sm font-semibold text-[var(--color-brand-primary)]">
        <span className="size-5 animate-spin rounded-full border-2 border-[var(--color-brand-sage)] border-t-[var(--color-brand-primary)]" />
        Checking your session...
      </div>
    </main>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const state = useAuthentication();
  if (state === "checking") return <AuthLoading />;
  return state === "authenticated" ? (
    children
  ) : (
    <Navigate to="/login" replace />
  );
}

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const state = useAuthentication();
  const { user } = useAuth();
  if (state === "checking") return <AuthLoading />;
  return state === "authenticated" ? (
    <Navigate to={getHomeRoute(user)} replace />
  ) : (
    children
  );
}

export function RequireRole({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles: string[];
}) {
  const { user } = useAuth();
  return userHasRole(user, allowedRoles) ? (
    children
  ) : (
    <Navigate to={getHomeRoute(user)} replace />
  );
}

export function RequirePermission({
  children,
  menuKey,
  action = "read",
}: {
  children: ReactNode;
  menuKey: string;
  action?: PermissionAction;
}) {
  const { user } = useAuth();
  const allowed = userCan(user, menuKey, action) ||
    (menuKey === "inventory_counts" && action === "read" &&
      ["inventory_opening_counts", "inventory_closing_counts"].some((key) => userCan(user, key)));
  return allowed ? (
    children
  ) : (
    <Navigate to={getHomeRoute(user)} replace />
  );
}

export function RoleHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={getHomeRoute(user)} replace />;
}
