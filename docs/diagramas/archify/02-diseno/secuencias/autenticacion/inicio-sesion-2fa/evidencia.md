# Evidencia — D-16 Inicio de sesión con segundo factor opcional

| Dato | Valor |
| --- | --- |
| Diagrama | `inicio-sesion-2fa.html` (fuente `candidate.json`) |
| Tipo Archify | `sequence` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`inicio-sesion-2fa.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `frontend/src/router.tsx` | /login |
| `frontend/src/pages/auth/Login.tsx` | pasos del login |
| `frontend/src/stores/auth.store.ts` | persist |
| `backend/src/routes/auth.routes.ts` | login y 2fa/login |
| `backend/src/services/auth.service.ts` | login |
| `backend/src/services/two-factor/service.ts` | loginWithSecondFactor, avisos por mail |
| `backend/src/services/auth-tokens.service.ts` | issueAuthToken |
| `backend/src/services/two-factor/verify.ts` | bloqueo |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| Usuario — navegador | Verificado en código | `frontend/src/router.tsx:38-44` |
| Frontend — Login.tsx + auth.store | Verificado en código | `frontend/src/pages/auth/Login.tsx:90-146`; `frontend/src/stores/auth.store.ts:15-24` |
| API /api/auth — auth.service, two-factor | Verificado en código | `backend/src/routes/auth.routes.ts:31-33`; `backend/src/services/auth.service.ts:66-96`; `backend/src/services/two-factor/service.ts:91-125` |
| PostgreSQL — users, auth_tokens | Verificado en código | `backend/src/services/auth-tokens.service.ts:39-63`; `backend/src/services/two-factor/verify.ts:14-17` |
| SMTP — nodemailer | Verificado en código | `backend/src/services/two-factor/service.ts:115-122` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- Las tres respuestas del primer paso son alternativas excluyentes; el renderer no dibuja bloques `alt`, se aclaran en una tarjeta.
- El reinicio demorado del 2FA (`completeMaturedReset`) no se representa.
- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
