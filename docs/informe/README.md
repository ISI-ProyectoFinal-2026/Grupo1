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
| 1.1 Definición de requerimientos (1.1.1-1.1.4) | `1-1-1-competidores.md` | A | Capturas del equipo, PDD |
| 1.2.1 Objetivos y alcances definitivos | `1-2-1-objetivos-y-alcances.md` | A | R (PDD, código, issues) |
| 1.2.2 Modelo funcional (casos de uso, requerimientos, tareas) | `1-2-2-modelo-funcional.md` | A | R (PDD, issues, código) |
| 1.2.2.2 Historias de usuario y flujos por módulo | `1-2-2-2-historias-y-flujos.md` | A | R (issues, código) |
| 1.2.3 Pantallas y reportes (paleta, fuentes, pantallas) | `1-2-3-pantallas.md` | A | R (frontend) |
| 1.2.4 Modelo de datos | `1-2-4-modelo-de-datos.md` | A | R |
| 1.3.1 Programación y documentación | `1-3-1-programacion-y-documentacion.md` | A | R, ADR |
| 1.3.2, 1.3.4, 1.3.5 Capacitación, manuales, implementación | — | B | I |
| 1.3.3 Pruebas | `1-3-3-pruebas.md` | A | R |
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
| Tabla 1.1-1 | Tabla | Datos generales de InfoAnimal SR | 1.1.1.1.1 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | Figuras 1.1-1 y 1.1-2 |
| Tabla 1.1-2 | Tabla | Funciones detectadas en InfoAnimal SR | 1.1.1.1.2 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | Figura 1.1-1 |
| Tabla 1.1-3 | Tabla | Tecnología de información de InfoAnimal SR | 1.1.1.1.3 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | Figuras 1.1-1 y 1.1-2 |
| Figura 1.1-1 | Figura | Perfil de Instagram de InfoAnimal SR | 1.1.1.1.1 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | `docs/informe/img/1-1/infoanimal-perfil.png` |
| Figura 1.1-2 | Figura | Sitio `infoanimalsr.com` con error 503 | 1.1.1.2.1 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | `docs/informe/img/1-1/infoanimal-web-503.png` |
| Figura 1.1-3 | Figura | Modelo lógico de InfoAnimal SR | 1.1.1.2.2 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | Figuras 1.1-1 y 1.1-2 |
| Tabla 1.1-4 | Tabla | Problemas y necesidades de InfoAnimal SR | 1.1.1.2.3 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | Figuras 1.1-1 y 1.1-2, PDD v1.0 |
| Tabla 1.1-5 | Tabla | Datos generales de los grupos de Facebook | 1.1.2.1.1 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | Figuras 1.1-4 a 1.1-6 |
| Tabla 1.1-6 | Tabla | Funciones detectadas en el grupo Perritos Perdidos | 1.1.2.1.2 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | Figuras 1.1-4 a 1.1-6 |
| Tabla 1.1-7 | Tabla | Tecnología de información de los grupos de Facebook | 1.1.2.1.3 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | Figuras 1.1-4 a 1.1-6 |
| Figura 1.1-4 | Figura | Aviso comercial de una pollería en el grupo Perritos Perdidos | 1.1.2.2.1 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | `docs/informe/img/1-1/facebook-publicidad-1.png` |
| Figura 1.1-5 | Figura | Aviso comercial de lavandería y cabañas en el grupo Perritos Perdidos | 1.1.2.2.1 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | `docs/informe/img/1-1/facebook-publicidad-2.png` |
| Figura 1.1-6 | Figura | Publicación de mascota encontrada pendiente de aprobación | 1.1.2.2.1 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | `docs/informe/img/1-1/facebook-publicacion-pendiente.png` |
| Figura 1.1-7 | Figura | Modelo lógico del grupo Perritos Perdidos | 1.1.2.2.2 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | Figuras 1.1-4 a 1.1-6 |
| Tabla 1.1-8 | Tabla | Problemas y necesidades de los grupos de Facebook | 1.1.2.2.3 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | Figuras 1.1-4 a 1.1-6, PDD v1.0 |
| Tabla 1.1-9 | Tabla | Resumen de funcionalidades de los sistemas relevados | 1.1.3 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | Figuras 1.1-1 a 1.1-6 |
| Tabla 1.1-10 | Tabla | Objetivos específicos preliminares | 1.1.4.1 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | `docs/pdd/PDD v1.0.docx`, Tablas 1.1-4, 1.1-8, 1.1-9 |
| Tabla 1.1-11 | Tabla | Alcance preliminar del nuevo sistema | 1.1.4.2 ([`1-1-1-competidores.md`](1-1-1-competidores.md)) | `docs/pdd/PDD v1.0.docx` |
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
| Figura 1.2.2-7 | Figura | Estados de una denuncia (`ReportFlagStatus`) | 1.2.2.2 ([`1-2-2-2-historias-y-flujos.md`](1-2-2-2-historias-y-flujos.md)) | `backend/prisma/schema.prisma:180-186` |
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
| Tabla 1.3-1 | Tabla | Objetivos de performance (SLO-1 a SLO-6) | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `perf/results/` (commit `2eb4a9c`) |
| Tabla 1.3-2 | Tabla | Escenarios ejecutados frente a lo propuesto en el issue | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `perf/results/` (commit `2eb4a9c`) |
| Tabla 1.3-3 | Tabla | SLO frente a lo medido en el escalón de 200 VUs | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `perf/results/` (commit `2eb4a9c`) |
| Tabla 1.3-4 | Tabla | Carga: resultados por paso de VUs | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `perf/results/` (commit `2eb4a9c`) |
| Tabla 1.3-5 | Tabla | Punto de quiebre: resultados por escalón | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `perf/results/` (commit `2eb4a9c`) |
| Tabla 1.3-6 | Tabla | Estrés: resultados por nivel | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `perf/results/` (commit `2eb4a9c`) |
| Tabla 1.3-7 | Tabla | Picos: tasa y p95 por tramo | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `perf/results/` (commit `2eb4a9c`) |
| Tabla 1.3-8 | Tabla | Volumen: 1x frente a 10x | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `perf/results/` (commit `2eb4a9c`) |
| Tabla 1.3-9 | Tabla | Resistencia: veredictos y recursos | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `perf/results/` (commit `2eb4a9c`) |
| Tabla 1.3-10 | Tabla | Escalabilidad: capacidad de 1, 2 y 4 instancias | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `perf/results/` (commit `2eb4a9c`) |
| Tabla 1.3-11 | Tabla | Lighthouse CI: puntajes por ruta | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `perf/results/` (commit `2eb4a9c`) |
| Tabla 1.3-12 | Tabla | Overhead de Docker durante las corridas con observabilidad | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `perf/README.md` sección 13 (commit `fe0a359`) |
| Tabla 1.3-13 | Tabla | Repetición con observabilidad frente a la línea base (L y B) | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `perf/results/` (commit `fe0a359`) |
| Tabla 1.3-14 | Tabla | Recursos muestreados por escenario | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `perf/results/` (commit `2eb4a9c`) |
| Tabla 1.3-15 | Tabla | Recomendaciones como issues candidatos | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `perf/results/` (commit `2eb4a9c`) |
| Figura 1.3-1 | Figura | Carga: p95 por endpoint según el paso de VUs | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `docs/informe/img/1-3/fig-1-3-1-carga-p95.png`; `perf/scripts/make-report-figures.py` |
| Figura 1.3-2 | Figura | Punto de quiebre: curva de saturación | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `docs/informe/img/1-3/fig-1-3-2-punto-de-quiebre.png`; `perf/scripts/make-report-figures.py` |
| Figura 1.3-3 | Figura | Estrés: latencia y error por nivel | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `docs/informe/img/1-3/fig-1-3-3-estres.png`; `perf/scripts/make-report-figures.py` |
| Figura 1.3-4 | Figura | Picos: p95 en el tiempo | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `docs/informe/img/1-3/fig-1-3-4-picos.png`; `perf/scripts/make-report-figures.py` |
| Figura 1.3-5 | Figura | Volumen: 1x frente a 10x | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `docs/informe/img/1-3/fig-1-3-5-volumen.png`; `perf/scripts/make-report-figures.py` |
| Figura 1.3-6 | Figura | Resistencia: recursos y p95 por tercio | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `docs/informe/img/1-3/fig-1-3-6-resistencia.png`; `perf/scripts/make-report-figures.py` |
| Figura 1.3-7 | Figura | Escalabilidad: p95 por escalón en cada corrida | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `docs/informe/img/1-3/fig-1-3-7-escalabilidad.png`; `perf/scripts/make-report-figures.py` |
| Figura 1.3-8 | Figura | Lighthouse: puntajes por ruta | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `docs/informe/img/1-3/fig-1-3-8-lighthouse.png`; `perf/scripts/make-report-figures.py` |
| Figura 1.3-9 | Figura | Grafana: corrida de carga | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `docs/informe/img/1-3/fig-1-3-9-grafana-carga.png`; `perf/observability/capture.mjs` |
| Figura 1.3-10 | Figura | Grafana: corrida del punto de quiebre | 1.3.3.5 ([`1-3-3-pruebas.md`](1-3-3-pruebas.md)) | `docs/informe/img/1-3/fig-1-3-10-grafana-quiebre.png`; `perf/observability/capture.mjs` |
