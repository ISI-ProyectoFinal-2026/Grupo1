import nodemailer, { Transporter } from "nodemailer";
import { MailMessage, MailSender } from "./mail-sender";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

export class SmtpMailSender implements MailSender {
  private readonly transporter: Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      // Sin usuario se asume un relay sin autenticación (ej. Mailpit en local).
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      // Los defaults de nodemailer llegan a minutos: con el SMTP caído el
      // registro quedaría colgado y el cliente reintentaría contra un 409.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.config.from, ...message });
  }
}
