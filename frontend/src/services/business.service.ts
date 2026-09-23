import { api } from "./api";
import type {
  Business,
  BusinessCategory,
  BusinessStats,
  CreateBusinessInput,
  PublicBusiness,
  UpdateBusinessInput,
} from "@/types/business.types";

export function createBusiness(input: CreateBusinessInput): Promise<Business> {
  return api.post<Business>("/businesses", input).then((res) => res.data);
}

export function getMyBusiness(): Promise<Business> {
  return api.get<Business>("/businesses/me").then((res) => res.data);
}

export function updateMyBusiness(input: UpdateBusinessInput): Promise<Business> {
  return api.put<Business>("/businesses/me", input).then((res) => res.data);
}

export function getMyBusinessStats(): Promise<BusinessStats> {
  return api.get<BusinessStats>("/businesses/me/stats").then((res) => res.data);
}

// Directorio público de comercios. `category` filtra por rubro (opcional).
export function listBusinesses(category?: BusinessCategory): Promise<PublicBusiness[]> {
  return api
    .get<PublicBusiness[]>("/businesses", { params: category ? { category } : undefined })
    .then((res) => res.data);
}

// Perfil público. El backend registra el evento VIEW como efecto secundario de
// este GET (businesses.controller.getById → recordView), así que basta con
// pedir el perfil para que la visita quede contabilizada.
export function getBusiness(id: number): Promise<PublicBusiness> {
  return api.get<PublicBusiness>(`/businesses/${id}`).then((res) => res.data);
}

// Registra un contacto hacia el comercio (evento CONTACT). Responde 204 sin
// cuerpo, así que no se devuelve nada.
export function contactBusiness(id: number): Promise<void> {
  return api.post(`/businesses/${id}/contact`).then(() => undefined);
}
