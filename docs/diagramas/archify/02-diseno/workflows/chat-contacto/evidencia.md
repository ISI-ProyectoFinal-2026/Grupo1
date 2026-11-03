# Evidencia — D-14 Contacto con el autor de un reporte por chat

| Dato | Valor |
| --- | --- |
| Diagrama | `chat-contacto.html` (fuente `candidate.json`) |
| Tipo Archify | `workflow` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`chat-contacto.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `frontend/src/pages/reports/ReportDetailPage.tsx` | canContact, botón |
| `backend/src/routes/chats.routes.ts` | requireVerifiedEmail |
| `backend/src/controllers/chats.controller.ts` | create, getMessages, sendMessage, emit desde REST |
| `backend/src/services/chats.service.ts` | createChat, validaciones, assertParticipant |
| `backend/src/sockets/chat.socket.ts` | io.use, join_chat, handleSendMessage, envíos encadenados, catch, createMessage y aviso, emit y ack |
| `frontend/src/hooks/useChatSocket.ts` | fallback REST |
| `backend/src/services/notifications.service.ts` | notifyNewMessage |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| Contactar al autor — solo quien no es el autor | Verificado en código | `frontend/src/pages/reports/ReportDetailPage.tsx:146`; `frontend/src/pages/reports/ReportDetailPage.tsx:383` |
| POST /api/chats — 201 nuevo o 200 existente | Verificado en código | `backend/src/routes/chats.routes.ts:8`; `backend/src/controllers/chats.controller.ts:12-17`; `backend/src/services/chats.service.ts:34-82` |
| 400, 403 o 404 — consigo mismo, no autor, sin reporte | Verificado en código | `backend/src/services/chats.service.ts:39-51` |
| GET /api/chats/:id/messages — solo participantes | Verificado en código | `backend/src/controllers/chats.controller.ts:19-24`; `backend/src/services/chats.service.ts:88-97` |
| Handshake y join_chat — JWT validado, sala chat:<id> | Verificado en código | `backend/src/sockets/chat.socket.ts:121-140`; `backend/src/sockets/chat.socket.ts:143-154` |
| send_message — Zod, email verificado, participante | Verificado en código | `backend/src/sockets/chat.socket.ts:83-95`; `backend/src/sockets/chat.socket.ts:178-182` |
| POST /api/chats/:id/messages — alternativa sin socket | Verificado en código | `frontend/src/hooks/useChatSocket.ts:163-178`; `backend/src/controllers/chats.controller.ts:26-42` |
| Error por ack y evento error — la conexión sigue abierta | Verificado en código | `backend/src/sockets/chat.socket.ts:106-110` |
| INSERT messages — y notificación message | Verificado en código | `backend/src/sockets/chat.socket.ts:95-102`; `backend/src/services/notifications.service.ts:196` |
| Recibe receive_message — emitido a la sala del chat | Verificado en código | `backend/src/sockets/chat.socket.ts:104-105`; `backend/src/controllers/chats.controller.ts:40-41` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- La subida de imágenes del chat a R2 no se representa como paso propio.
- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
