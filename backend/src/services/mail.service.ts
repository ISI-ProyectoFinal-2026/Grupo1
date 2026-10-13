import * as mail from "./mail";

/**
 * Los mails concretos que manda la app. Reciben el link ya armado: saber a qué
 * ruta del frontend apunta cada uno es asunto de quien emite el token.
 */

function linkParagraph(intro: string, link: string, outro: string) {
  return {
    text: `${intro}\n\n${link}\n\n${outro}`,
    html: `<p>${intro}</p><p><a href="${link}">${link}</a></p><p>${outro}</p>`,
  };
}

export async function sendEmailVerification(to: string, link: string): Promise<void> {
  const body = linkParagraph(
    "¡Bienvenido a PATITAS! Para verificar tu email entrá a este enlace:",
    link,
    "El enlace vence en 24 horas. Si no creaste una cuenta, ignorá este mensaje."
  );
  await mail.getMailSender().send({ to, subject: "Verificá tu email en PATITAS", ...body });
}

export async function sendPasswordReset(to: string, link: string): Promise<void> {
  const body = linkParagraph(
    "Pediste restablecer tu contraseña de PATITAS. Para elegir una nueva entrá a este enlace:",
    link,
    "El enlace vence en 30 minutos. Si no fuiste vos, ignorá este mensaje: tu contraseña no cambia."
  );
  await mail.getMailSender().send({ to, subject: "Restablecé tu contraseña de PATITAS", ...body });
}
