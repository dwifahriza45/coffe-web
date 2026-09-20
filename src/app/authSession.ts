import { me } from "../api/auth.api";
import type { AuthenticatedUser } from "../types/auth";

let cachedUser: AuthenticatedUser | null | undefined;
const LOGGED_OUT_KEY = "crema-logged-out";
export async function getSessionUser() {
  if (sessionStorage.getItem(LOGGED_OUT_KEY) === "true") return null;
  if (cachedUser !== undefined) return cachedUser;
  try {
    const response = await me();
    cachedUser = response.error ? null : response.data;
  } catch {
    cachedUser = null;
  }
  return cachedUser;
}
export function clearSessionCache() {
  sessionStorage.removeItem(LOGGED_OUT_KEY);
  cachedUser = undefined;
}

export function invalidateSession() {
  sessionStorage.setItem(LOGGED_OUT_KEY, "true");
  cachedUser = null;
}
