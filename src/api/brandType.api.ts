import api from "./client";
import type { ApiResponse } from "../types/auth";

export interface BrandType {
  brand_type_id: string;
  name: string;
  active: boolean;
}

export interface BrandTypePayload {
  name: string;
  active: boolean;
}

export const getBrandTypes = async (payload: {
  start: number;
  limit: number;
  name: string;
}) => (await api.post<ApiResponse<BrandType[]>>("/brand-types/list", payload)).data;

export const getBrandTypeUsage = async (brandTypeIDs: string[]) =>
  (
    await api.post<ApiResponse<Record<string, boolean>>>("/brand-types/usage", {
      brand_type_ids: brandTypeIDs,
    })
  ).data;

export const createBrandType = async (payload: BrandTypePayload) =>
  (await api.post<ApiResponse<null>>("/brand-types/", payload)).data;

export const updateBrandType = async (
  brandTypeID: string,
  payload: BrandTypePayload,
) => (await api.put<ApiResponse<null>>(`/brand-types/${brandTypeID}`, payload)).data;

export const deleteBrandType = async (brandTypeID: string) =>
  (await api.delete<ApiResponse<null>>(`/brand-types/${brandTypeID}`)).data;
