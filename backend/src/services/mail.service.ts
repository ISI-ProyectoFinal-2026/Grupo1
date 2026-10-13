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

export async function sendTwoFactorRecoveryCodeUsed(to: string, remaining: number): Promise<void> {
  const left =
    remaining === 0
      ? "Ya no te quedan códigos de recuperación: generá un juego nuevo desde la sección de seguridad."
      : remaining === 1
        ? "Te queda 1 código de recuperación."
        : `Te quedan ${remaining} códigos de recuperación.`;
  const intro = "Iniciaron sesión en tu cuenta de PATITAS con un código de recuperación del segundo factor.";
  const sessions = "Por seguridad, se cerraron las demás sesiones abiertas.";
  const warning = "Si no fuiste vos, cambiá tu contraseña y revisá la seguridad de tu cuenta de inmediato.";
  await mail.getMailSender().send({
    to,
    subject: "Se usó un código de recuperación en tu cuenta de PATITAS",
    text: `${intro} ${left} ${sessions}\n\n${warning}`,
    html: `<p>${intro} ${left} ${sessions}</p><p>${warning}</p>`,
  });
}

export async function sendTwoFactorEnabled(to: string): Promise<void> {
  const intro = "Se activó la verificación en dos pasos en tu cuenta de PATITAS.";
  const detail =
    "A partir de ahora, para iniciar sesión vas a necesitar tu contraseña y un código de tu app de autenticación. Por seguridad, se cerraron las demás sesiones abiertas.";
  const warning = "Si no fuiste vos, cambiá tu contraseña y revisá la seguridad de tu cuenta de inmediato.";
  await mail.getMailSender().send({
    to,
    subject: "Verificación en dos pasos activada en PATITAS",
    text: `${intro} ${detail}

${warning}`,
    html: `<p>${intro} ${detail}</p><p>${warning}</p>`,
  });
}

export async function sendTwoFactorDisabled(to: string): Promise<void> {
  const intro = "Se desactivó la verificación en dos pasos en tu cuenta de PATITAS.";
  const detail =
    "Ahora alcanza con tu contraseña para iniciar sesión. Por seguridad, se cerraron las demás sesiones abiertas.";
  const warning = "Si no fuiste vos, cambiá tu contraseña y revisá la seguridad de tu cuenta de inmediato.";
  await mail.getMailSender().send({
    to,
    subject: "Verificación en dos pasos desactivada en PATITAS",
    text: `${intro} ${detail}

${warning}`,
    html: `<p>${intro} ${detail}</p><p>${warning}</p>`,
  });
}
