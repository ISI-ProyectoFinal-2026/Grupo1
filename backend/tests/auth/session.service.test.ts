import jwt from "jsonwebtoken";
import { prisma } from "../../src/db/client";
import { authenticateAccessToken } from "../../src/services/session.service";
import { signAccessToken, verifyAccessToken } from "../../src/utils/jwt";

describe("session.service — authenticateAccessToken()", () => {
  const createdUserIds: number[] = [];

  async function createUser(data: { tokenVersion?: number; emailVerifiedAt?: Date | null } = {}) {
    const user = await prisma.user.create({
      data: {
        email: `session-service-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        passwordHash: "test-hash",
        ...data,
      },
    });
    createdUserIds.push(user.id);
    return user;
  }

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  test("con un token válido devuelve id, rol, verificación y versión de sesión", async () => {
    const verifiedAt = new Date("2026-09-01T10:00:00.000Z");
    const user = await createUser({ emailVerifiedAt: verifiedAt });

    const authUser = await authenticateAccessToken(signAccessToken(user));

    expect(authUser).toEqual({
      id: user.id,
      role: "usuario_regular",
      emailVerifiedAt: verifiedAt,
      tokenVersion: 0,
    });
  });

  test("signAccessToken embebe la versión de sesión como `tv`", async () => {
    const user = await createUser({ tokenVersion: 4 });

    const payload = verifyAccessToken(signAccessToken(user));

    expect(payload).toEqual(expect.objectContaining({ sub: user.id, email: user.email, tv: 4 }));
  });

  test("un token sin `tv` (emitido antes de este cambio) sigue valiendo si la versión es 0", async () => {
    const user = await createUser();
    const legacyToken = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    await expect(authenticateAccessToken(legacyToken)).resolves.toEqual(expect.objectContaining({ id: user.id }));
  });

  test("rechaza con 401 un token cuya versión de sesión quedó vieja", async () => {
    const user = await createUser();
    const token = signAccessToken(user);
    await prisma.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });

    await expect(authenticateAccessToken(token)).rejects.toMatchObject({
      statusCode: 401,
      message: "Tu sesión expiró, iniciá sesión de nuevo",
    });
  });

  test("rechaza con 401 el token de un usuario borrado", async () => {
    const user = await createUser();
    const token = signAccessToken(user);
    await prisma.user.delete({ where: { id: user.id } });

    await expect(authenticateAccessToken(token)).rejects.toMatchObject({ statusCode: 401, message: "Token inválido" });
  });

  test("rechaza con 401 un token expirado con el mensaje de expiración", async () => {
    const user = await createUser();
    const expired = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: -1 });

    await expect(authenticateAccessToken(expired)).rejects.toMatchObject({
      statusCode: 401,
      message: "El token expiró, iniciá sesión nuevamente",
    });
  });

  test("rechaza con 401 un token mal formado", async () => {
    await expect(authenticateAccessToken("no-es-un-jwt")).rejects.toMatchObject({
      statusCode: 401,
      message: "Token inválido",
    });
  });

  test("rechaza con 401 un token firmado cuyo `sub` no es un id válido", async () => {
    const token = jwt.sign({ sub: "no-es-un-id", email: "x@example.com" }, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });

    await expect(authenticateAccessToken(token)).rejects.toMatchObject({ statusCode: 401, message: "Token inválido" });
  });
});
