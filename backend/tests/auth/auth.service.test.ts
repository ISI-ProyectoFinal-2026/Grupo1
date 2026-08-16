import { prisma } from "../../src/db/client";
import { AppError } from "../../src/errors/app-error";
import * as authService from "../../src/services/auth.service";

describe("auth.service", () => {
  const createdEmails: string[] = [];

  afterEach(async () => {
    while (createdEmails.length > 0) {
      const email = createdEmails.pop()!;
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function uniqueEmail(prefix: string): string {
    const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    createdEmails.push(email);
    return email;
  }

  describe("register()", () => {
    test("crea un usuario y nunca devuelve passwordHash", async () => {
      const email = uniqueEmail("register-service");

      const user = await authService.register({ email, password: "Password123" });

      expect(user.id).toBeDefined();
      expect(user.email).toBe(email);
      expect(user).not.toHaveProperty("passwordHash");
    });

    test("persiste el usuario con el password hasheado en la base", async () => {
      const email = uniqueEmail("register-hash");

      await authService.register({ email, password: "Password123" });

      const stored = await prisma.user.findUnique({ where: { email } });
      expect(stored?.passwordHash).toBeDefined();
      expect(stored?.passwordHash).not.toBe("Password123");
    });

    test("lanza AppError 409 si el email ya está registrado", async () => {
      const email = uniqueEmail("register-dup");
      await authService.register({ email, password: "Password123" });

      await expect(authService.register({ email, password: "Password123" })).rejects.toMatchObject(
        new AppError(409, "El email ya está registrado")
      );
    });
  });

  describe("login()", () => {
    test("devuelve un token y el usuario sin passwordHash con credenciales correctas", async () => {
      const email = uniqueEmail("login-ok");
      await authService.register({ email, password: "Password123" });

      const result = await authService.login({ email, password: "Password123" });

      expect(typeof result.token).toBe("string");
      expect(result.token.length).toBeGreaterThan(0);
      expect(result.token.split(".")).toHaveLength(3);
      expect(result.user.email).toBe(email);
      expect(result.user).not.toHaveProperty("passwordHash");
    });

    test("lanza AppError 401 con mensaje genérico si la contraseña es incorrecta", async () => {
      const email = uniqueEmail("login-badpass");
      await authService.register({ email, password: "Password123" });

      await expect(authService.login({ email, password: "WrongPass123" })).rejects.toMatchObject(
        new AppError(401, "Credenciales inválidas")
      );
    });

    test("lanza AppError 401 con el mismo mensaje genérico si el email no existe", async () => {
      await expect(
        authService.login({ email: "no-existe-nunca@example.com", password: "WrongPass123" })
      ).rejects.toMatchObject(new AppError(401, "Credenciales inválidas"));
    });

    test("los mensajes de error de email inexistente y contraseña incorrecta son idénticos", async () => {
      const email = uniqueEmail("login-enum");
      await authService.register({ email, password: "Password123" });

      let wrongPasswordMessage: string | undefined;
      let nonexistentEmailMessage: string | undefined;

      try {
        await authService.login({ email, password: "WrongPass123" });
      } catch (error) {
        wrongPasswordMessage = (error as AppError).message;
      }

      try {
        await authService.login({ email: "otro-no-existe@example.com", password: "WrongPass123" });
      } catch (error) {
        nonexistentEmailMessage = (error as AppError).message;
      }

      expect(wrongPasswordMessage).toBeDefined();
      expect(wrongPasswordMessage).toBe(nonexistentEmailMessage);
    });
  });
});
