import { AppError } from "../../errors/app-error";
import { ConsoleMailSender } from "./console-mail-sender";
import { MailSender } from "./mail-sender";
import { SmtpMailSender } from "./smtp-mail-sender";

export type { MailMessage, MailSender } from "./mail-sender";

const DEFAULT_SMTP_PORT = 587;
const DEFAULT_MAIL_FROM = "PATITAS <no-reply@patitas.local>";

/**
 * En producción el adaptador de consola dejaría los enlaces de verificación y
 * de reset en los logs (cualquiera con acceso a ellos podría tomar una cuenta):
 * se exige SMTP. Es un 503 con el nombre de la variable y no un 500 genérico,
 * así quien opera el despliegue ve qué falta configurar.
 */
export function assertMailConfigured(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === "production" && !env.SMTP_HOST) {
    throw new AppError(
      503,
      "El servicio de correo no está configurado (falta SMTP_HOST)",
      { missingEnvVars: ["SMTP_HOST"] },
      "MAIL_NOT_CONFIGURED"
    );
  }
}

/** Elige el adaptador según el entorno: SMTP si hay SMTP_HOST, consola si no. */
export function createMailSender(env: NodeJS.ProcessEnv = process.env): MailSender {
  assertMailConfigured(env);

  if (!env.SMTP_HOST) {
    return new ConsoleMailSender();
  }

  return new SmtpMailSender({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ? Number(env.SMTP_PORT) : DEFAULT_SMTP_PORT,
    secure: env.SMTP_SECURE === "true",
    user: env.SMTP_USER || undefined,
    pass: env.SMTP_PASS || undefined,
    from: env.MAIL_FROM || DEFAULT_MAIL_FROM,
  });
}

let mailSender: MailSender | undefined;

/** Adaptador compartido, creado en el primer uso (después de que dotenv cargó el .env). */
export function getMailSender(): MailSender {
  mailSender ??= createMailSender();
  return mailSender;
}
