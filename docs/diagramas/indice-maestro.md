# Índice maestro de diagramas

Plantilla. Una fila se agrega cuando se decide producir el diagrama y su estado se actualiza solo con evidencia en `control/registro-ejecuciones.md`.

## Estados permitidos

| Estado | Significado |
| --- | --- |
| `previsto` | Definido como necesario; sin trabajo iniciado. |
| `en-curso` | Fuente en elaboración. |
| `validado` | Fuente validada y registrada en `control/registro-ejecuciones.md`. |
| `descartado` | No se producirá; el motivo queda en `control/pendientes-y-limitaciones.md`. |

## Archify

| ID | Fase | Tema | Tipo | Ruta | Estado | Última ejecución |
| --- | --- | --- | --- | --- | --- | --- |
| D-01 | `01-relevamiento` | `competidor-a/flujo-observable` | `workflow` | `archify/01-relevamiento/competidor-a/flujo-observable/flujo-observable.html` | `validado` | 2026-11-02 |
| D-02 | `01-relevamiento` | `competidor-b/flujo-observable` | `workflow` | `archify/01-relevamiento/competidor-b/flujo-observable/flujo-observable.html` | `validado` | 2026-11-02 |
| D-03 | `01-relevamiento` | `contexto-patitas` | `architecture` | `archify/01-relevamiento/contexto-patitas/contexto-patitas.html` | `validado` | 2026-11-02 |
| D-05 | `02-diseno` | `arquitectura-logica` | `architecture` | `archify/02-diseno/arquitectura-logica/arquitectura-logica.html` | `validado` | 2026-11-02 |
| D-04 | `02-diseno` | `descomposicion-funcional` | `tree` | `archify/02-diseno/descomposicion-funcional/descomposicion-funcional.html` | `validado` | 2026-11-02 |
| D-06 | `02-diseno` | `navegacion` | `tree` | `archify/02-diseno/navegacion/navegacion.html` | `validado` | 2026-11-02 |
| D-09 | `02-diseno` | `workflows/registro-verificacion-sesion` | `workflow` | `archify/02-diseno/workflows/registro-verificacion-sesion/registro-verificacion-sesion.html` | `validado` | 2026-11-02 |
| D-10 | `02-diseno` | `workflows/publicacion-reporte` | `workflow` | `archify/02-diseno/workflows/publicacion-reporte/publicacion-reporte.html` | `validado` | 2026-11-02 |
| D-11 | `02-diseno` | `workflows/coincidencias-matching` | `workflow` | `archify/02-diseno/workflows/coincidencias-matching/coincidencias-matching.html` | `validado` | 2026-11-02 |
| D-12 | `02-diseno` | `workflows/consulta-feed-detalle` | `workflow` | `archify/02-diseno/workflows/consulta-feed-detalle/consulta-feed-detalle.html` | `validado` | 2026-11-02 |
| D-13 | `02-diseno` | `workflows/moderacion-denuncias` | `workflow` | `archify/02-diseno/workflows/moderacion-denuncias/moderacion-denuncias.html` | `validado` | 2026-11-02 |
| D-14 | `02-diseno` | `workflows/chat-contacto` | `workflow` | `archify/02-diseno/workflows/chat-contacto/chat-contacto.html` | `validado` | 2026-11-02 |
| D-15 | `02-diseno` | `workflows/comercio-plan-anuncios` | `workflow` | `archify/02-diseno/workflows/comercio-plan-anuncios/comercio-plan-anuncios.html` | `validado` | 2026-11-02 |
| D-16 | `02-diseno` | `secuencias/autenticacion/inicio-sesion-2fa` | `sequence` | `archify/02-diseno/secuencias/autenticacion/inicio-sesion-2fa/inicio-sesion-2fa.html` | `validado` | 2026-11-02 |
| D-35 | `02-diseno` | `secuencias/reportes/alta-reporte-con-foto` | `sequence` | `archify/02-diseno/secuencias/reportes/alta-reporte-con-foto/alta-reporte-con-foto.html` | `validado` | 2026-11-02 |
| D-36 | `02-diseno` | `secuencias/ia/moderacion-matching` | `sequence` | `archify/02-diseno/secuencias/ia/moderacion-matching/moderacion-matching.html` | `validado` | 2026-11-02 |
| D-37 | `02-diseno` | `secuencias/chat/envio-mensaje` | `sequence` | `archify/02-diseno/secuencias/chat/envio-mensaje/envio-mensaje.html` | `validado` | 2026-11-02 |
| D-38 | `02-diseno` | `secuencias/comercios/suscripcion-premium` | `sequence` | `archify/02-diseno/secuencias/comercios/suscripcion-premium/suscripcion-premium.html` | `validado` | 2026-11-02 |
| D-07 | `02-diseno` | `modelo-datos` | `erd` | `archify/02-diseno/modelo-datos/modelo-datos.html` | `validado` | 2026-11-02 |
| D-08 | `02-diseno` | `modelo-clases` | `class` | `archify/02-diseno/modelo-clases/modelo-clases.html` | `validado` | 2026-11-02 |
| D-25 | `03-implementacion` | `despliegue` | `architecture` | `archify/03-implementacion/despliegue/despliegue.html` | `validado` | 2026-11-02 |
| D-26 | `03-implementacion` | `flujo-datos` | `dataflow` | `archify/03-implementacion/flujo-datos/flujo-datos.html` | `validado` | 2026-11-02 |
| D-39 | `03-implementacion` | `ciclo-vida-publicaciones/reporte` | `lifecycle` | `archify/03-implementacion/ciclo-vida-publicaciones/reporte/reporte.html` | `validado` | 2026-11-02 |
| D-40 | `03-implementacion` | `ciclo-vida-publicaciones/coincidencia` | `lifecycle` | `archify/03-implementacion/ciclo-vida-publicaciones/coincidencia/coincidencia.html` | `validado` | 2026-11-02 |
| D-41 | `03-implementacion` | `ciclo-vida-publicaciones/denuncia-reporte` | `lifecycle` | `archify/03-implementacion/ciclo-vida-publicaciones/denuncia-reporte/denuncia-reporte.html` | `validado` | 2026-11-02 |
| D-42 | `03-implementacion` | `ciclo-vida-publicaciones/anuncio` | `lifecycle` | `archify/03-implementacion/ciclo-vida-publicaciones/anuncio/anuncio.html` | `validado` | 2026-11-02 |
| D-43 | `03-implementacion` | `ciclo-vida-publicaciones/denuncia-anuncio` | `lifecycle` | `archify/03-implementacion/ciclo-vida-publicaciones/denuncia-anuncio/denuncia-anuncio.html` | `validado` | 2026-11-02 |
| D-44 | `03-implementacion` | `ciclo-vida-publicaciones/plan-comercio` | `lifecycle` | `archify/03-implementacion/ciclo-vida-publicaciones/plan-comercio/plan-comercio.html` | `validado` | 2026-11-02 |
| D-27 | `03-implementacion` | `integraciones/mapa` | `architecture` | `archify/03-implementacion/integraciones/mapa/mapa-integraciones.html` | `validado` | 2026-11-02 |
| D-28 | `03-implementacion` | `integraciones/secuencia-backend-ia` | `sequence` | `archify/03-implementacion/integraciones/secuencia-backend-ia/secuencia-backend-ia.html` | `validado` | 2026-11-02 |
| D-29 | `03-implementacion` | `backup-restauracion` | `workflow` | `archify/03-implementacion/backup-restauracion/backup-restauracion.html` | `validado` | 2026-11-02 |
| D-30 | `03-implementacion` | `migraciones-seeders` | `workflow` | `archify/03-implementacion/migraciones-seeders/migraciones-seeders.html` | `validado` | 2026-11-02 |
| D-31 | `03-implementacion` | `ci-cd` | `workflow` | `archify/03-implementacion/ci-cd/ci-cd.html` | `validado` | 2026-11-02 |
| D-17 | `04-planificacion` | `estructura-equipo` | `tree` | `archify/04-planificacion/estructura-equipo/estructura-equipo.html` | `en-curso` | 2026-11-02 |
| D-18 | `04-planificacion` | `comunicacion-decisiones` | `workflow` | `archify/04-planificacion/comunicacion-decisiones/comunicacion-decisiones.html` | `en-curso` | 2026-11-02 |
| D-19 | `04-planificacion` | `versionado` | `workflow` | `archify/04-planificacion/versionado/versionado.html` | `en-curso` | 2026-11-02 |
| D-20 | `04-planificacion` | `hitos` | `timeline` | `archify/04-planificacion/hitos/hitos.html` | `en-curso` | 2026-11-02 |
| D-21 | `04-planificacion` | `recursos` | `tree` | `archify/04-planificacion/recursos/recursos.html` | `en-curso` | 2026-11-02 |
| D-22 | `05-pruebas` | `validacion/tree-estructura-pruebas` | `tree` | `archify/05-pruebas/validacion/tree-estructura-pruebas/estructura-pruebas.html` | `validado` | 2026-11-02 |
| D-23 | `05-pruebas` | `validacion/workflow-flujo-validacion` | `workflow` | `archify/05-pruebas/validacion/workflow-flujo-validacion/flujo-validacion.html` | `validado` | 2026-11-02 |
| D-24 | `05-pruebas` | `integracion/sequence-integracion-modulos` | `sequence` | `archify/05-pruebas/integracion/sequence-integracion-modulos/integracion-modulos.html` | `validado` | 2026-11-02 |

## UML

| ID | Tema | Ruta | Estado | Última ejecución | Uso en el informe |
| --- | --- | --- | --- | --- | --- |
| U-01 | `casos-de-uso` | `uml/casos-de-uso/casos-de-uso.puml` (exportaciones `.svg` y `.png` generadas, general y por módulo) | `en-curso` | — | 1.2.2.1 Diagrama de casos de uso; 1.2.2.1.1 Lista de Requerimientos (trazabilidad casos de uso–RF en `matriz-trazabilidad.md`); Anexo N.º 5: Diagrama de casos de uso |
