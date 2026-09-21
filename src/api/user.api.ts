import api from "./client";
import type { ApiResponse } from "../types/auth";
import type {
  CreateUserRequest,
  GetUsersRequest,
  UpdateUserActiveRequest,
  UpdateUserPasswordRequest,
  UpdateUserRequest,
  User,
} from "../types/user";

export const getUsers = async (payload: GetUsersRequest) =>
  (await api.post<ApiResponse<User[]>>("/users/list", payload)).data;

export const createUser = async (payload: CreateUserRequest) =>
  (await api.post<ApiResponse<null>>("/users/", payload)).data;

export const updateUser = async (userID: string, payload: UpdateUserRequest) =>
  (await api.put<ApiResponse<null>>(`/users/${userID}`, payload)).data;

export const updateUserPassword = async (
  userID: string,
  payload: UpdateUserPasswordRequest,
) => (await api.patch<ApiResponse<null>>(`/users/${userID}/password`, payload)).data;

export const updateUserActive = async (
  userID: string,
  payload: UpdateUserActiveRequest,
) => (await api.patch<ApiResponse<null>>(`/users/${userID}/active`, payload)).data;

export const deleteUser = async (userID: string) =>
  (await api.delete<ApiResponse<null>>(`/users/${userID}`)).data;
