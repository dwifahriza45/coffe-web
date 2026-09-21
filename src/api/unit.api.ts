import api from "./client";
import type { ApiResponse } from "../types/auth";

export interface Unit {
  unit_id: string;
  code: string;
  name: string;
  unit_type: string;
  active: boolean;
}

export interface UnitPayload {
  code: string;
  name: string;
  unit_type: string;
  active: boolean;
}

export const getUnits = async (payload: {
  start: number;
  limit: number;
  name: string;
}) => (await api.post<ApiResponse<Unit[]>>("/units/list", payload)).data;

export const createUnit = async (payload: UnitPayload) =>
  (await api.post<ApiResponse<null>>("/units/", payload)).data;

export const updateUnit = async (unitID: string, payload: UnitPayload) =>
  (await api.put<ApiResponse<null>>(`/units/${unitID}`, payload)).data;

export const deleteUnit = async (unitID: string) =>
  (await api.delete<ApiResponse<null>>(`/units/${unitID}`)).data;
