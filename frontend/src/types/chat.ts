// Nota: el backend todavía no expone endpoints REST para chat/mensajes
// (los modelos Chat/Message existen en Prisma pero sin ruta/controller).
// Estos tipos reflejan el schema para que la UI pueda tiparse desde ya.

export interface Chat {
  id: number;
  userAId: number;
  userBId: number;
  reportId: number | null;
  createdAt: string;
}

export interface Message {
  id: number;
  chatId: number;
  senderId: number;
  content: string | null;
  createdAt: string;
}
