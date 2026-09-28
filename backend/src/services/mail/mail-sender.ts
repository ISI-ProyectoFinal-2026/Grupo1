export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Puerto de envío de mails. El resto del backend depende solo de esto, no del
 * proveedor: hoy hay un adaptador SMTP (cualquier proveedor que lo hable) y uno
 * de consola para desarrollo y tests.
 */
export interface MailSender {
  send(message: MailMessage): Promise<void>;
}
