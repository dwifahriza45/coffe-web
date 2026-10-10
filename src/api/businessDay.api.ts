import api from "./client";
import type { ApiResponse } from "../types/auth";

export interface BusinessDayUserInfo {
  user_id: string;
  fullname: string;
}

export interface BusinessDay {
  business_day_id: string;
  business_date: string;
  status: "OPEN" | "CLOSED";
  opened_by: string;
  opened_by_info?: BusinessDayUserInfo;
  opened_at: string;
  closed_by?: string;
  closed_by_info?: BusinessDayUserInfo;
  closed_at?: string;
}

export const getBusinessDays = async (payload: {
  start: number;
  limit: number;
  status: string;
  business_date?: string;
}) => (await api.post<ApiResponse<BusinessDay[]>>("/business-days/list", payload)).data;

export const openBusinessDay = async (payload: { business_date: string }) =>
  (await api.post<ApiResponse<null>>("/business-days/", payload)).data;

export const closeBusinessDay = async (businessDayID: string) =>
  (await api.patch<ApiResponse<null>>(`/business-days/${businessDayID}/close`, {})).data;

export const deleteBusinessDay = async (businessDayID: string) =>
  (await api.delete<ApiResponse<null>>(`/business-days/${businessDayID}`)).data;
export interface BusinessDaySummary {business_day_id:string;closing_submitted:boolean;draft_adjustment_count:number;stock_count_exists:boolean}
export const getBusinessDaySummaries=async(business_day_ids:string[])=>(await api.post<ApiResponse<BusinessDaySummary[]>>("/business-days/status-summary",{business_day_ids})).data;
