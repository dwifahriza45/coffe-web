import api from "./client";
import type { ApiResponse } from "../types/auth";

export interface Role {
  role_id: string;
  name: string;
}

export const getRoles = async (payload: {
  start: number;
  limit: number;
  name: string;
} = { start: 0, limit: 100, name: "" }) =>
  (
    await api.post<ApiResponse<Role[]>>("/roles/list", payload)
  ).data;

export const createRole = async (name: string) =>
  (await api.post<ApiResponse<null>>("/roles/", { name })).data;

export const updateRole = async (roleID: string, name: string) =>
  (await api.put<ApiResponse<null>>(`/roles/${roleID}`, { name })).data;

export const deleteRole = async (roleID: string) =>
  (await api.delete<ApiResponse<null>>(`/roles/${roleID}`)).data;
