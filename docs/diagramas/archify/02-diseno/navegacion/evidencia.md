# Evidencia — PATITAS: mapa de navegación

| Dato | Valor |
| --- | --- |
| Diagrama | `navegacion.html` (fuente `candidate.json`) |
| Tipo Archify | `tree` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`navegacion.finalize.json`) |

## Fuentes

| Fuente | Contenido usado |
| --- | --- |
| `frontend/src/router.tsx:32-87` | Rutas, pantallas y anidamiento de guardas |
| `frontend/src/components/GuestOnlyRoute.tsx:6-13` | Con sesión redirige a `/` |
| `frontend/src/components/ProtectedRoute.tsx:4-11` | Sin sesión redirige a `/login` |
| `frontend/src/components/RequireRole.tsx:16-23` | Rol insuficiente redirige a `/` |
| `frontend/src/layouts/MainLayout.tsx:43-55`, `:169-316` | Barra principal (Reportes, Chats, Reportar, Comercios) y menú "Más" (Mis mascotas, Mi comercio, Moderación, Notificaciones, Seguridad) |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| Solo invitados: `/login`, `/register` | Verificado | `router.tsx:38-44` |
| Públicas por enlace de email (5 rutas) | Verificado | `router.tsx:45-50` |
| Autenticadas: inicio, reportes, chats, comercios, mi comercio, mascotas, cuenta | Verificado | `router.tsx:51-70` |
| Moderación: `moderador` o `admin` | Verificado | `router.tsx:75-78`; `MainLayout.tsx:273-283` |
| `*` NotFound y `errorElement` | Verificado | `router.tsx:36`, `:83-86` |

## Criterios aplicados

- Niveles: router → layout → acceso → sección → pantalla. Solo se representan los guardas definidos en el código.
- Las secciones agrupan pantallas según el menú de `MainLayout`; no se dibujan servicios del backend.
- No existe acceso por rol "comercio": "Mi comercio" está disponible para cualquier usuario autenticado.
- Los guardas del frontend solo controlan la navegación; la autorización la aplica el backend.
- Revisión visual parcial: se inspeccionó solo la parte superior de la captura de `visual-check/` (el árbol requiere desplazamiento vertical).
