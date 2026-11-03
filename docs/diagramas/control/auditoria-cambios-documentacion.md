# Auditoría de cambios en la documentación de diagramas

| Dato | Valor |
| --- | --- |
| Fecha de la auditoría | 2026-11-02 |
| Alcance | `docs/diagramas/` completo y su relación con el informe académico |
| Rama y commit de referencia | `main`, `f518b9a` ("Merge pull request #250 ...") |
| Modalidad | Solo lectura. No se modificaron archivos fuera de este documento y de `prompt-actualizacion-documental-claude-web.md` |
| Documento académico base identificado | `C:\Users\matia\OneDrive\Escritorio\Patitas-Informe-Final.docx` (2026-10-29 11:11, fuera del repositorio) |

## 1. Estado de Git

| Verificación | Resultado | Comando |
| --- | --- | --- |
| Cambios locales | `?? docs/diagramas/` (todo el directorio sin versionar) y ` M .claude/skills/documentacion/SKILL.md` | `git status --short` |
| Commits que tocan `docs/diagramas/` | Ninguno en ninguna rama local ni remota | `git ls-tree -r <rama> -- docs/diagramas` sobre las 13 ramas |
| Worktrees | `Grupo1` (`main`, `f518b9a`) y `Grupo1-worktrees/pr-239` (`franco/features`, `827b295`); este último no contiene `docs/diagramas/` | `git worktree list` |
| Tags y releases | Ninguno | `git tag` |
| Stashes | 4 (no inspeccionados en su contenido) | `git stash list` |
| Ramas con documentación del informe no integrada | `matias/features` y `origin/matias/features` contienen `docs/informe/1-2-3-pantallas.md`, `2-2-1-equipo-de-trabajo.md`, `2-2-2-comunicacion-y-decisiones.md` y `2-2-3-gestion-de-configuracion.md` (367 líneas agregadas), ausentes en `main` | `git diff --stat main...matias/features -- docs` |

Consecuencia: todo lo producido por los agentes existe solo en el árbol de trabajo local. No hay commit que lo respalde; el "commit" que citan los registros es el commit **analizado** (`f518b9a`), no un commit de los diagramas.

### Cambio local fuera de `docs/diagramas/`

`.claude/skills/documentacion/SKILL.md` agrega la sección "3. Resumen para Claude web": el `.docx` lo arma el PM en Claude Web a partir del documento actual. Esto contradice `docs/GENERAR_INFORME_DOCX.md` §1 ("El repositorio es la única fuente; lo editado a mano en Drive no se conserva") y §6 (generación con `tools/informe-docx/informe_docx.py`). Ver riesgo R-01.

## 2. Inventario de lo generado

`docs/diagramas/`: 390 archivos, 48 MB. 41 `candidate.json`, 52 HTML (41 diagramas + 11 hojas de contacto `visual-check`), 51 PNG, 7 SVG, 1 `.puml`, 43 `.md`, 233 JSON (fuentes y recibos), 6 carpetas `review-*` con ejecuciones anteriores.

### 2.1 Archivos de estructura y control

| Archivo | Última modificación | Estado observado |
| --- | --- | --- |
| `README.md` | 2026-11-02 10:20 | Desactualizado: afirma que el directorio "no contiene diagramas generados todavía". |
| `indice-maestro.md` | 2026-11-02 15:00 | 41 filas Archify + 1 UML. Encabezado aún dice "Plantilla". IDs D-32, D-33 y D-34 no asignados. |
| `matriz-trazabilidad.md` | 2026-11-02 15:00 | Filas para D-01 a D-31, D-35 a D-44 y U-01 (10 filas). Encabezado aún dice "Plantilla". |
| `control/criterios-documentacion.md` | 2026-11-02 10:20 | Reglas vigentes; sin observaciones. |
| `control/inventario-repositorio.md` | 2026-11-02 10:26 | Inventario al commit `f518b9a`. |
| `control/registro-fuentes.md` | 2026-11-02 15:00 | F-01 a F-51. F-38 (`docs/equipo/ROLES.md`) figura "pendiente de lectura", aunque D-17 ya lo usa. Sin fuentes propias de U-01 ni de D-17 a D-21 más allá de F-33, F-36, F-38, F-39. |
| `control/registro-ejecuciones.md` | 2026-11-02 15:00 | 36 filas (D-01 a D-16, D-22 a D-31, D-35 a D-44). **Faltan D-17 a D-21 y U-01.** |
| `control/pendientes-y-limitaciones.md` | 2026-11-02 15:01 | P-01 a P-22 y L-01 a L-10. P-01 a P-03 desactualizados (competidores ya identificados, inventario ya completado, índice ya definido). No registra los pendientes de D-17 a D-21 ni de U-01, que solo constan en sus `evidencia.md`/`README.md`. |
| `uml/casos-de-uso/.gitkeep` | 2026-11-02 10:20 | Debió eliminarse al recibir contenido (`README.md`, convención 5). |

### 2.2 Diagramas por fase y estado de validación

Verificación propia: para los 41 diagramas Archify, el recibo `*.finalize.json` vigente tiene `status: pass` y el SHA-256 registrado de `candidate.json` y del HTML coincide con los archivos actuales (no hubo ediciones posteriores a la validación). Los recibos superados en `review-*` o en la raíz (D-03, D-13, D-39, D-05 `review-2`, D-07 raíz) corresponden a ejecuciones reemplazadas, como consta en `registro-ejecuciones.md`.

| Fase | Diagramas | Estado en `indice-maestro.md` | Registro de ejecución | Imagen visible (PNG/SVG) | Revisión visual declarada |
| --- | --- | --- | --- | --- | --- |
| `01-relevamiento` | D-01, D-02, D-03 | 3 `validado` | Sí | Solo D-03 (capturas `visual-check/`) | D-03 realizada; D-01 y D-02 sin revisión |
| `02-diseno` | D-04 a D-16, D-35 a D-38 (17) | 17 `validado` | Sí | Solo D-04, D-05, D-06, D-07, D-08 | D-05 realizada; D-04, D-06, D-07, D-08 parcial; 12 sin revisión |
| `03-implementacion` | D-25 a D-31, D-39 a D-44 (13) | 13 `validado` | Sí | Ninguna | Sin revisión (L-10) |
| `04-planificacion` | D-17 a D-21 (5) | 5 `en-curso` | **No** | Las 5 (capturas en `exportaciones/`) | Captura clara 2048×1320 inspeccionada (según cada `evidencia.md`) |
| `05-pruebas` | D-22, D-23, D-24 | 3 `validado` | Sí | Ninguna | Sin revisión |
| UML `casos-de-uso` | U-01 (7 diagramas) | `en-curso` | **No** | 7 PNG + 7 SVG | Generado con PlantUML 1.2025.4, `-checkonly` sin errores (según `README.md`) |
| **Total** | **41 Archify + 1 UML (7 vistas)** | 36 `validado`, 6 `en-curso` | 36 de 42 | 11 Archify + 7 UML | — |

Observaciones:

- "Validado" en el índice significa "validación automatizada de Archify aprobada y registrada"; no implica revisión visual (criterio 4 de `criterios-documentacion.md`). 21 diagramas `validado` no tienen revisión visual declarada.
- D-17 a D-21 aprobaron `finalize` (verificado), pero siguen `en-curso` por falta de fila en `registro-ejecuciones.md`. Igual U-01.
- 30 diagramas Archify **no tienen ninguna exportación de imagen** (D-01, D-02, D-09 a D-16, D-22 a D-31, D-35 a D-44). Solo existen como HTML interactivo; para el informe hay que exportarlos desde el menú "Exportar" del HTML.
- Las 11 imágenes Archify disponibles son **capturas de pantalla del visor** (`*.visual-check.<ancho>x<alto>.<tema>.png`): incluyen la barra de herramientas del visor y recortan el diagrama a la ventana. Comprobado en `modelo-datos.visual-check.2048x1320.light.png` (tablas `ad_flags` y `report_matches` cortadas). Sirven como referencia para Claude Web, no como figura final.
- Las capturas son posteriores al HTML que retratan (fechas de modificación verificadas en las 11).

### 2.3 Detalle por diagrama

| ID | Título (según `registro-ejecuciones.md` o `evidencia.md`) | Tipo | HTML | Evidencia textual | Imagen disponible |
| --- | --- | --- | --- | --- | --- |
| D-01 | Competidor A: InfoAnimal SR, flujo observable | workflow | `archify/01-relevamiento/competidor-a/flujo-observable/flujo-observable.html` | `evidencia.md` | — |
| D-02 | Competidor B: Perritos Perdidos, flujo observable | workflow | `archify/01-relevamiento/competidor-b/flujo-observable/flujo-observable.html` | `evidencia.md` | — |
| D-03 | Contexto de PATITAS | architecture | `archify/01-relevamiento/contexto-patitas/contexto-patitas.html` | `evidencia.md` | `visual-check/contexto-patitas.visual-check.2048x1320.light.png` |
| D-04 | Descomposición funcional | tree | `archify/02-diseno/descomposicion-funcional/descomposicion-funcional.html` | `evidencia.md` | `visual-check/descomposicion-funcional.visual-check.2048x1320.light.png` |
| D-05 | Arquitectura lógica | architecture | `archify/02-diseno/arquitectura-logica/arquitectura-logica.html` | `evidencia.md` | `visual-check/arquitectura-logica.visual-check.2048x1320.light.png` |
| D-06 | Mapa de navegación | tree | `archify/02-diseno/navegacion/navegacion.html` | `evidencia.md` | `visual-check/navegacion.visual-check.2048x1320.light.png` |
| D-07 | Modelo de datos | erd | `archify/02-diseno/modelo-datos/modelo-datos.html` | `evidencia.md` | `visual-check/modelo-datos.visual-check.2048x1320.light.png` (recortada) |
| D-08 | Modelo de clases | class | `archify/02-diseno/modelo-clases/modelo-clases.html` | `evidencia.md` | `visual-check/modelo-clases.visual-check.2048x1320.light.png` |
| D-09 | Registro, verificación de email e inicio de sesión | workflow | `archify/02-diseno/workflows/registro-verificacion-sesion/registro-verificacion-sesion.html` | `evidencia.md` | — |
| D-10 | Publicación de un reporte de mascota perdida o encontrada | workflow | `archify/02-diseno/workflows/publicacion-reporte/publicacion-reporte.html` | `evidencia.md` | — |
| D-11 | Coincidencias por similitud: cálculo, aviso y decisión | workflow | `archify/02-diseno/workflows/coincidencias-matching/coincidencias-matching.html` | `evidencia.md` | — |
| D-12 | Búsqueda en el feed y consulta del detalle de un reporte | workflow | `archify/02-diseno/workflows/consulta-feed-detalle/consulta-feed-detalle.html` | `evidencia.md` | — |
| D-13 | Moderación comunitaria: denuncias de reportes y de anuncios | workflow | `archify/02-diseno/workflows/moderacion-denuncias/moderacion-denuncias.html` | `evidencia.md` | — |
| D-14 | Contacto con el autor de un reporte por chat | workflow | `archify/02-diseno/workflows/chat-contacto/chat-contacto.html` | `evidencia.md` | — |
| D-15 | Comercio: registro, plan Premium y publicación de anuncios | workflow | `archify/02-diseno/workflows/comercio-plan-anuncios/comercio-plan-anuncios.html` | `evidencia.md` | — |
| D-16 | Inicio de sesión con segundo factor opcional | sequence | `archify/02-diseno/secuencias/autenticacion/inicio-sesion-2fa/inicio-sesion-2fa.html` | `evidencia.md` | — |
| D-35 | Alta de un reporte con foto | sequence | `archify/02-diseno/secuencias/reportes/alta-reporte-con-foto/alta-reporte-con-foto.html` | `evidencia.md` | — |
| D-36 | Moderación por IA y cálculo de coincidencias | sequence | `archify/02-diseno/secuencias/ia/moderacion-matching/moderacion-matching.html` | `evidencia.md` | — |
| D-37 | Envío de un mensaje de chat por Socket.IO o REST | sequence | `archify/02-diseno/secuencias/chat/envio-mensaje/envio-mensaje.html` | `evidencia.md` | — |
| D-38 | Suscripción de un comercio al plan Premium | sequence | `archify/02-diseno/secuencias/comercios/suscripcion-premium/suscripcion-premium.html` | `evidencia.md` | — |
| D-25 | Arquitectura de despliegue | architecture | `archify/03-implementacion/despliegue/despliegue.html` | Sin `evidencia.md`; solo registros | — |
| D-26 | Flujo de datos y datos sensibles | dataflow | `archify/03-implementacion/flujo-datos/flujo-datos.html` | Sin `evidencia.md` | — |
| D-27 | Mapa de integraciones por estado | architecture | `archify/03-implementacion/integraciones/mapa/mapa-integraciones.html` | Sin `evidencia.md` | — |
| D-28 | Integración backend principal y Backend IA | sequence | `archify/03-implementacion/integraciones/secuencia-backend-ia/secuencia-backend-ia.html` | Sin `evidencia.md` | — |
| D-29 | Respaldo y restauración | workflow | `archify/03-implementacion/backup-restauracion/backup-restauracion.html` | Sin `evidencia.md` | — |
| D-30 | Migraciones, seeders y preparación de ambientes | workflow | `archify/03-implementacion/migraciones-seeders/migraciones-seeders.html` | Sin `evidencia.md` | — |
| D-31 | Integración continua y versionado técnico | workflow | `archify/03-implementacion/ci-cd/ci-cd.html` | Sin `evidencia.md` | — |
| D-39 | Ciclo de vida de un reporte (`ReportStatus`) | lifecycle | `archify/03-implementacion/ciclo-vida-publicaciones/reporte/reporte.html` | `evidencia.md` | — |
| D-40 | Ciclo de vida de una coincidencia (`MatchStatus`) | lifecycle | `archify/03-implementacion/ciclo-vida-publicaciones/coincidencia/coincidencia.html` | `evidencia.md` | — |
| D-41 | Ciclo de vida de una denuncia de reporte (`ReportFlagStatus`) | lifecycle | `archify/03-implementacion/ciclo-vida-publicaciones/denuncia-reporte/denuncia-reporte.html` | `evidencia.md` | — |
| D-42 | Ciclo de vida de un anuncio (`AdStatus`) | lifecycle | `archify/03-implementacion/ciclo-vida-publicaciones/anuncio/anuncio.html` | `evidencia.md` | — |
| D-43 | Ciclo de vida de una denuncia de anuncio (`AdFlagStatus`) | lifecycle | `archify/03-implementacion/ciclo-vida-publicaciones/denuncia-anuncio/denuncia-anuncio.html` | `evidencia.md` | — |
| D-44 | Ciclo de vida del plan de un comercio (`BusinessPlan`) | lifecycle | `archify/03-implementacion/ciclo-vida-publicaciones/plan-comercio/plan-comercio.html` | `evidencia.md` | — |
| D-17 | Estructura del equipo | tree | `archify/04-planificacion/estructura-equipo/estructura-equipo.html` | `evidencia.md` | `exportaciones/estructura-equipo.visual-check.2048x1320.light.png` |
| D-18 | Comunicación y decisiones | workflow | `archify/04-planificacion/comunicacion-decisiones/comunicacion-decisiones.html` | `evidencia.md` | `exportaciones/comunicacion-decisiones.visual-check.2048x1320.light.png` |
| D-19 | Versionado | workflow | `archify/04-planificacion/versionado/versionado.html` | `evidencia.md` | `exportaciones/versionado.visual-check.2048x1320.light.png` |
| D-20 | Hitos del proyecto | timeline | `archify/04-planificacion/hitos/hitos.html` | `evidencia.md` | `exportaciones/hitos.visual-check.2048x1320.light.png` |
| D-21 | Recursos del proyecto | tree | `archify/04-planificacion/recursos/recursos.html` | `evidencia.md` | `exportaciones/recursos.visual-check.2048x1320.light.png` |
| D-22 | Estructura de pruebas | tree | `archify/05-pruebas/validacion/tree-estructura-pruebas/estructura-pruebas.html` | `evidencia.md` | — |
| D-23 | Flujo de validación de una prueba | workflow | `archify/05-pruebas/validacion/workflow-flujo-validacion/flujo-validacion.html` | `evidencia.md` | — |
| D-24 | Pruebas de integración entre módulos | sequence | `archify/05-pruebas/integracion/sequence-integracion-modulos/integracion-modulos.html` | `evidencia.md` | — |
| U-01 | Casos de uso (general + 6 módulos) | UML | `uml/casos-de-uso/casos-de-uso.puml` | `uml/casos-de-uso/README.md` | `casos-de-uso.png` y `casos-de-uso-<módulo>.png` / `.svg` |

Rutas relativas a `docs/diagramas/`. Las imágenes de D-03 a D-21 están en la carpeta del diagrama.

U-01: 7 actores principales, 3 secundarios, 46 casos de uso (43 implementados, 3 planificados: CU-08 #187, CU-45 #38, CU-46 #224). El diagrama general excluye las relaciones `include`/`extend`, los casos CU-04, CU-05, CU-11, CU-12, CU-13, CU-14, CU-20, CU-26, CU-30 y los sistemas externos (verificado en `README.md` y en la imagen).

### 2.4 Contraste con el inventario aportado por el usuario

| Afirmación del inventario | Resultado de la verificación | Evidencia |
| --- | --- | --- |
| Cada diagrama tiene `candidate.json`, HTML y `evidencia.md` | **Parcial.** Los 41 tienen `candidate.json` y HTML; **D-25 a D-31 no tienen `evidencia.md`** (34 de 41 la tienen). | `find docs/diagramas -name evidencia.md` |
| Fases y IDs D-01 a D-31 y D-35 a D-44 | Coinciden en ruta, tipo y título. | `indice-maestro.md`; títulos `<title>` de cada HTML |
| Numeración D-01 a D-44 | **D-32, D-33 y D-34 no existen** en el índice, la matriz, los registros ni el disco. No hay documentación del motivo del salto. | Búsqueda de `D-3[234]` en `docs/diagramas/` |
| D-07: 18 tablas, 152 columnas | Coincide. | `archify/02-diseno/modelo-datos/evidencia.md:6`, `:54` |
| D-09 a D-15 "registro y sesión, publicación, coincidencias, feed y detalle, comercio" | Incompleta: también existen D-13 (moderación comunitaria) y D-14 (chat). | `indice-maestro.md` |
| D-24 "verificado por pruebas E2E de backend y frontend" | Matizar: las suites E2E usan un stub del Backend IA; ninguna prueba ejecuta ambos backends reales juntos. | `pendientes-y-limitaciones.md` P-05; `sequence-integracion-modulos/evidencia.md:16-17` |
| D-28 con reintentos y reconciliación | Coincide: reintentos ante red o 5xx (1 s, 5 s, 30 s); reconciliación cada 5 min. | `secuencia-backend-ia/candidate.json:188`, `:285` |
| D-29 con `.env` desde plantilla, recreación del esquema, regeneración de embeddings, reinicio de 2FA | Coincide en lo representado; el procedimiento de backup de base, R2 y `.env` figura como "No documentado". | `backup-restauracion/candidate.json:38`, `:85-90`; P-12 |
| Corrida 41448272798: backend 81 suites/1351 tests; frontend 99 archivos/935; Backend IA 77 aprobados y 2 omitidos; E2E UI sin dato | Coincide; el resultado E2E UI **sí consta**: 23 tests aprobados. | `tree-estructura-pruebas/evidencia.md:31-34` |
| `indice-maestro.md` registra D-22 a D-31 | Coincide. | `indice-maestro.md` |
| `matriz-trazabilidad.md` cubre 1.3.1, 1.3.3.1 a 1.3.3.6, 2.3.2.2.14 a 2.3.2.2.16 y Anexos N.º 10 y N.º 11 | Coincide; además cubre 2.3.2.2 (factibilidad técnica), 2.3.2.2.11 y 2.3.2.2.12. | Columna "Sección del informe" de la matriz |
| `registro-fuentes.md` F-40 a F-51 | Coincide (F-01 a F-51 en total). | `registro-fuentes.md` |
| `registro-ejecuciones.md` actualizado | Coincide para D-01 a D-16, D-22 a D-31, D-35 a D-44; **faltan D-17 a D-21 y U-01**. | `registro-ejecuciones.md` |
| U-01 en PlantUML con SVG y PNG general y por módulo | Coincide: 7 PNG y 7 SVG. | `uml/casos-de-uso/` |

## 3. Documento académico base

| Candidato | Situación | Conclusión |
| --- | --- | --- |
| `C:\Users\matia\OneDrive\Escritorio\Patitas-Informe-Final.docx` | 2026-10-29 11:11; 391 títulos, 20 imágenes, 49 tablas; estructura completa del template (capítulos 1 a 8 y Anexos 1 a 11) | **Base para Claude Web**: es la versión generada más reciente. |
| `C:\Users\matia\OneDrive\Escritorio\Patitas-Informe-Final-2026-10-28.docx` | 2026-10-28 21:58; 393 títulos | Versión anterior; no usar. |
| `docs/informe/*.md` (main) | Fuente del `.docx` según `docs/GENERAR_INFORME_DOCX.md` | Fuente canónica; no cambió desde la generación del `.docx`. |
| `docs/Template Presentacion Final (1).docx` | Esqueleto de la cátedra | Referencia de títulos; no es la base de contenido. |
| `tools/informe-docx/informe_docx.py` | Generador | No se usa en Claude Web. |

Estado del `.docx` base por sección (verificado por extracción de títulos y epígrafes):

- Con contenido: 1.1, 1.2.1, 1.2.2 (incluye Figuras 1.2.2-1 a 1.2.2-13 y Tablas 1.2.2-1 a 1.2.2-25), 1.2.4 (sin figuras), 1.3.1 (sin figuras), 1.3.3 (sin figuras), 2.2.2.4 (ADR).
- Solo con títulos de plantilla: 1.2.3 (títulos "Módulo de xxxxxxx"), 1.3.2, 1.3.4, 1.3.5, 2.1, 2.2.1, 2.2.2.1 a 2.2.2.3, 2.2.3, 2.3 completo, 3 y Anexos 1 a 11.
- Formato de epígrafe usado: "Figura X. Título. Fuente: ..." en un párrafo; numeración por sección (`Figura 1.2.2-8`, `Tabla 1.2.1-1`). Estilos `Título1` a `Título6`.

## 4. Relación con las secciones del informe

| Sección | Acción | Contenido | Diagramas | Imagen disponible |
| --- | --- | --- | --- | --- |
| 1.1.1.2.2 y 1.1.2.2.2 Modelo lógico | Evaluar; no agregar sin decisión | D-01 y D-02 representan el mismo objeto que las Figuras 1.1-3 y 1.1-7 existentes. Agregarlos duplicaría. | D-01, D-02 | No |
| 1.2.1 Objetivos y alcances definitivos | Agregar figura | Contexto del sistema (actores, sistemas externos). | D-03 | Sí (captura) |
| 1.2.2 Modelo funcional (introducción) | Agregar figura | Descomposición funcional por módulos. | D-04 | Sí (captura parcial) |
| 1.2.2.1 Diagrama de casos de uso | **Reemplazar** Figuras 1.2.2-8 a 1.2.2-13 (Mermaid aproximado) por UML; agregar Figura 1.2.2-14 (Moderación); reescribir el párrafo de notación; actualizar Tabla 1.2.2-22 (actores) | 7 actores principales, 3 secundarios, generalizaciones, 46 casos de uso con estado, relaciones `include`/`extend`, supuestos. | U-01 | Sí (7 PNG) |
| 1.2.2.1 (epígrafe Figura 1.2.2-10) | **Corregir** | Dice "La foto es opcional (#219)". El código la exige desde `e545c61` (2026-10-28): `backend/src/validators/reports.validator.ts:10` (`imageUrl: r2ImageUrlSchema`, sin `.optional()`). #219 está cerrado. | U-01 | — |
| 1.2.2.1.1 Lista de Requerimientos (Tabla 1.2.2-23) | **Corregir** | RF-06 "Parcial: solo API": existen `MyPetsPage`, `CreatePetPage`, `EditPetPage` (`frontend/src/router.tsx:27-29`, `:68-70`). RF-12 y RF-13 "No implementado": existen `notification-preferences.routes.ts`, `NotificationSettingsPage` (`router.tsx:62`) y la notificación `nearby_report` (`backend/src/services/notifications.service.ts:222-246`). Agregar columna o referencia a casos de uso (CU-xx). Issue #225 sigue abierto aunque está cubierto. | U-01 | — |
| 1.2.2.2.1 a 1.2.2.2.9 Flujo punta a punta | Reemplazar figuras Mermaid por Archify (mismo número) y agregar figuras nuevas | Reemplazos: D-16→1.2.2-2, D-39→1.2.2-3, D-36→1.2.2-4, D-40→1.2.2-5, D-37→1.2.2-6, D-41→1.2.2-7 (según `matriz-trazabilidad.md`). Nuevas: D-09, D-10, D-35, D-12, D-11, D-14, D-13, D-15, D-38, D-42, D-43, D-44. Corregir el texto según P-19 (alta sin foto que pasa a `published`; el reporte nace `pending`). | D-09 a D-16, D-35 a D-44 | **No** (exportar) |
| 1.2.3 Pantallas y reportes | Completar (si el equipo integra `1-2-3-pantallas.md`) | Mapa de navegación. El `.docx` base solo tiene títulos de plantilla; `1-2-3-pantallas.md` existe solo en `matias/features`. | D-06 | Sí (captura parcial) |
| 1.2.4 Modelo de datos | Agregar figura | ERD de 18 modelos; `report_embeddings.embedding` es `vector(768)` (`schema.prisma:210`). Registrar diferencias P-22. | D-07 | Sí (captura **recortada**) |
| 1.3.1 Programación y documentación | Agregar figura | Arquitectura lógica en "Organización del código". | D-05 | Sí (captura) |
| 1.3.3 Pruebas (1.3.3.1, 1.3.3.4) | Agregar figuras y actualizar cifras | Estructura de pruebas, flujo de validación, integración entre módulos. P-10: el informe cita la corrida 38512798771 (929/648/55/8 specs/18 tests); la corrida 41448272798 sobre `f518b9a` registra 1351/935/77/13 specs/23 tests. Limitaciones P-04 a P-09. | D-22, D-23, D-24 | **No** |
| 2.1.1.1 Hitos | Completar | 15 hitos con fecha y fuente; tabla planificado vs. real de 7 milestones (Sprints 0, 1, 2, 4 con atraso; 5 y 6 abiertos). | D-20 | Sí (captura) |
| 2.1.1.2 Etapas y actividades; 2.1.1.3 Diagrama de tiempos | Dejar pendiente | Sin fechas de etapas ni Gantt en el repositorio. | D-20 (parcial) | — |
| 2.2.1.1 y 2.2.1.3 Estructura y asignación | Completar | 4 integrantes al mismo nivel, roles y responsabilidades según `docs/equipo/ROLES.md`; cátedra. | D-17 | Sí (captura) |
| 2.2.1.2 Descripción de puestos | Dejar pendiente | No documentado. | — | — |
| 2.2.2.1 a 2.2.2.3 | Completar parcialmente | Issues, PR con `Closes #N`, revisión obligatoria, milestones. Sin minutas, canal formal ni devoluciones. | D-18 | Sí (captura) |
| 2.2.2.4 Decisiones | Completar la introducción | Circuito candidato → entrevista → ADR → reemplazo. Contradicción `docs/adr/README.md:9` vs. regla vigente (ver 5). | D-18 | Sí |
| 2.2.3.1 y 2.2.3.2 Versionado | Completar | Ramas personales, Conventional Commits, PR, CI, Snyk; versionado de documentación. Sin tags ni releases. | D-19 (y D-31 como complemento) | Sí (D-19) |
| 2.3.1 Diagrama de recursos | Completar | Recursos humanos y tecnológicos verificados; materiales, horas y hosting no disponibles. | D-21 | Sí (captura) |
| 2.3.3 Costos desagregados | Dejar pendiente | Sin datos (tarea #5 cerrada sin resultado). | D-21 | — |
| 2.3.2.2.2 Despliegue en el servidor | Completar con alcance limitado | Solo PostgreSQL contenedorizado; hosting de producción no definido (P-11). | D-25 | **No** |
| 2.3.2.2.11 Método de desarrollo y mantenimiento | Completar | CI/CD, migraciones. | D-31, D-23 | **No** |
| 2.3.2.2.12 Backups; 2.3.2.2.15 Recuperación | Completar con alcance limitado | Procedimiento no documentado (P-12): solo lo verificable. | D-29, D-28 | **No** |
| 2.3.2.2.14 Seguridad de los datos | Completar | Flujo de datos sensibles. | D-26, D-28 | **No** |
| 2.3.2.2.16 Integración con otros sistemas | Completar | Mapa de integraciones; secuencia backend–IA. | D-27, D-28 | **No** |
| Anexo N.º 1 Diagrama Gantt | Dejar vacío | No existe Gantt; D-20 no lo reemplaza (`hitos/evidencia.md`). | — | — |
| Anexo N.º 2 Minutas | Dejar vacío | Sin minutas. | — | — |
| Anexo N.º 5 Diagrama de casos de uso | Completar | Remisión a Figuras 1.2.2-8 a 1.2.2-14 o versión a página completa (decisión del equipo). | U-01 | Sí |
| Anexo N.º 6 Diagrama de clases | Completar | Modelo de clases. | D-08 | Sí (captura) |
| Anexo N.º 10 Backup y restauración | Completar con alcance limitado | Ídem 2.3.2.2.12. | D-29 | **No** |
| Anexo N.º 11 Migraciones/Seeders | Completar | El título del template dice "Sequelize"; el proyecto usa Prisma (ADR-0004). Conservar el título y aclarar (P-17). | D-30 | **No** |

## 5. Contradicciones e inconsistencias verificadas

| ID | Hallazgo | Evidencia |
| --- | --- | --- |
| C-01 | Foto del reporte: el informe la declara opcional; el código la exige. | Epígrafe de Figura 1.2.2-10 en el `.docx`; `reports.validator.ts:10`; commit `e545c61` (2026-10-28) |
| C-02 | RF-06, RF-12 y RF-13 mal clasificados en Tabla 1.2.2-23. | `docs/informe/1-2-2-modelo-funcional.md:308`, `:314-315`; `frontend/src/router.tsx:27-29`, `:62`, `:68-70`; `notifications.service.ts:222-246` |
| C-03 | Issue #225 abierto pese a que la interfaz de mascotas existe. | `gh issue view 225` (OPEN) |
| C-04 | `ROLES.md:108` fecha el commit `8ff5c26` el 2026-10-21; Git lo registra el 2026-10-14. | `git log -1 8ff5c26` |
| C-05 | Nombre de un integrante distinto entre PDD ("Diaz Bellomo Emiliano Agustín") y `ROLES.md` ("Agustín Díaz"). | `estructura-equipo/evidencia.md` (no reverificado en el PDD) |
| C-06 | `ROLES.md:29` atribuye plantillas de PR que se eliminaron en `80bc657` (2026-08-06). | `git log -1 80bc657` |
| C-07 | `docs/WORKFLOW.md:62` ("el autor mergea") vs. `:126` ("Code reviewer revisa y mergea"). | Lectura directa |
| C-08 | `docs/adr/README.md:9` ("Un ADR `Aceptada` no se edita") vs. `.claude/CLAUDE.md` y skill `documentacion` §2 (puede editarse para completarlo). | Lectura directa |
| C-09 | `README.md:160` enlaza `docs/DEPLOYMENT.md`, que no existe. | `ls docs/DEPLOYMENT.md` |
| C-10 | `docs/ARQUITECTURA.md` incluye Redis; no hay Redis en el código. | `ARQUITECTURA.md:46`, `:85`; F-37 |
| C-11 | `docs/informe/README.md` lista `1-2-3-pantallas.md`, `2-2-*.md`, `2-3-2-2-*.md`, `4-referencias.md` y `anexos/`, inexistentes en `main`. | `ls docs/informe` |
| C-12 | `docs/informe/1-2-1` afirma que no hay interfaz de mascotas ni edición de reportes ni preferencias de notificación, y menciona OpenCLIP; el código usa DINOv2 y tiene esas pantallas. | P-20 |
| C-13 | Resolver una denuncia pasa el reporte a `rejected` sin verificar su estado; un anuncio `PAUSED` puede pasar a `REMOVED`. | P-21 |
| C-14 | Convención de generación del `.docx` contradictoria (Claude Web vs. regeneración desde el repositorio). | `SKILL.md` (modificado, sin commit) vs. `docs/GENERAR_INFORME_DOCX.md` §1 y §6 |

## 6. Riesgos

| ID | Riesgo | Impacto | Mitigación propuesta |
| --- | --- | --- | --- |
| R-01 | Lo que Claude Web incorpore al `.docx` no está en `docs/informe/*.md`; una regeneración con `informe_docx.py` lo pierde (`GENERAR_INFORME_DOCX.md` §1). | Alto | Resuelto el 2026-11-02 por decisión del equipo: la fuente oficial son los `.md` de `docs/informe/`. El prompt para Claude Web pide los `.md` actualizados además del `.docx`; el equipo los incorpora al repositorio por PR. |
| R-02 | `docs/diagramas/` no está versionado: 390 archivos sin commit, sin PR y sin respaldo remoto. | Alto | Proponer commit en rama propia y PR (no realizado). |
| R-03 | 30 de 41 diagramas sin imagen exportada; Claude Web no puede verlos. | Alto | Exportar PNG/SVG desde el menú "Exportar" de cada HTML antes de la versión final; mientras tanto, marcadores de figura. |
| R-04 | Las 11 imágenes Archify son capturas de visor con barra de herramientas y recorte (D-07 confirmado). | Medio | Usarlas como referencia; reemplazarlas por exportaciones completas antes de entregar. |
| R-05 | Estado `en-curso` de D-17 a D-21 y U-01 por falta de registro de ejecución. | Medio | Registrar las ejecuciones en `registro-ejecuciones.md` (pendiente, fuera del alcance de esta auditoría). |
| R-06 | Duplicación con borradores no integrados de `matias/features` (2.2.1, 2.2.2, 2.2.3, 1.2.3). | Medio | Decidir si se integran antes de que Claude Web redacte esas secciones. |
| R-07 | Duplicación de D-01/D-02 con Figuras 1.1-3 y 1.1-7. | Bajo | Decisión del equipo. |
| R-08 | Revisión visual ausente en 21 diagramas `validado`. | Medio | Revisión visual al exportar. |
| R-09 | IDs D-22 a D-24 asignados en paralelo (L-07); huecos D-32 a D-34. | Bajo | Consolidar el índice. |
| R-10 | Archivos de control desactualizados (`README.md`, encabezados "Plantilla", P-01 a P-03, F-38, `.gitkeep`). | Bajo | Actualizar en una tarea de mantenimiento. |

## 7. Issues propuestos (no creados)

| Etiqueta | Título propuesto | Descripción |
| --- | --- | --- |
| `[DOCS]` | Corregir foto obligatoria y RF-06, RF-12, RF-13 en 1.2.2 | C-01, C-02, P-19, P-20. |
| `[DOCS]` | Alinear `.claude/skills/documentacion/SKILL.md` con la decisión del 2026-11-02 (fuente oficial: `docs/informe/*.md`) | C-14, R-01. |
| `[DOCS]` | Exportar en PNG/SVG los 30 diagramas Archify sin imagen | R-03, R-04. |
| `[DOCS]` | Registrar ejecuciones de D-17 a D-21 y U-01 y actualizar archivos de control | R-05, R-10. |
| `[DOCS]` | Resolver contradicciones de `ROLES.md`, `WORKFLOW.md`, `adr/README.md`, `README.md`, `ARQUITECTURA.md` | C-04 a C-11. |
| `[CHORE]` | Cerrar #225 o justificar por qué sigue abierto | C-03. |
| `[BUG]` | Validar estado previo al resolver denuncias y al remover anuncios pausados | C-13. |

## 8. Pendientes que requieren al equipo

- Reuniones, minutas y canal formal de comunicación (2.2.2.1, Anexo N.º 2).
- Devoluciones de la cátedra (2.2.2.3).
- Descripción y análisis de puestos y dedicación horaria (2.2.1.2).
- Fechas de inicio y fin de cada etapa (2.1.1.2) y diagrama Gantt (Anexo N.º 1).
- Recursos materiales y costos (2.3.1, 2.3.3).
- Hosting, dominio y TLS de producción (2.3.2.2.2, P-11); backups (P-12); configuración de R2 (P-13); SMTP y secretos (P-14); protección de `main` (P-15).
- Actor de "Suspender una cuenta" (#38).
- Formato de numeración de figuras en anexos (el `.docx` base no tiene precedente).
- Si el Anexo N.º 5 repite el diagrama general a página completa o remite a las Figuras 1.2.2-8 a 1.2.2-14.
