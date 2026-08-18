export interface Pet {
  id: number;
  userId: number;
  name: string | null;
  species: string | null;
  breed: string | null;
  age: number | null;
  color: string | null;
  description: string | null;
  photoUrls: string[];
  microchipId: string | null;
  createdAt: string;
}

export interface CreatePetInput {
  userId: number;
  name: string;
  species?: string;
  breed: string;
  age: number;
  color: string;
  description: string;
  photoUrls: string[];
  microchipId?: string;
}

export type UpdatePetInput = Partial<Omit<CreatePetInput, "userId">>;
