import { Request, Response } from "express";
import * as petsService from "../services/pets.service";
import { createPetSchema, petIdParamSchema, updatePetSchema } from "../validators/pets.validator";

export async function list(_req: Request, res: Response): Promise<void> {
  const pets = await petsService.list();
  res.status(200).json(pets);
}

export async function create(req: Request, res: Response): Promise<void> {
  const data = createPetSchema.parse(req.body);
  const pet = await petsService.create(data);
  res.status(201).json(pet);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = petIdParamSchema.parse(req.params);
  const pet = await petsService.getById(id);
  res.status(200).json(pet);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = petIdParamSchema.parse(req.params);
  const data = updatePetSchema.parse(req.body);
  const pet = await petsService.update(id, data);
  res.status(200).json(pet);
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = petIdParamSchema.parse(req.params);
  await petsService.remove(id);
  res.status(204).send();
}
