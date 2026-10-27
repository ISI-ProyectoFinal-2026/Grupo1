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

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

// Solo componentes numéricos: los separadores de ICU cambian entre versiones de Node.
const ARGENTINA_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Fecha legible en hora de Argentina; el mail no sabe en qué huso está quien lo lee. */
function formatArgentinaDate(date: Date): string {
  const p = Object.fromEntries(ARGENTINA_PARTS.formatToParts(date).map(({ type, value }) => [type, value]));
  const month = MONTHS[Number(p.month) - 1];
  return `${p.day} de ${month} de ${p.year} a las ${p.hour}:${p.minute} (hora de Argentina)`;
}

export async function sendTwoFactorResetLink(to: string, link: string): Promise<void> {
  const body = linkParagraph(
    "Pediste reiniciar el segundo factor de tu cuenta de PATITAS porque perdiste el acceso a tu app de autenticación. Para empezar el reinicio confirmalo en este enlace:",
    link,
    "El enlace vence en 30 minutos. Después de confirmarlo hay una espera de 72 horas antes de que se desactive el segundo factor, y vas a poder cancelarlo. Si no fuiste vos, ignorá este mensaje: no cambia nada."
  );
  await mail.getMailSender().send({ to, subject: "Confirmá el reinicio del segundo factor en PATITAS", ...body });
}

export async function sendTwoFactorResetPending(to: string, cancelLink: string, effectiveAt: Date): Promise<void> {
  const when = formatArgentinaDate(effectiveAt);
  const body = linkParagraph(
    `Confirmaste el reinicio del segundo factor de tu cuenta de PATITAS. Se completa el ${when}: desde ese momento, el próximo inicio de sesión con tu contraseña entra sin segundo factor. Si no fuiste vos, cancelalo en este enlace:`,
    cancelLink,
    "El reinicio también se cancela si iniciás sesión con un código de tu app de autenticación o con un código de recuperación. Si no reconocés este pedido, cambiá tu contraseña."
  );
  await mail.getMailSender().send({ to, subject: "Reinicio del segundo factor en curso en PATITAS", ...body });
}

export async function sendTwoFactorResetCancelled(to: string): Promise<void> {
  const intro = "Se canceló el reinicio del segundo factor de tu cuenta de PATITAS.";
  const detail = "Tu verificación en dos pasos sigue activa y para iniciar sesión vas a seguir necesitando el código.";
  await mail.getMailSender().send({
    to,
    subject: "Se canceló el reinicio del segundo factor en PATITAS",
    text: `${intro} ${detail}`,
    html: `<p>${intro} ${detail}</p>`,
  });
}

export async function sendTwoFactorResetCompleted(to: string): Promise<void> {
  const intro = "Se completó el reinicio del segundo factor de tu cuenta de PATITAS: la verificación en dos pasos quedó desactivada.";
  const detail =
    "Por seguridad, se cerraron las demás sesiones abiertas. Podés volver a activarla desde la sección de seguridad de tu cuenta.";
  const warning = "Si no fuiste vos, cambiá tu contraseña y revisá la seguridad de tu cuenta de inmediato.";
  await mail.getMailSender().send({
    to,
    subject: "Se desactivó el segundo factor de tu cuenta de PATITAS",
    text: `${intro} ${detail}\n\n${warning}`,
    html: `<p>${intro} ${detail}</p><p>${warning}</p>`,
  });
}
