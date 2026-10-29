# Generación del informe final en .docx

Procedimiento que sigue Claude Code cuando el equipo pide "actualizar la documentación", "generar el informe" o "generar el docx". El pedido siempre significa una regeneración completa del documento, nunca una actualización parcial.

El `.docx` resultante se sube a Google Drive a mano (en Drive: clic derecho sobre el archivo existente → Administrar versiones → Subir nueva versión, para conservar el link que ven los docentes).

## 1. Fuente

- Rama `main` actualizada (`git pull`). El repositorio es la única fuente; lo editado a mano en Drive no se conserva.
- El contenido es el mismo que publica el sitio (https://isi-proyectofinal-2026.github.io/Grupo1/): los archivos de `nav` en `mkdocs.yml`, en ese orden.
- Si hubo cambios de documentación sin publicar, publicar antes el sitio (`publish-report.yml`) para que ambos coincidan.
- Se ignora el bloque de metadatos entre `---` al inicio de cada archivo.
- No se incluyen `docs/informe/README.md` ni `docs/adr/0000-plantilla.md`.

## 2. Estructura

- El esqueleto es el de `docs/Template Presentacion Final (1).docx`: todos sus títulos, en su orden y con su numeración, incluidos los capítulos 1 a 8 y los anexos.
- Cada archivo de `docs/informe/` se ubica en la sección del template con su mismo número raíz (ej.: `# 1.2.4 Modelo de Datos` → 1.2.4) y reemplaza los títulos de ejemplo de esa sección.
- El número define el nivel del título (1 → Título 1, 1.2 → Título 2, 1.2.4 → Título 3...). Los subtítulos sin número quedan un nivel por debajo de su sección.
- `1-2-2-2-historias-y-flujos.md` va dentro de 1.2.2, en lugar del apartado 1.2.2.2 de `1-2-2-modelo-funcional.md`.
- Los ADR van en 2.2.2.4 Decisiones: primero el índice (`docs/adr/README.md`) y después cada ADR en orden de número, con su título "ADR-00XX: ..." un nivel por debajo. Si un ADR tiene página de evidencia publicada en el sitio, va a continuación del ADR, con sus figuras y tablas.
- Las secciones del template sin contenido en el repositorio se mantienen con su título y sin texto.
- Todo título va en su propio párrafo (línea en blanco antes y después en el Markdown intermedio).

## 3. Contenido

- Transcripción fiel: no se agrega, resume ni reescribe texto, y no se inventan datos.
- Imágenes: todas las referenciadas en los `.md`, insertadas en su lugar desde el repositorio.
- Diagramas Mermaid: renderizados a PNG (mermaid-cli, fondo blanco, escala 2) e insertados como imagen.
- Métricas y gráficos del benchmark: los que estén referenciados en el informe, desde `backend-ia/benchmarks/results/`.
- Enlaces: a otra página del informe o a un ADR → URL de esa página en el sitio; a cualquier otro archivo del repositorio → `https://github.com/ISI-ProyectoFinal-2026/Grupo1/blob/main/<ruta>`; los externos se conservan.

## 4. Formato de tesis

- Página A4; márgenes de 2,5 cm y 3 cm el izquierdo.
- Portada en la primera página: "PATITAS", "Informe Final", "Grupo 1 - Proyecto Final 2026" y la fecha de generación. Institución, carrera, cátedra, integrantes y docentes quedan como `[COMPLETAR]` mientras no estén en el repositorio. Sin encabezado ni número de página.
- Índice de contenidos automático con números de página, en página propia, con todos los niveles de título numerados (índices y subíndices).
- Índice de figuras e índice de tablas automáticos en los capítulos 5 y 6 del template, armados con los epígrafes.
- Encabezado "Patitas - Informe Final" (9 pt, gris) y número de página centrado en el pie, desde el índice en adelante.
- Cuerpo: Arial 11 pt, interlineado 1,5, justificado, 6 pt después de cada párrafo.
- Títulos: Título 1 de 18 pt con salto de página antes; Título 2 de 15 pt; Título 3 de 13 pt; Título 4 de 12 pt; Títulos 5 y 6 de 11 pt (negrita y negrita cursiva). Negrita, alineados a la izquierda, un solo color oscuro.
- Tablas: ancho de página, bordes finos grises, primera fila en negrita con fondo gris claro y repetida en cada página, texto de celdas en 10 pt con interlineado simple.
- Epígrafes con el texto y la numeración del Markdown: "Tabla ..." arriba de la tabla y "Figura ..." debajo de la imagen, 9 pt cursiva, centrados. No se inventan epígrafes.
- Imágenes centradas, ajustadas al ancho de página, sin deformar.
- Código y nombres de archivo: Consolas 10 pt.

## 5. Verificación antes de entregar

- Están todos los títulos del template, en orden y sin duplicar la numeración.
- Ningún título quedó pegado a un párrafo o a una viñeta.
- Cantidad de imágenes = imágenes de los `.md` + bloques Mermaid; cantidad de tablas = tablas de los `.md`.
- Los índices de contenidos, figuras y tablas se generan al abrir el archivo.
- Revisión visual de una muestra de páginas (portada, índice, una tabla ancha, un diagrama).

## 6. Entrega

- Archivo: `Patitas-Informe-Final-AAAA-MM-DD.docx` en el Escritorio del usuario.
- Informe breve: commit de `main` usado, secciones con contenido, cantidad de imágenes, diagramas y tablas, `[COMPLETAR]` pendientes y cualquier diferencia con el sitio.
