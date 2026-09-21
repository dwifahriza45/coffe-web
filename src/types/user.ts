export interface User {
  user_id: string;
  fullname: string;
  email: string;
  phone: string;
  address: string;
  position: string;
  active: boolean;
}

export interface GetUsersRequest {
  start: number;
  limit: number;
  fullname: string;
}

export interface CreateUserRequest {
  fullname: string;
  email: string;
  phone: string;
  address: string;
  position: string;
  password: string;
  confirm_password: string;
}

export interface UpdateUserRequest {
  fullname: string;
  email: string;
  phone: string;
  address: string;
  position: string;
}

export interface UpdateUserPasswordRequest {
  current_password: string;
  password: string;
  confirm_password: string;
}

export interface UpdateUserActiveRequest {
  current_password: string;
  active: boolean;
}
