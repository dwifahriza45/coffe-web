export interface LoginRequest {
  email: string;
  password: string;
}
export interface LoginToken {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}
export interface AuthPermission {
  menu_key: string;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}
export interface AuthRole {
  roles_id: string;
  roles_name: string;
  permissions: AuthPermission[];
}
export interface AuthenticatedUser {
  user_id: string;
  fullname: string;
  email: string;
  phone: string;
  address: string;
  position: string;
  roles: AuthRole[];
  permissions: AuthPermission[];
}
export interface ApiResponse<T> {
  code: number;
  status: string;
  message: string;
  data: T;
  error: boolean;
  valid?: Record<string, string>;
  total?: number;
}
