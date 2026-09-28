import { ConsoleMailSender } from "./console-mail-sender";
import { MailSender } from "./mail-sender";
import { SmtpMailSender } from "./smtp-mail-sender";

export type { MailMessage, MailSender } from "./mail-sender";

const DEFAULT_SMTP_PORT = 587;
const DEFAULT_MAIL_FROM = "PATITAS <no-reply@patitas.local>";

/** Elige el adaptador según el entorno: SMTP si hay SMTP_HOST, consola si no. */
export function createMailSender(env: NodeJS.ProcessEnv = process.env): MailSender {
  if (!env.SMTP_HOST) {
    // En producción el adaptador de consola dejaría los enlaces de reset en los
    // logs (cualquiera con acceso a ellos podría tomar una cuenta): se exige SMTP.
    if (env.NODE_ENV === "production") {
      throw new Error("SMTP_HOST es obligatorio en producción para enviar mails");
    }
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
