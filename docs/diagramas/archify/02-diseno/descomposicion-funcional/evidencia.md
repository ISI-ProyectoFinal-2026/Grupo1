# Evidencia — PATITAS: descomposición funcional

| Dato | Valor |
| --- | --- |
| Diagrama | `descomposicion-funcional.html` (fuente `candidate.json`) |
| Tipo Archify | `tree` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`descomposicion-funcional.finalize.json`) |

## Fuentes

| Fuente | Contenido usado |
| --- | --- |
| `backend/src/app.ts:40-53` y `backend/src/routes/*.ts` | Módulos y funcionalidades del backend |
| `frontend/src/router.tsx:32-87` | Pantallas asociadas a cada funcionalidad |
| `backend/src/services/matching.service.ts:74-125`, `:307-318`, `:404-410` | Moderación automática, reconciliación y decisión de match |
| `backend-ia/app/main.py:93-166`, `backend-ia/app/services/matching_service.py:73-161`, `backend-ia/app/ml/pipeline.py:24-28` | Funcionalidades del Backend IA |
| `backend/src/services/notifications.service.ts:119`, `:155`, `:224` | Avisos de match, estado y zona |
| `backend/src/services/payments/index.ts:7-14` | Pago simulado (estado parcial) |
| `docs/informe/1-2-1-objetivos-y-alcances.md:42`, `:68`; `docs/adr/0024-modelo-monetizacion.md:47` | Elementos proyectados |

## Verificación por elemento

| Módulo / submódulo | Estado | Evidencia |
| --- | --- | --- |
| Autenticación; 2FA TOTP | Implementado | `auth.routes.ts:31-47` |
| Suspensión de cuentas | Proyectado (issue #38) | `1-2-1-objetivos-y-alcances.md:68` |
| Gestión de reportes, mascotas, mapa y geolocalización | Implementado | `reports.routes.ts:20-50`; `pets.routes.ts:7-11`; `geo.routes.ts:6-7` |
| Moderación automática, matching, análisis previo de imagen | Implementado | `matching.service.ts:74-125`; `main.py:112-166` |
| Chat, notificaciones en la aplicación, preferencias | Implementado | `chats.routes.ts:7-10`; `notifications.routes.ts:8-14`; `notification-preferences.routes.ts:7-10` |
| Notificaciones por email o push | Proyectado (issue #32) | `1-2-1-objetivos-y-alcances.md:42`; sin envío por correo en `notifications.service.ts` |
| Denuncias de reportes y anuncios; panel de moderación | Implementado | `report-flags.routes.ts:10-11`; `ad-flags.routes.ts:8-9`; `router.tsx:75-78` |
| Perfil y directorio de comercios; anuncios segmentados | Implementado | `businesses.routes.ts:11-20`; `business-ads.routes.ts:9-14`; `ads.routes.ts:10-13` |
| Plan Premium | Parcial (pago simulado) | `payments/index.ts:7-14` |
| Pasarela de pago real | Proyectado | ADR-0024:47 |
| Salud del servicio | Implementado | `health.routes.ts:8-20`; `main.py:93-109` |

## Criterios aplicados

- Niveles: sistema → módulo → submódulo → funcionalidad. El estado figura en la subetiqueta del submódulo; las funcionalidades lo heredan.
- "Proyectado" solo se usa para elementos documentados en el informe o en un ADR y ausentes del código.
- La gamificación no se dibuja: el informe la declara fuera de alcance (`1-2-1-objetivos-y-alcances.md:43`).
- Revisión visual parcial: se inspeccionó solo la parte superior de la captura de `visual-check/` (el árbol requiere desplazamiento vertical).
