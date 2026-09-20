import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const api = axios.create({
  baseURL: "/api/v1/admin",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});
type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };
const isAuthenticationRequest = (url?: string) =>
  url?.includes("/auth/login") ||
  url?.includes("/auth/refresh") ||
  url?.includes("/auth/logout");

let refreshRequest: Promise<void> | null = null;

async function renewAccessToken() {
  const response = await api.post("/auth/refresh", {});
  if (response.data.error) {
    throw new Error(response.data.message || "Could not refresh access token");
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as RetryConfig | undefined;
    if (
      error.response?.status !== 401 ||
      !request ||
      request._retry ||
      isAuthenticationRequest(request.url)
    )
      return Promise.reject(error);
    request._retry = true;
    try {
      refreshRequest ??= renewAccessToken();
      await refreshRequest;
      return api(request);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    } finally {
      refreshRequest = null;
    }
  },
);
export default api;
