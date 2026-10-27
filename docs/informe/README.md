# Informe final (fuente en Markdown)

Fuente del informe final del proyecto Patitas. Refleja la numeración de la plantilla [`Template Presentacion Final (1).docx`](../Template%20Presentacion%20Final%20(1).docx). La Fase A cierra el 2026-11-03 para la revisión del 2026-11-04; la Fase B (incluida la generación del `.docx`) queda para después.

## Cómo usarlo

1. Buscar la sección en la tabla y abrir su archivo.
2. Cada afirmación o número cita un artefacto del repositorio (código, CI, PR, ADR, resultado del benchmark). Lo que no existe figura como `No disponible`.
3. Cada tecnología enlaza a su [ADR](../adr/README.md); las de IA enlazan además a un gráfico de `backend-ia/benchmarks/results/` y al comando que lo reproduce.

## Secciones

Evidencia: **R** repositorio, **I** entrevista, **N** no disponible todavía.

| Sección de la plantilla | Archivo | Fase | Evidencia |
|---|---|---|---|
| 1.1 Definición de requerimientos | — | B | I / N |
| 1.2.1 Objetivos y alcances definitivos | `1-2-1-objetivos-y-alcances.md` | A | R (PDD, código, issues) |
| 1.2.2 Modelo funcional (casos de uso, requerimientos, tareas) | `1-2-2-modelo-funcional.md` | A | R (PDD, issues, código) |
| 1.2.2.2 Historias de usuario y flujos por módulo | `1-2-2-2-historias-y-flujos.md` | A | R (issues, código) |
| 1.2.3 Pantallas y reportes (paleta, fuentes, pantallas) | `1-2-3-pantallas.md` | A | R (frontend) |
| 1.2.4 Modelo de datos | `1-2-4-modelo-de-datos.md` | A | R |
| 1.3.1 Programación y documentación | `1-3-1-programacion-y-documentacion.md` | A | R, ADR |
| 1.3.2, 1.3.4, 1.3.5 Capacitación, manuales, implementación | — | B | I |
| 1.3.3 Pruebas (1.3.3.5 `No disponible`, #40) | `1-3-3-pruebas.md` | A | R |
| 2.1 Actividades e hitos | — | B | R + I |
| 2.2.1 Equipo de trabajo | `2-2-1-equipo-de-trabajo.md` | A | R |
| 2.2.2.1-2.2.2.3 Comunicación, avance, devoluciones | `2-2-2-comunicacion-y-decisiones.md` | B | I |
| 2.2.2.4 Decisiones | `2-2-2-comunicacion-y-decisiones.md` | A | ADR |
| 2.2.3 Gestión de configuración | `2-2-3-gestion-de-configuracion.md` | A | R |
| 2.3.1, 2.3.2.1 Recursos, factibilidad operativa | — | B | I |
| 2.3.2.2 Factibilidad técnica (.1, .2, .4-.6, .11-.14, .16-.19) | `2-3-2-2-factibilidad-tecnica.md` | A | ADR, benchmark, código |
| 2.3.2.2 Factibilidad técnica (.3, .7-.10, .15) | `2-3-2-2-factibilidad-tecnica.md` | B | I |
| 2.3.2.3-2.3.5 Legal, ambiental, social, costos, riesgos | — | B | I / N |
| 3 Conclusión | — | B | — |
| 4 Referencias | `4-referencias.md` | A (parcial) | R |
| 5-8 Índices | — | B | generado con el `.docx` |
| Anexos 1-11 | `anexos/` | B | I / R |

Las subsecciones de Fase B dentro de un archivo de Fase A llevan el título y la marca `Pendiente (Fase B)`.

## Convención de archivos

- Un archivo por grupo de secciones, nombrado con la numeración de la plantilla.
- Encabezado YAML:

```yaml
---
seccion: "2.3.2.2"
titulo: "Factibilidad técnica"
nivel: 3
fase: A
estado: borrador
actualizado: 2026-10-22
---
```

| Campo | Valor |
|---|---|
| `seccion` | Número de la plantilla de la sección raíz del archivo |
| `titulo` | Título de la plantilla |
| `nivel` | Nivel de título (TituloN) del H1; permite desplazar los niveles al generar el `.docx` |
| `fase` | `A` o `B` |
| `estado` | `borrador`, `revisado` o `pendiente` |
| `actualizado` | Fecha de la última edición (AAAA-MM-DD) |

- Enlaces relativos (`../adr/…`, `../equipo/ROLES.md`, `../../backend-ia/benchmarks/results/…`).
- Cada pie de figura o tabla termina con `Fuente:` y el comando que la reproduce.

## Vista web

El informe y los ADR se publican como sitio web ([ADR-0020](../adr/0020-sitio-web-del-informe.md)).

- Vista previa local, desde la raíz del repositorio: `pip install -r requirements-docs.txt` y luego `mkdocs serve`.
- Publicar: en Actions, workflow `Publish report`, `Run workflow` desde `main`, indicando en `ref` la rama, tag o SHA a publicar; o bien `gh workflow run publish-report.yml -f ref=<rama>`.
- Un archivo nuevo del informe necesita su entrada en `nav` de `mkdocs.yml`; si falta, el build falla.

## Registro de figuras y tablas

Numeración por sección (`Figura 2.3.2.2-1`, `Tabla 1.3.3-2`). Este registro alimenta los índices 5 y 6 de la Fase B.

| Id | Tipo | Título | Sección | Fuente |
|---|---|---|---|---|
| Figura 1.2.2-1 | Figura | Componentes del sistema y cómo se comunican | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `backend/src/app.ts`, `backend/src/index.ts`, servicios citados en el pie |
| Tabla 1.2.2-1 | Tabla | Perfiles de usuario y permisos | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `backend/prisma/schema.prisma:18-24`, rutas citadas |
| Tabla 1.2.2-2 | Tabla | Historias del módulo de autenticación | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `gh issue list --label "type: story"` |
| Figura 1.2.2-2 | Figura | Inicio de sesión con segundo factor | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `backend/src/services/auth.service.ts`, `backend/src/services/two-factor/service.ts` |
| Tabla 1.2.2-3 | Tabla | Reglas del módulo de autenticación | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | código citado en la tabla |
| Tabla 1.2.2-4 | Tabla | Historias del módulo de reportes | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `gh issue list --label "type: story"` |
| Figura 1.2.2-3 | Figura | Estados de un reporte (`ReportStatus`) | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `backend/prisma/schema.prisma:136-143`, servicios citados |
| Tabla 1.2.2-5 | Tabla | Reglas del módulo de reportes | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | código citado en la tabla |
| Tabla 1.2.2-6 | Tabla | Historias del módulo de IA y matching | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `gh issue list --label "type: story"` |
| Figura 1.2.2-4 | Figura | Publicación con foto, moderación, matching, notificación y decisión | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `backend/src/services/matching.service.ts`, `backend-ia/app/services/` |
| Figura 1.2.2-5 | Figura | Estados de una coincidencia (`MatchStatus`) | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `backend/prisma/schema.prisma:216-222` |
| Tabla 1.2.2-7 | Tabla | Reglas del módulo de IA y matching | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | código citado en la tabla |
| Tabla 1.2.2-8 | Tabla | Historias del módulo de notificaciones | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `gh issue list --label "type: story"` |
| Tabla 1.2.2-9 | Tabla | Reglas del módulo de notificaciones | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | código citado en la tabla |
| Tabla 1.2.2-10 | Tabla | Historias del módulo de chat | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `gh issue list --label "type: story"` |
| Figura 1.2.2-6 | Figura | Chat por Socket.io con alternativa REST | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `backend/src/sockets/chat.socket.ts`, `frontend/src/hooks/useChatSocket.ts` |
| Tabla 1.2.2-11 | Tabla | Reglas del módulo de chat | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | código citado en la tabla |
| Tabla 1.2.2-12 | Tabla | Historias del módulo de flyers | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `gh issue list --label "type: story"` |
| Tabla 1.2.2-13 | Tabla | Reglas del módulo de flyers | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | código citado en la tabla |
| Tabla 1.2.2-14 | Tabla | Historias del módulo de moderación comunitaria | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `gh issue list --label "type: story"` |
| Figura 1.2.2-7 | Figura | Estados de una denuncia (`ReportFlagStatus`) | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `backend/prisma/schema.prisma:178-183` |
| Tabla 1.2.2-15 | Tabla | Reglas del módulo de moderación comunitaria | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | código citado en la tabla |
| Tabla 1.2.2-16 | Tabla | Historias del módulo de mapa | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `gh issue list --label "type: story"` |
| Tabla 1.2.2-17 | Tabla | Reglas del módulo de mapa | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | código citado en la tabla |
| Tabla 1.2.2-18 | Tabla | Historias del módulo de comercios | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `gh issue list --label "type: story"` |
| Tabla 1.2.2-19 | Tabla | Reglas del módulo de comercios | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | código citado en la tabla |
| Tabla 1.2.2-20 | Tabla | Tareas por milestone (conteo) | 1.2.2.3 ([`1-2-2-modelo-funcional.md`](1-2-2-modelo-funcional.md)) | `gh issue list --label "type: task"`, `gh api .../milestones` |
| Tabla 1.2.2-21 | Tabla | Tareas por milestone (detalle) | 1.2.2.3 ([`1-2-2-modelo-funcional.md`](1-2-2-modelo-funcional.md)) | `gh issue list --label "type: task"` |
| Tabla 1.2.1-1 | Tabla | Objetivos del PDD contrastados con el código | 1.2.1 ([`1-2-1-objetivos-y-alcances.md`](1-2-1-objetivos-y-alcances.md)) | `docs/pdd/PDD v1.0.docx`, código citado |
| Tabla 1.2.1-2 | Tabla | Alcance incluido en el PDD contrastado con el código | 1.2.1.1 ([`1-2-1-objetivos-y-alcances.md`](1-2-1-objetivos-y-alcances.md)) | `docs/pdd/PDD v1.0.docx`, código e issues citados |
| Tabla 1.2.1-3 | Tabla | Alcance excluido en el PDD | 1.2.1.1 ([`1-2-1-objetivos-y-alcances.md`](1-2-1-objetivos-y-alcances.md)) | `docs/pdd/PDD v1.0.docx`, `git ls-files` |
| Tabla 1.2.1-4 | Tabla | Desvíos del alcance respecto del PDD | 1.2.1.1 ([`1-2-1-objetivos-y-alcances.md`](1-2-1-objetivos-y-alcances.md)) | `docs/pdd/PDD v1.0.docx`, código e issues citados |
| Tabla 1.2.2-22 | Tabla | Actores del sistema | 1.2.2.1 ([`1-2-2-modelo-funcional.md`](1-2-2-modelo-funcional.md)) | `backend/prisma/schema.prisma:18-24`, rutas citadas |
| Figura 1.2.2-8 | Figura | Actores y subsistemas | 1.2.2.1 ([`1-2-2-modelo-funcional.md`](1-2-2-modelo-funcional.md)) | Tabla 1.2.2-22 y figuras 1.2.2-9 a 1.2.2-13 |
| Figura 1.2.2-9 | Figura | Casos de uso de cuenta y seguridad | 1.2.2.1 ([`1-2-2-modelo-funcional.md`](1-2-2-modelo-funcional.md)) | `backend/src/routes/auth.routes.ts` |
| Figura 1.2.2-10 | Figura | Casos de uso de reportes | 1.2.2.1 ([`1-2-2-modelo-funcional.md`](1-2-2-modelo-funcional.md)) | `backend/src/routes/reports.routes.ts`, `backend/src/routes/uploads.routes.ts` |
| Figura 1.2.2-11 | Figura | Casos de uso de IA, matching y moderación | 1.2.2.1 ([`1-2-2-modelo-funcional.md`](1-2-2-modelo-funcional.md)) | `backend/src/services/matching.service.ts`, `backend-ia/app/services/` |
| Figura 1.2.2-12 | Figura | Casos de uso de comunicación | 1.2.2.1 ([`1-2-2-modelo-funcional.md`](1-2-2-modelo-funcional.md)) | `backend/src/services/chats.service.ts`, `backend/src/services/notifications.service.ts` |
| Figura 1.2.2-13 | Figura | Casos de uso de comercios | 1.2.2.1 ([`1-2-2-modelo-funcional.md`](1-2-2-modelo-funcional.md)) | `backend/src/routes/businesses.routes.ts` |
| Tabla 1.2.2-23 | Tabla | Requerimientos funcionales del PDD con su trazabilidad | 1.2.2.1.1 ([`1-2-2-modelo-funcional.md`](1-2-2-modelo-funcional.md)) | `docs/pdd/PDD v1.0.docx`, `gh issue list`, código y pruebas citados |
| Tabla 1.2.2-24 | Tabla | Requerimientos funcionales agregados durante el desarrollo | 1.2.2.1.1 ([`1-2-2-modelo-funcional.md`](1-2-2-modelo-funcional.md)) | issues, código y pruebas citados |
| Tabla 1.2.2-25 | Tabla | Requerimientos no funcionales del PDD | 1.2.2.1.1 ([`1-2-2-modelo-funcional.md`](1-2-2-modelo-funcional.md)) | `gh run view 40526775901 --log`, archivos citados |
| Tabla 2.2.1-1 | Tabla | Integrantes y roles asignados | 2.2.1.1 ([`2-2-1-equipo-de-trabajo.md`](2-2-1-equipo-de-trabajo.md)) | `docs/equipo/ROLES.md`, sección 1 |
| Tabla 2.2.1-2 | Tabla | Puestos y tareas registradas | 2.2.1.2 ([`2-2-1-equipo-de-trabajo.md`](2-2-1-equipo-de-trabajo.md)) | `docs/equipo/ROLES.md`, sección 2 |
| Tabla 2.2.1-3 | Tabla | Asignación de puestos con su evidencia | 2.2.1.3 ([`2-2-1-equipo-de-trabajo.md`](2-2-1-equipo-de-trabajo.md)) | `docs/equipo/ROLES.md`, sección 2 |
| Tabla 2.2.2-1 | Tabla | Decisiones registradas y su estado | 2.2.2.4 ([`2-2-2-comunicacion-y-decisiones.md`](2-2-2-comunicacion-y-decisiones.md)) | `docs/adr/README.md`, `rg -n "Estado:" docs/adr` |
