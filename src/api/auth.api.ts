import api from "./client";
import type {
  ApiResponse,
  AuthenticatedUser,
  LoginRequest,
  LoginToken,
} from "../types/auth";

export const login = async (payload: LoginRequest) =>
  (await api.post<ApiResponse<LoginToken>>("/auth/login", payload)).data;
export const me = async () =>
  (await api.get<ApiResponse<AuthenticatedUser>>("/auth/me")).data;
export const logout = async () =>
  (await api.post<ApiResponse<null>>("/auth/logout", {})).data;
