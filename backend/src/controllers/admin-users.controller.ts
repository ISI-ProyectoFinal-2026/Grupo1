import { Request, Response } from "express";
import * as adminUsersService from "../services/admin-users.service";
import {
  adminUserIdParamSchema,
  changeUserRoleSchema,
  listRoleAuditQuerySchema,
  listUsersQuerySchema,
} from "../validators/admin-users.validator";

export async function listUsers(req: Request, res: Response): Promise<void> {
  const query = listUsersQuerySchema.parse(req.query);
  res.status(200).json(await adminUsersService.listUsers(query));
}

export async function listRoleAudit(req: Request, res: Response): Promise<void> {
  const query = listRoleAuditQuerySchema.parse(req.query);
  res.status(200).json(await adminUsersService.listRoleAudit(query));
}

export async function changeRole(req: Request, res: Response): Promise<void> {
  const { id } = adminUserIdParamSchema.parse(req.params);
  const { role } = changeUserRoleSchema.parse(req.body);
  const user = await adminUsersService.changeRole(req.userId!, id, role);
  res.status(200).json(user);
}
