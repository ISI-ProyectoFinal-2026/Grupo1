# Evidencia — D-09 Registro, verificación de email e inicio de sesión

| Dato | Valor |
| --- | --- |
| Diagrama | `registro-verificacion-sesion.html` (fuente `candidate.json`) |
| Tipo Archify | `workflow` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`registro-verificacion-sesion.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `frontend/src/pages/auth/Register.tsx` | register y navegación |
| `frontend/src/router.tsx` | GuestOnlyRoute |
| `backend/src/routes/auth.routes.ts` | authLimiter y ruta, verify-email y resend, ruta |
| `backend/src/validators/auth.validator.ts` | registerSchema |
| `backend/src/services/auth.service.ts` | register, P2002 → 409, sendVerificationEmail, error de envío, verifyEmail, login, DUMMY_HASH, desafío twoFactorToken, signAccessToken |
| `backend/src/services/auth-tokens.service.ts` | issueAuthToken, consumeAuthToken |
| `frontend/src/pages/auth/VerifyEmailPage.tsx` | redirección |
| `backend/src/services/two-factor/service.ts` | loginWithSecondFactor |
| `frontend/src/pages/auth/Login.tsx` | navega a / |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| Formulario /register — email y contraseña | Verificado en código | `frontend/src/pages/auth/Register.tsx:39-40`; `frontend/src/router.tsx:38-44` |
| POST /api/auth/register — Zod + bcrypt costo 12 | Verificado en código | `backend/src/routes/auth.routes.ts:10-31`; `backend/src/validators/auth.validator.ts:5-19`; `backend/src/services/auth.service.ts:36-60` |
| 409 email registrado — P2002 en users.email | Verificado en código | `backend/src/services/auth.service.ts:44-48` |
| Token y mail de verificación — auth_tokens sha256, 24 h | Verificado en código | `backend/src/services/auth.service.ts:31-34`; `backend/src/services/auth-tokens.service.ts:39-63`; `backend/src/services/auth.service.ts:51-57` |
| POST /api/auth/verify-email — consume token, sella email_verified_at | Verificado en código | `backend/src/routes/auth.routes.ts:44-45`; `backend/src/services/auth.service.ts:106-115`; `frontend/src/pages/auth/VerifyEmailPage.tsx:45-54` |
| 400 enlace inválido — usado, vencido o inexistente | Verificado en código | `backend/src/services/auth-tokens.service.ts:112-131` |
| POST /api/auth/login — compara contra hash real o ficticio | Verificado en código | `backend/src/routes/auth.routes.ts:32`; `backend/src/services/auth.service.ts:66-96` |
| 401 credenciales inválidas — mismo mensaje exista o no | Verificado en código | `backend/src/services/auth.service.ts:69-75` |
| POST /api/auth/2fa/login — TOTP o código de recuperación | Verificado en código | `backend/src/services/auth.service.ts:82-93`; `backend/src/services/two-factor/service.ts:91-125` |
| Sesión con JWT — claims sub, email, tv | Verificado en código | `backend/src/services/auth.service.ts:95`; `frontend/src/pages/auth/Login.tsx:72` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- La recuperación de contraseña y el reinicio del 2FA no se representan; tienen rutas propias en `backend/src/routes/auth.routes.ts:39-47`.
- El envío real por SMTP no se ejecutó; sin `SMTP_HOST` el mail se imprime en consola (`backend/src/services/mail/index.ts`, no citado en el diagrama).
- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
