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

Prioridad: primero el template de la cátedra; lo que el template no define sigue APA 7.ª edición (tablas, figuras y notas); se agregan los elementos propios de una tesis (portada, índices).

Del template (no se modifica):

- Página A4; márgenes de 3 cm a izquierda y derecha y 2,5 cm arriba y abajo.
- Fuentes del tema del template (Aptos 11 pt en el cuerpo) y estilos de título 1 a 6, con la numeración literal de cada título.

APA 7:

- Tablas y figuras: número en negrita ("**Tabla 1.2.1-1**") y debajo el título en cursiva, ambos arriba de la tabla o de la imagen, alineados a la izquierda. Debajo, la fuente como nota: "*Nota.* Fuente: ...". El texto, el número y la fuente son los del epígrafe del Markdown ("Tabla X. Título. Fuente: ..."); solo cambia su ubicación y formato. No se inventan epígrafes.
- Tablas sin líneas verticales: solo una línea arriba, otra bajo el encabezado y otra al final. Encabezado en negrita y repetido en cada página; celdas en 10 pt con interlineado simple; las filas no se cortan entre páginas.
- Número de página arriba a la derecha en todas las páginas.

Propios de la tesis:

- Portada en la primera página: Universidad Tecnológica Nacional, Proyecto Final 2026, "PATITAS", "Informe Final", Grupo 1, integrantes (según `docs/pdd/PDD v1.0.docx`) y la fecha de generación. Facultad regional, carrera y docentes quedan como `[COMPLETAR]` mientras no estén en el repositorio.
- Índice de contenidos con números de página, hasta el nivel 5 de título.
- Índice de figuras e índice de tablas en los capítulos 5 y 6 del template, armados con los epígrafes.
- Cada capítulo (Título 1) empieza en página nueva.
- Imágenes y diagramas centrados, ajustados al ancho de página, sin deformar.
- Los índices y los números de página se calculan con Microsoft Word al generar el archivo, porque Google Drive no actualiza campos: el `.docx` llega a Drive con los índices completos.

## 5. Verificación antes de entregar

- Están todos los títulos del template, en orden y sin duplicar la numeración.
- Ningún título quedó pegado a un párrafo o a una viñeta.
- Cantidad de imágenes = imágenes de los `.md` + bloques Mermaid; cantidad de tablas = tablas de los `.md`.
- Los índices de contenidos, figuras y tablas tienen entradas y números de página (exportando a PDF con Word).
- Cantidad de entradas de los índices de figuras y tablas = cantidad de epígrafes "Figura" y "Tabla" de los `.md`.
- Revisión visual de una muestra de páginas (portada, índice, una tabla ancha, un diagrama).

## 6. Generador

`tools/informe-docx/informe_docx.py` implementa las secciones 1 a 4. Para completar los índices necesita Microsoft Word en Windows; sin Word (o con `--no-word`) los índices se completan al abrir el archivo en Word, no en Drive.

```bash
pip install -r requirements-docs.txt
npm i -g @mermaid-js/mermaid-cli@11.4.2
python tools/informe-docx/informe_docx.py --out <ruta>/Patitas-Informe-Final-AAAA-MM-DD.docx
python -m pytest tools/informe-docx
```

`--mmdc` indica el ejecutable de mermaid-cli si no está en el PATH.

## 7. Entrega

- Archivo: `Patitas-Informe-Final-AAAA-MM-DD.docx` en el Escritorio del usuario.
- Informe breve: commit de `main` usado, secciones con contenido, cantidad de imágenes, diagramas y tablas, `[COMPLETAR]` pendientes y cualquier diferencia con el sitio.
