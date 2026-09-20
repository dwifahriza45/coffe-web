import { createContext, useContext } from "react";
import type { AuthenticatedUser } from "../types/auth";

export type AuthContextValue = {
  user: AuthenticatedUser | null;
  setUser: (user: AuthenticatedUser | null) => void;
};
export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
};
