export interface ApiError {
  error: {
    message: string;
    details?: Array<{ path: string; message: string }>;
  };
}
