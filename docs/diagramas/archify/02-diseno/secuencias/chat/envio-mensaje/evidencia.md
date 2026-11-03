# Evidencia — D-37 Envío de un mensaje de chat por Socket.IO o REST

| Dato | Valor |
| --- | --- |
| Diagrama | `envio-mensaje.html` (fuente `candidate.json`) |
| Tipo Archify | `sequence` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`envio-mensaje.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `frontend/src/router.tsx` | /chats/:id |
| `frontend/src/hooks/useChatSocket.ts` | join y sendMessage |
| `backend/src/sockets/chat.socket.ts` | handleSendMessage, handshake y eventos, emit receive_message |
| `backend/src/routes/chats.routes.ts` | POST /:id/messages |
| `backend/src/controllers/chats.controller.ts` | sendMessage |
| `backend/src/services/chats.service.ts` | assertParticipant |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| Emisor — participante del chat | Verificado en código | `frontend/src/router.tsx:59-60` |
| Frontend — useChatSocket | Verificado en código | `frontend/src/hooks/useChatSocket.ts:140-199` |
| Socket.IO — chat.socket | Verificado en código | `backend/src/sockets/chat.socket.ts:83-111`; `backend/src/sockets/chat.socket.ts:121-182` |
| API REST — chats.controller | Verificado en código | `backend/src/routes/chats.routes.ts:10`; `backend/src/controllers/chats.controller.ts:26-42` |
| PostgreSQL — chats, messages | Verificado en código | `backend/src/services/chats.service.ts:88-97` |
| Receptor — en la sala chat:<id> | Verificado en código | `backend/src/sockets/chat.socket.ts:104` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- Primera ejecución fallida en `validate` (`sequence/note-overlap`); se desplazaron mensajes sin cambiar orden ni contenido.
- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
