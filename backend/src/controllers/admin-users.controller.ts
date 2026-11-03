import { Request, Response } from "express";
import * as adminUsersService from "../services/admin-users.service";
import { adminUserIdParamSchema, changeUserRoleSchema } from "../validators/admin-users.validator";

export async function changeRole(req: Request, res: Response): Promise<void> {
  const { id } = adminUserIdParamSchema.parse(req.params);
  const { role } = changeUserRoleSchema.parse(req.body);
  const user = await adminUsersService.changeRole(req.userId!, id, role);
  res.status(200).json(user);
}
