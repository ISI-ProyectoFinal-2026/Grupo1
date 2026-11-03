# Prompt de actualización documental para Claude Web

| Dato | Valor |
| --- | --- |
| Fecha | 2026-11-02 (versión 2) |
| Documento oficial | `docs/doc_formal/Proyecto Final Patitas.docx` (editado por el equipo; última modificación 2026-11-02 09:48) |
| Insumos | `docs/informe/*.md`, `docs/adr/`, `docs/diagramas/` (auditoría, diagramas, evidencias e imágenes) |
| Acceso | Claude Web con permiso sobre la carpeta local del repositorio (`Grupo1`) |
| Commit analizado por los diagramas | `f518b9a` (`docs/diagramas/` y `docs/doc_formal/` no están versionados) |

## Cambios respecto de la versión 1

- La base deja de ser `docs/informe/*.md` y pasa a ser el `.docx` oficial. Los `.md` y los diagramas son insumo para completar, no fuente de estructura.
- Se eliminan los lotes de adjuntos: Claude Web lee la carpeta.
- Se ajusta la numeración a la del `.docx` oficial: 1.2.2.1.2 Lista de Requerimientos; 1.2.2.2 con 8 módulos; Anexo N.º 10 = ADR, N.º 11 = backup, N.º 12 = migraciones.
- Las figuras sin imagen exportada no se insertan en el documento oficial: se listan como pendientes.
- C1 y C3 ya no aparecen en el `.docx` (no contiene "OpenCLIP" ni "opcional"); se aplican solo si el texto erróneo figura.

## Hallazgos del `.docx` oficial que el prompt contempla

| Hallazgo | Tratamiento en el prompt |
| --- | --- |
| 1.2.2.1.1 "Casos de uso por subsistema" y Anexo N.º 5 usan 5 subsistemas; los diagramas UML usan 6 módulos (46 CU) | Decisión del equipo: no se reemplaza, se informa |
| 1.2.2.2 tiene 8 módulos; los `.md` tienen 9 (falta "Moderación comunitaria") | Decisión del equipo: no se agrega el título, se informa |
| Las HU saltan de HU-04 a HU-08 | Se informa |
| Las imágenes existentes no tienen epígrafe | Se informa; no se agregan epígrafes a imágenes existentes |
| La portada contiene "[NOMBRE DE LA COMPAÑÍA]" | Se informa |

## Prompt listo para copiar

````text
Actuá como editor técnico de una tesis de grado de Ingeniería en Sistemas de Información (UTN, Facultad Regional San Rafael, Proyecto Final 2026, proyecto PATITAS, Grupo 1). Escribí en español académico formal de Argentina, con el mismo registro del documento oficial.

Tenés acceso a la carpeta del repositorio. Todas las rutas de este mensaje son relativas a su raíz.

OBJETIVO
El documento oficial es docs/doc_formal/Proyecto Final Patitas.docx. Un integrante del equipo lo viene completando a mano. Tu tarea es incorporarle lo producido en la última actualización documental (diagramas, evidencias, auditoría y archivos .md) para completar lo vacío y mejorar lo incompleto, SIN pisar lo que ya está escrito.

ENTREGABLES
1. Un .docx nuevo: docs/doc_formal/Proyecto Final Patitas - 2026-11-02 v2.docx. No modifiques ni sobrescribas el original.
2. En el chat (no en el documento): REGISTRO DE CAMBIOS, CONFLICTOS PARA EL EQUIPO y FIGURAS PENDIENTES, con el formato indicado al final.

FUENTES (en orden de prioridad)
1. Estructura, numeración, estilos y texto existente: docs/doc_formal/Proyecto Final Patitas.docx. Manda sobre todo lo demás.
2. Contenido para completar: docs/informe/*.md, docs/adr/README.md y docs/adr/*.md.
3. Diagramas y evidencia: docs/diagramas/ (cada diagrama tiene un evidencia.md en su carpeta; las imágenes están en sus subcarpetas visual-check/ o exportaciones/, y los casos de uso en docs/diagramas/uml/casos-de-uso/).
4. Verificación y correcciones: docs/diagramas/control/auditoria-cambios-documentacion.md, docs/diagramas/control/pendientes-y-limitaciones.md, docs/diagramas/matriz-trazabilidad.md, docs/diagramas/indice-maestro.md.
5. Formato de epígrafes de figuras y tablas nuevas: docs/GENERAR_INFORME_DOCX.md.
Los archivos de control (auditoría, índice, matriz, registros) sirven para ubicar y verificar; su texto no se copia al documento.

PROCEDIMIENTO (sección por sección del .docx oficial)
Para cada título del .docx, compará su contenido con los insumos y aplicá exactamente uno de estos casos:
A) Título sin contenido y con insumos verificables: redactá el contenido a partir de los insumos.
B) Título con contenido y los insumos aportan información que falta: agregala al final de la sección o en el punto lógico, sin borrar ni reescribir lo existente.
C) El texto existente contradice un dato verificado en CORRECCIONES: corregí solo esa frase.
D) El texto existente difiere de los insumos y no está en CORRECCIONES: no lo cambies; anotalo en CONFLICTOS PARA EL EQUIPO.
E) Título sin contenido y sin insumos: dejalo vacío y anotalo en el registro.

REGLAS OBLIGATORIAS
1. No agregues, renombres, renumeres ni reordenes títulos. Usá los estilos de título del documento (Heading1 a Heading6) y su tipografía, formato de tablas y terminología.
2. No inventes datos, fechas, nombres, cifras, horas, costos ni justificaciones. Si un dato no está en los insumos, no lo escribas.
3. No dupliques: antes de agregar un párrafo, tabla o figura, verificá que no exista algo equivalente en el .docx. Si existe, no lo agregues; si el nuevo es mejor, anotalo en CONFLICTOS.
4. No modifiques imágenes ni tablas existentes salvo lo indicado en CORRECCIONES.
5. Figuras nuevas: insertalas solo si existe la imagen indicada. Centradas, ajustadas al ancho de página, con epígrafe según GENERAR_INFORME_DOCX.md ("Figura X. Título. Fuente: ..."), numeración por sección ("Figura 2.1.1-1"). Si la imagen no existe, no insertes nada y anotala en FIGURAS PENDIENTES. A las imágenes existentes sin epígrafe no les agregues epígrafe.
6. Tablas nuevas: epígrafe "Tabla X. Título. Fuente: ..." con numeración por sección.
7. El documento es autocontenido: no remitas a archivos .md ni a rutas como lectura necesaria. Solo se admiten como fuente en epígrafes y como referencias abribles (repositorio de GitHub, Issue #N, PR #N).
8. Las imágenes visual-check de Archify son capturas del visor: insertalas tal cual.
9. Actualizá los índices de figuras y tablas del documento (títulos 5 y 6) si el documento los genera; si son estáticos, anotalo en el registro.

CORRECCIONES VERIFICADAS (aplicar solo donde el dato erróneo aparezca en el .docx)
C1. La foto del reporte es obligatoria desde el commit e545c61 (2026-10-28): backend/src/validators/reports.validator.ts:10. Todo reporte nace en estado pending y pasa a published solo con el veredicto de la IA. Corregí cualquier frase que diga que la foto es opcional.
C2. Lista de Requerimientos (1.2.2.1.2): RF-06 no es "solo API": existe interfaz de mascotas (frontend/src/router.tsx:27-29 y :68-70). RF-12 y RF-13 están implementados: preferencias de notificación (backend/src/routes/notification-preferences.routes.ts; frontend/src/router.tsx:62) y notificación de reportes cercanos (backend/src/services/notifications.service.ts:222-246). Actualizá estado y evidencia con la matriz de trazabilidad; no inventes nombres de pruebas.
C3. Todo texto que afirme que no hay interfaz de mascotas, de edición de reportes o de preferencias de notificación, o que el modelo de embeddings es OpenCLIP, se corrige según P-19 y P-20 de pendientes-y-limitaciones.md: el modelo vigente es DINOv2 ViT-B/14 y el embedding es vector(768).
C4. 1.3.3: si el texto cita una corrida de CI anterior, no reemplaces cifras: agregá una nota con la corrida 41448272798 sobre el commit f518b9a (backend: 81 suites y 1351 tests aprobados; frontend: 99 archivos y 935 tests aprobados; Backend IA: 77 aprobados y 2 omitidos; E2E de interfaz: 13 specs y 23 tests aprobados), según P-10, indicando ambas fechas de corte.
C5. Anexo N.º 12: conservá el título. Agregá una oración: el proyecto usa Prisma como ORM y única fuente de migraciones (ADR-0004), no Sequelize.

SECCIONES (numeración del .docx oficial)
1.2.1 Objetivos y alcances definitivos: Figura 1.2.1-1 después del primer párrafo, con una oración que la introduzca (evidencia: docs/diagramas/archify/01-relevamiento/contexto-patitas/evidencia.md).
1.2.2 Modelo funcional: Figura 1.2.2-1 en la introducción, antes de 1.2.2.1 (evidencia: docs/diagramas/archify/02-diseno/descomposicion-funcional/evidencia.md).
1.2.2.1 Diagrama de casos de uso y 1.2.2.1.1: comparar con docs/diagramas/uml/casos-de-uso/README.md y casos-de-uso.puml. Si faltan, agregar: tabla de actores (7 principales, 3 secundarios y generalizaciones), la notación UML usada y el total (46 casos de uso, 43 implementados y 3 planificados: CU-08 #187, CU-45 #38, CU-46 #224). La organización por subsistemas del .docx difiere de los 6 módulos UML: no la cambies; anotala en CONFLICTOS. Incluí la Figura 1.2.2-2 (casos-de-uso.png, vista general) solo si en el documento no hay una vista general equivalente.
1.2.2.1.2 Lista de Requerimientos: aplicar C2. Si la tabla admite una columna más sin romper el formato, agregar la referencia CU-xx de cada RF según la matriz; si no, una tabla nueva "Trazabilidad entre requerimientos funcionales y casos de uso" al final de la sección.
1.2.2.2.1 a 1.2.2.2.8: comparar cada módulo con su equivalente en docs/informe/1-2-2-2-historias-y-flujos.md (por nombre de módulo, no por número: el .md tiene 9 módulos y el .docx 8). Completar solo lo que falte (historias, reglas de negocio, limitaciones) según el caso B, sin crear subtítulos. Al final de cada módulo, las figuras de la lista FIGURAS que correspondan, si tienen imagen. El contenido del módulo "Moderación comunitaria" del .md no tiene título en el .docx: anotalo en CONFLICTOS.
1.2.3.3 Pantallas: Figura 1.2.3-1 al inicio de la sección, con una oración de introducción, si no existe un mapa de navegación equivalente.
1.2.4 Modelo de Datos: Figura 1.2.4-1 después del primer párrafo. Si docs/diagramas/control/pendientes-y-limitaciones.md (P-22) documenta diferencias entre migraciones y schema.prisma y el .docx no las menciona, agregarlas en un párrafo.
1.3.1.1 Introducción: Figura 1.3.1-1 (arquitectura lógica) al final de la sección, antes de 1.3.1.1.1.
1.3.3 Pruebas: aplicar C4. Completar 1.3.3.3 y 1.3.3.5 solo si docs/informe/1-3-3-pruebas.md o las evidencias de docs/diagramas/archify/05-pruebas/ tienen datos; si no, dejarlas vacías. Agregar las limitaciones P-04 a P-09 donde correspondan si no figuran.
2.1.1.1 Hitos: redactar con docs/diagramas/archify/04-planificacion/hitos/evidencia.md: párrafo introductorio, Figura 2.1.1-1, "Tabla 2.1.1-1. Hitos del proyecto" (fecha, evento, estado, fuente) y "Tabla 2.1.1-2. Planificación frente a ejecución de los milestones". Los atrasos se mencionan solo como diferencia de fechas, sin atribuir causas.
2.2.1.1 Estructura del equipo y 2.2.1.3 Asignaciones de puestos: redactar con docs/diagramas/archify/04-planificacion/estructura-equipo/evidencia.md; Figura 2.2.1-1 en 2.2.1.1. Usá los nombres tal como figuran en el .docx oficial; si la evidencia muestra otro nombre para la misma persona, agregá "[VERIFICAR NOMBRE]".
2.2.2.1, 2.2.2.2 y 2.2.2.3: redactar solo lo verificable de docs/diagramas/archify/04-planificacion/comunicacion-decisiones/evidencia.md (issues, PR con "Closes #N", revisión obligatoria, milestones); Figura 2.2.2-1 en 2.2.2.1. No inventes reuniones, minutas, canales ni devoluciones de la cátedra.
2.2.2.4 Decisiones: párrafo con el circuito de decisiones de la misma evidencia (candidato, entrevista al PM, ADR y reemplazo), que remita al Anexo N.º 10. Si el Anexo N.º 10 no incluye ADR-0024 (docs/adr/0024-modelo-monetizacion.md), agregalo con el mismo formato que los demás.
2.2.3.1 y 2.2.3.2: redactar con docs/diagramas/archify/04-planificacion/versionado/evidencia.md; Figura 2.2.3-1 en 2.2.3.1. Indicar que no hay tags ni releases.
2.3.1 Diagrama de recursos: redactar con docs/diagramas/archify/04-planificacion/recursos/evidencia.md; Figura 2.3.1-1. Indicar como no disponibles: recursos materiales, dedicación horaria, hosting de producción y costos.
2.3.2.2.2, 2.3.2.2.11, 2.3.2.2.12, 2.3.2.2.14 y 2.3.2.2.16: como texto, solo lo que figura en pendientes-y-limitaciones.md para esos temas (P-11 a P-16, L-08 a L-10), redactado como limitación verificada. Sus figuras no tienen imagen: van a FIGURAS PENDIENTES.
Anexo N.º 6 Diagrama de clases: Figura A6-1 con una oración de introducción (evidencia: docs/diagramas/archify/02-diseno/modelo-clases/evidencia.md).
Anexo N.º 11 Backup y restauración: texto limitado a P-12.
Anexo N.º 12: aplicar C5.
El resto de los títulos vacíos (1.3.2, 1.3.4, 1.3.5, 2.1.1.2, 2.1.1.3, 2.2.1.2, 2.3.2.1, 2.3.2.3 a 2.3.5, 3, 4, Anexos N.º 1 a 4 y 7 a 9) se completa solo si los .md o las evidencias tienen datos verificables; si no, quedan vacíos.

FIGURAS (número | ubicación | título | imagen | fuente del epígrafe)
Todas las fuentes usan el commit f518b9a.
1.2.1-1 | 1.2.1 | Diagrama de contexto de PATITAS | docs/diagramas/archify/01-relevamiento/contexto-patitas/visual-check/contexto-patitas.visual-check.2048x1320.light.png | elaboración propia a partir de docs/diagramas/archify/01-relevamiento/contexto-patitas/contexto-patitas.html
1.2.2-1 | 1.2.2 | Descomposición funcional de PATITAS | docs/diagramas/archify/02-diseno/descomposicion-funcional/visual-check/descomposicion-funcional.visual-check.2048x1320.light.png | elaboración propia a partir de docs/diagramas/archify/02-diseno/descomposicion-funcional/descomposicion-funcional.html
1.2.2-2 | 1.2.2.1 | Diagrama general de casos de uso | docs/diagramas/uml/casos-de-uso/casos-de-uso.png | elaboración propia a partir de docs/diagramas/uml/casos-de-uso/casos-de-uso.puml
1.2.3-1 | 1.2.3.3 | Mapa de navegación de PATITAS | docs/diagramas/archify/02-diseno/navegacion/visual-check/navegacion.visual-check.2048x1320.light.png | elaboración propia a partir de docs/diagramas/archify/02-diseno/navegacion/navegacion.html
1.2.4-1 | 1.2.4 | Modelo de datos de PATITAS | docs/diagramas/archify/02-diseno/modelo-datos/visual-check/modelo-datos.visual-check.2048x1320.light.png | elaboración propia a partir de docs/diagramas/archify/02-diseno/modelo-datos/modelo-datos.html
1.3.1-1 | 1.3.1.1 | Arquitectura lógica de PATITAS | docs/diagramas/archify/02-diseno/arquitectura-logica/visual-check/arquitectura-logica.visual-check.2048x1320.light.png | elaboración propia a partir de docs/diagramas/archify/02-diseno/arquitectura-logica/arquitectura-logica.html
2.1.1-1 | 2.1.1.1 | Hitos del proyecto | docs/diagramas/archify/04-planificacion/hitos/exportaciones/hitos.visual-check.2048x1320.light.png | elaboración propia a partir de docs/diagramas/archify/04-planificacion/hitos/hitos.html
2.2.1-1 | 2.2.1.1 | Estructura del equipo | docs/diagramas/archify/04-planificacion/estructura-equipo/exportaciones/estructura-equipo.visual-check.2048x1320.light.png | elaboración propia a partir de docs/diagramas/archify/04-planificacion/estructura-equipo/estructura-equipo.html
2.2.2-1 | 2.2.2.1 | Comunicación, seguimiento y decisiones | docs/diagramas/archify/04-planificacion/comunicacion-decisiones/exportaciones/comunicacion-decisiones.visual-check.2048x1320.light.png | elaboración propia a partir de docs/diagramas/archify/04-planificacion/comunicacion-decisiones/comunicacion-decisiones.html
2.2.3-1 | 2.2.3.1 | Gestión de versionado del software y de la documentación | docs/diagramas/archify/04-planificacion/versionado/exportaciones/versionado.visual-check.2048x1320.light.png | elaboración propia a partir de docs/diagramas/archify/04-planificacion/versionado/versionado.html
2.3.1-1 | 2.3.1 | Recursos del proyecto | docs/diagramas/archify/04-planificacion/recursos/exportaciones/recursos.visual-check.2048x1320.light.png | elaboración propia a partir de docs/diagramas/archify/04-planificacion/recursos/recursos.html
A6-1 | Anexo N.º 6 | Modelo de clases de PATITAS | docs/diagramas/archify/02-diseno/modelo-clases/visual-check/modelo-clases.visual-check.2048x1320.light.png | elaboración propia a partir de docs/diagramas/archify/02-diseno/modelo-clases/modelo-clases.html
Casos de uso por módulo (casos-de-uso-*.png en docs/diagramas/uml/casos-de-uso/): no los insertes; el Anexo N.º 5 ya tiene diagramas por subsistema. Anotá en CONFLICTOS si los existentes difieren de los UML.

Diagramas sin imagen exportada (solo HTML): no se insertan. Listalos en FIGURAS PENDIENTES con la sección donde irían, usando su evidencia.md para ubicarlos. Son los HTML de docs/diagramas/archify/02-diseno/workflows/, 02-diseno/secuencias/, 03-implementacion/ y 05-pruebas/.

NO INCORPORAR
- Los identificadores D-32, D-33 y D-34 no existen.
- Los flujos de los competidores (InfoAnimal SR y grupos de Facebook): el capítulo 1.1 ya los cubre.
- El texto de los archivos de control.

FORMATO DE LA RESPUESTA EN EL CHAT
1. REGISTRO DE CAMBIOS: tabla con sección, caso aplicado (A, B, C o E), resumen del cambio, figuras y tablas agregadas.
2. CONFLICTOS PARA EL EQUIPO: tabla con sección, texto actual del .docx, dato de los insumos, archivo fuente. Incluí: subsistemas del .docx frente a los 6 módulos UML; módulo "Moderación comunitaria" sin título en 1.2.2.2; numeración de HU (de HU-04 pasa a HU-08); imágenes existentes sin epígrafe; "[NOMBRE DE LA COMPAÑÍA]" en la portada; y cualquier otra diferencia del caso D.
3. FIGURAS PENDIENTES: número propuesto, sección, título y ruta del HTML.
4. Numeración "Figura A<n>-<m>" para anexos: marcala "a confirmar por el equipo".

Antes de generar el .docx, respondé con un plan breve: lista de secciones con el caso (A a E) que vas a aplicar en cada una. Esperá mi confirmación ("Generar") y recién ahí generá el archivo.
````

## Antes de usar el prompt

1. Dar a Claude Web permiso sobre la carpeta raíz del repositorio (`Grupo1`), no solo sobre `docs/doc_formal/`.
2. Cerrar el `.docx` oficial en Word y confirmar que OneDrive terminó de sincronizarlo; si el compañero lo modificó después de las 09:48 del 2026-11-02, el plan de Claude Web debe hacerse sobre la versión nueva.
3. Revisar el plan que devuelve Claude Web antes de escribir "Generar".
4. Los conflictos que Claude Web informe los decide el equipo; no se resuelven en esta corrida.
