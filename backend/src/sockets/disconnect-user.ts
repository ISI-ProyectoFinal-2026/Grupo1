import { getChatIO, userRoom } from "./chat.socket";

// desconecta los sockets del usuario; llamar después del commit
export function disconnectUserSockets(userId: number): void {
  getChatIO()?.in(userRoom(userId)).disconnectSockets(true);
}
