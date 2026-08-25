export interface AuthUser {
  id: number;
  email: string;
  fullName: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export interface ApiErrorResponse {
  error: {
    message: string;
    details?: ApiErrorDetail[];
  };
}
