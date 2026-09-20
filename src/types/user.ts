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
