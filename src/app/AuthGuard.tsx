import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { getSessionUser } from "./authSession";
import { getHomeRoute, userHasRole } from "./roleAccess";

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
    <main className="grid min-h-screen place-items-center bg-[#f8f5f0]">
      <div className="flex items-center gap-3 text-sm font-semibold text-[#6b402b]">
        <span className="size-5 animate-spin rounded-full border-2 border-[#d9b9a5] border-t-[#6b402b]" />
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

export function RoleHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={getHomeRoute(user)} replace />;
}
