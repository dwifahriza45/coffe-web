import api from "./client";
import type { ApiResponse } from "../types/auth";

export interface Packaging {
  packaging_id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface PackagingPayload {
  code: string;
  name: string;
  active: boolean;
}

export const getPackagings = async (payload: {
  start: number;
  limit: number;
  name: string;
}) => (await api.post<ApiResponse<Packaging[]>>("/packagings/list", payload)).data;

export const getPackagingUsage = async (packagingIDs: string[]) =>
  (
    await api.post<ApiResponse<Record<string, boolean>>>("/packagings/usage", {
      packaging_ids: packagingIDs,
    })
  ).data;

export const createPackaging = async (payload: PackagingPayload) =>
  (await api.post<ApiResponse<null>>("/packagings/", payload)).data;

export const updatePackaging = async (
  packagingID: string,
  payload: PackagingPayload,
) => (await api.put<ApiResponse<null>>(`/packagings/${packagingID}`, payload)).data;

export const deletePackaging = async (packagingID: string) =>
  (await api.delete<ApiResponse<null>>(`/packagings/${packagingID}`)).data;
