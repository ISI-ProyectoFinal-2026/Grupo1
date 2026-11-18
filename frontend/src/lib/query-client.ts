import { QueryClient } from "@tanstack/react-query";

// único cliente de la app: el interceptor de api.ts lo limpia al perder la sesión
export const queryClient = new QueryClient();
