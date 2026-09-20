import api from "./client";
import type { ApiResponse } from "../types/auth";
import type { CreateUserRequest, GetUsersRequest, User } from "../types/user";

export const getUsers = async (payload: GetUsersRequest) =>
  (await api.post<ApiResponse<User[]>>("/users/list", payload)).data;

export const createUser = async (payload: CreateUserRequest) =>
  (await api.post<ApiResponse<null>>("/users/", payload)).data;
