const sendMail = jest.fn();
const createTransport = jest.fn((..._args: unknown[]) => ({ sendMail }));

jest.mock("nodemailer", () => ({
  createTransport: (...args: unknown[]) => createTransport(...args),
}));

import { ConsoleMailSender } from "../../src/services/mail/console-mail-sender";
import * as mailModule from "../../src/services/mail";
import { createMailSender } from "../../src/services/mail";
import { SmtpMailSender } from "../../src/services/mail/smtp-mail-sender";
import * as mailService from "../../src/services/mail.service";

describe("createMailSender", () => {
  test("usa SMTP cuando SMTP_HOST está configurado", () => {
    const sender = createMailSender({
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "465",
      SMTP_SECURE: "true",
      SMTP_USER: "user",
      SMTP_PASS: "pass",
      MAIL_FROM: "PATITAS <hola@patitas.app>",
    });

    expect(sender).toBeInstanceOf(SmtpMailSender);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      auth: { user: "user", pass: "pass" },
    }));
  });

  test("sin credenciales SMTP no manda auth y usa el puerto 587 por defecto", () => {
    createTransport.mockClear();

    createMailSender({ SMTP_HOST: "localhost" });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "localhost", port: 587, secure: false, auth: undefined }),
    );
  });

  test("el transporte SMTP tiene timeouts cortos para no colgar el request", () => {
    createTransport.mockClear();

    createMailSender({ SMTP_HOST: "localhost" });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 }),
    );
  });

  test("sin SMTP_HOST cae al adaptador de consola", () => {
    expect(createMailSender({})).toBeInstanceOf(ConsoleMailSender);
  });

  test("en producción sin SMTP_HOST falla en vez de loguear los enlaces", () => {
    expect(() => createMailSender({ NODE_ENV: "production" })).toThrow(/SMTP_HOST/);
  });
});

describe("SmtpMailSender", () => {
  test("envía el mensaje con el remitente configurado", async () => {
    sendMail.mockResolvedValue({});
    const sender = createMailSender({ SMTP_HOST: "smtp.example.com", MAIL_FROM: "PATITAS <hola@patitas.app>" });

    await sender.send({ to: "ana@example.com", subject: "Hola", text: "texto", html: "<p>texto</p>" });

    expect(sendMail).toHaveBeenCalledWith({
      from: "PATITAS <hola@patitas.app>",
      to: "ana@example.com",
      subject: "Hola",
      text: "texto",
      html: "<p>texto</p>",
    });
  });

  test("propaga el error del transporte", async () => {
    sendMail.mockRejectedValue(new Error("smtp caído"));
    const sender = createMailSender({ SMTP_HOST: "smtp.example.com" });

    await expect(sender.send({ to: "ana@example.com", subject: "Hola", text: "texto" })).rejects.toThrow(
      "smtp caído"
    );
  });
});

describe("ConsoleMailSender", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  test("en desarrollo loguea destinatario, asunto y cuerpo (para copiar los links)", async () => {
    process.env.NODE_ENV = "development";
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await new ConsoleMailSender().send({ to: "ana@example.com", subject: "Verificá", text: "http://link" });

    const output = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(output).toContain("ana@example.com");
    expect(output).toContain("Verificá");
    expect(output).toContain("http://link");
  });

  test("con NODE_ENV=test no ensucia la salida", async () => {
    process.env.NODE_ENV = "test";
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await new ConsoleMailSender().send({ to: "ana@example.com", subject: "Verificá", text: "http://link" });

    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe("mail.service", () => {
  const send = jest.fn();

  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue(undefined);
    jest.spyOn(mailModule, "getMailSender").mockReturnValue({ send });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("sendEmailVerification manda el link de verificación al destinatario", async () => {
    await mailService.sendEmailVerification("ana@example.com", "http://front/verify-email?token=abc");

    expect(send).toHaveBeenCalledTimes(1);
    const message = send.mock.calls[0][0];
    expect(message.to).toBe("ana@example.com");
    expect(message.subject).toMatch(/verific/i);
    expect(message.text).toContain("http://front/verify-email?token=abc");
    expect(message.html).toContain("http://front/verify-email?token=abc");
  });

  test("sendPasswordReset manda el link de restablecimiento al destinatario", async () => {
    await mailService.sendPasswordReset("ana@example.com", "http://front/reset-password?token=abc");

    expect(send).toHaveBeenCalledTimes(1);
    const message = send.mock.calls[0][0];
    expect(message.to).toBe("ana@example.com");
    expect(message.subject).toMatch(/contraseña/i);
    expect(message.text).toContain("http://front/reset-password?token=abc");
    expect(message.html).toContain("http://front/reset-password?token=abc");
  });

  test("propaga el error del adaptador para que el llamador decida", async () => {
    send.mockRejectedValue(new Error("smtp caído"));

    await expect(mailService.sendPasswordReset("ana@example.com", "http://x")).rejects.toThrow("smtp caído");
  });
});
