export interface AuthUser {
  id: number;
  email: string;
  fullName: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
