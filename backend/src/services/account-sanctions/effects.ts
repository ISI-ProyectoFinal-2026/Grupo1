import { AccountSanction } from "@prisma/client";
import { prisma } from "../../db/client";
import { getChatIO, userRoom } from "../../sockets/chat.socket";
import * as mailService from "../mail.service";

// efectos posteriores al commit de una sanción vigente; nunca lanzan
export async function applySanctionEffects(sanction: AccountSanction): Promise<void> {
  if (sanction.status !== "active") return;
  try {
    getChatIO()?.in(userRoom(sanction.userId)).disconnectSockets(true);
    const user = await prisma.user.findUnique({ where: { id: sanction.userId }, select: { email: true } });
    if (user) await mailService.sendAccountSuspended(user.email, sanction);
  } catch (error) {
    console.error(`[sanciones] no se pudo completar el aviso de la sanción ${sanction.id}:`, error);
  }
}

// aviso posterior al commit de una suspensión revertida; nunca lanza
export async function applyReinstatementEffects(sanction: AccountSanction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: sanction.userId }, select: { email: true } });
    if (user) await mailService.sendAccountReinstated(user.email);
  } catch (error) {
    console.error(`[sanciones] no se pudo avisar la reactivación de la sanción ${sanction.id}:`, error);
  }
}
