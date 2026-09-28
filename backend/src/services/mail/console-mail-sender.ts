import { MailMessage, MailSender } from "./mail-sender";

/**
 * Adaptador para cuando no hay SMTP configurado: en vez de mandar el mail lo
 * imprime, así en desarrollo se pueden copiar los links de verificación o de
 * reset desde la consola. Bajo NODE_ENV=test no imprime nada para no ensuciar
 * la salida de Jest.
 */
export class ConsoleMailSender implements MailSender {
  async send(message: MailMessage): Promise<void> {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    console.log(
      [
        "[mail] SMTP no configurado, el mail no se envió. Contenido:",
        `  Para: ${message.to}`,
        `  Asunto: ${message.subject}`,
        "",
        message.text,
      ].join("\n")
    );
  }
}
