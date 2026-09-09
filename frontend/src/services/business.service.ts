import { api } from "./api";
import type {
  Business,
  BusinessStats,
  CreateBusinessInput,
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
