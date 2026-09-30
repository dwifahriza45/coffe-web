import api from "./client";
import type { ApiResponse } from "../types/auth";

export interface RolePermission {
  menu_key: string;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export interface Role {
  role_id: string;
  name: string;
  permissions: RolePermission[];
}

export const getRoles = async (payload: {
  start: number;
  limit: number;
  name: string;
} = { start: 0, limit: 100, name: "" }) =>
  (
    await api.post<ApiResponse<Role[]>>("/roles/list", payload)
  ).data;

export const createRole = async (
  name: string,
  permissions: RolePermission[] = [],
) => (await api.post<ApiResponse<null>>("/roles/", { name, permissions })).data;

export const updateRole = async (
  roleID: string,
  name: string,
  permissions?: RolePermission[],
) => {
  const payload =
    permissions === undefined ? { name } : { name, permissions };
  return (await api.put<ApiResponse<null>>(`/roles/${roleID}`, payload)).data;
};

export const deleteRole = async (roleID: string) =>
  (await api.delete<ApiResponse<null>>(`/roles/${roleID}`)).data;
