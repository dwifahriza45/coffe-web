import api from "./client";
import type { ApiResponse } from "../types/auth";

export interface UserRole {
  user_id: string;
  fullname: string;
  role_id: string;
  role_name: string;
}

export const getUserRoleUsage = async (userIDs: string[]) =>
  (
    await api.post<ApiResponse<Record<string, boolean>>>("/users-roles/usage", {
      user_ids: userIDs,
    })
  ).data;

export const getUserRoles = async (userID: string) =>
  (
    await api.post<ApiResponse<UserRole[]>>("/users-roles/list", {
      start: 0,
      limit: 100,
      user_id: userID,
      role_id: "",
    })
  ).data;

export const getRoleUsers = async (roleID: string) =>
  (
    await api.post<ApiResponse<UserRole[]>>("/users-roles/list", {
      start: 0,
      limit: 100,
      user_id: "",
      role_id: roleID,
    })
  ).data;

export const createUserRole = async (userID: string, roleID: string) =>
  (
    await api.post<ApiResponse<null>>("/users-roles/", {
      user_id: userID,
      role_id: roleID,
    })
  ).data;

export const deleteUserRole = async (userID: string, roleID: string) =>
  (await api.delete<ApiResponse<null>>(`/users-roles/${userID}/${roleID}`))
    .data;
