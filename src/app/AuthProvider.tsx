import { useState, type ReactNode } from "react";
import type { AuthenticatedUser } from "../types/auth";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  return <AuthContext value={{ user, setUser }}>{children}</AuthContext>;
}
