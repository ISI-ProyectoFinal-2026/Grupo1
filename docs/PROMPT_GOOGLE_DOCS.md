# Prompt para actualizar el informe en Google Docs

El informe formal vive en el Google Doc "Patitas - Informe Final". La fuente sigue siendo el repositorio: el Doc se actualiza con Claude Web usando los prompts de abajo.

## Requisitos

- El archivo en Drive tiene que ser un Google Doc nativo, no un `.docx` subido (Abrir con → Documentos de Google).
- En Claude Web: conector de Google Docs activado (es distinto del de Google Drive, que no edita documentos) y acceso al repositorio de GitHub.
- Los diagramas Mermaid se insertan con `mermaid.ink`: ese dominio tiene que estar habilitado en la configuración de red de Claude Web. Si no lo está, quedan como `[IMAGEN PENDIENTE]`.

## Flujo

1. Commitear los cambios de documentación en `main`.
2. Publicar el sitio del informe (workflow `publish-report.yml`).
3. Pegar el prompt de actualización en Claude Web, completando el link del Doc y las secciones modificadas.
4. Revisar el resumen que devuelve y los marcadores `[IMAGEN PENDIENTE]`.

Lo que se edite a mano en el Doc no vuelve al repositorio: si hay que cambiar contenido, se cambia en el `.md`.

## Prompt de actualización

````
Actualizá el Google Doc "Patitas - Informe Final" (<LINK DEL GOOGLE DOC>) a partir del repositorio de GitHub ISI-ProyectoFinal-2026/Grupo1, rama main.

Secciones a actualizar (archivo del repo → sección del Doc):
- <ej.: docs/informe/1-2-4-modelo-de-datos.md → 1.2.4>

Fuente y orden:
- El contenido del informe está en docs/informe/*.md y los ADR en docs/adr/*.md. El orden de las secciones es el de "nav" en mkdocs.yml.
- Ignorá el bloque de metadatos entre "---" al principio de cada archivo.
- No se transcriben docs/informe/README.md ni docs/adr/0000-plantilla.md.

Reglas:
1. El repo es la única fuente. Transcribí fiel, sin agregar, resumir ni reescribir.
2. Ubicá en el Doc el título con el mismo número (ej.: "1.2.4 Modelo de Datos"). Reemplazá solo el contenido entre ese título y el siguiente título de igual o mayor nivel. No toques otras secciones.
3. Jerarquía: el número define el nivel (1 → Título 1, 1.2 → Título 2, 1.2.4 → Título 3, etc.). Los subtítulos sin número van un nivel por debajo de su sección. Usá los estilos de título existentes del Doc.
4. Tablas Markdown → tablas reales del Doc, con la primera fila como encabezado. Conservá los epígrafes ("Tabla ...", "Figura ...") tal cual.
5. Imágenes: cada ![texto](ruta) se inserta en su lugar con la URL
   https://raw.githubusercontent.com/ISI-ProyectoFinal-2026/Grupo1/main/<ruta resuelta desde la carpeta del archivo .md>
   (ej.: img/1-1/foto.png en docs/informe/ → .../main/docs/informe/img/1-1/foto.png).
6. Diagramas: cada bloque ```mermaid se inserta como imagen con la URL
   https://mermaid.ink/img/<código del diagrama en base64 URL-safe>?type=png&bgColor=white
7. Si una imagen o diagrama no se puede insertar, dejá [IMAGEN PENDIENTE: <URL>] en su lugar y seguí.
8. Enlaces relativos: si apuntan a otro .md del informe o a un ADR, usá la página del sitio https://isi-proyectofinal-2026.github.io/Grupo1/<ruta sin docs/ y sin .md>/ ; cualquier otro archivo, https://github.com/ISI-ProyectoFinal-2026/Grupo1/blob/main/<ruta>.
9. ADR: van dentro de 2.2.2.4 Decisiones: primero docs/adr/README.md y después cada ADR en orden de número, con su título "ADR-00XX: ..." un nivel por debajo de 2.2.2.4.
10. 1.2.2.2 (docs/informe/1-2-2-2-historias-y-flujos.md) va dentro de 1.2.2, reemplazando el apartado 1.2.2.2 de docs/informe/1-2-2-modelo-funcional.md.
11. Si una sección no existe en el Doc, no la inventes: avisame.
12. Aplicá al contenido nuevo el mismo formato que ya tiene el resto del Doc (estilos de párrafo, tablas, imágenes y epígrafes).

Al terminar, listá: secciones reemplazadas, imágenes y diagramas insertados, marcadores [IMAGEN PENDIENTE] que quedaron y diferencias sin resolver.
````

## Prompt de formato

Se usa una vez, o cuando el formato del Doc se desordena. No cambia contenido.

````
Dale formato de informe final de tesis al Google Doc "Patitas - Informe Final" (<LINK DEL GOOGLE DOC>). Solo formato: no agregues, quites, resumas ni reescribas texto, y no cambies la numeración ni el orden de las secciones.

Página
- A4, márgenes de 2,5 cm (izquierdo 3 cm para encuadernar).
- Encabezado desde la página del índice: "Patitas - Informe Final" a la izquierda, en gris, 9 pt. Pie: número de página centrado. Sin encabezado ni número en la portada.

Portada (primera página, antes del índice)
- Título "PATITAS", subtítulo "Informe Final", y debajo "Grupo 1 - Proyecto Final 2026".
- Para institución, carrera, cátedra, integrantes, docentes y fecha dejá [COMPLETAR] en su lugar. No inventes esos datos.
- Todo centrado vertical y horizontalmente, con salto de página al final.

Índice
- Índice de contenidos automático de Google Docs con números de página, en página propia, hasta el nivel 3.

Tipografía
- Cuerpo: Arial 11 pt, interlineado 1,5, justificado, 6 pt de espacio después de cada párrafo, sin sangría.
- Título 1: 18 pt, negrita, salto de página antes. Título 2: 15 pt, negrita. Título 3: 13 pt, negrita. Título 4: 12 pt, negrita. Títulos 5 y 6: 11 pt, negrita y negrita cursiva. Todos alineados a la izquierda, 18 pt de espacio antes y 6 pt después, color negro o un solo color oscuro para todos.
- Código y nombres de archivo (texto en fuente monoespaciada): Consolas 10 pt.

Tablas
- Ancho completo de la página, bordes finos grises, primera fila en negrita con fondo gris claro, texto de las celdas en 10 pt, interlineado simple, alineado a la izquierda.
- El epígrafe "Tabla ..." va arriba de la tabla, en 9 pt cursiva, centrado.

Imágenes y diagramas
- Centradas, con ancho máximo igual al ancho de la página y sin deformarlas.
- El epígrafe "Figura ..." va debajo, en 9 pt cursiva, centrado. Si una imagen no tiene epígrafe, no lo inventes.

Listas y enlaces
- Viñetas y numeraciones con sangría uniforme. Enlaces en azul, sin subrayado extra.

Limpieza
- Eliminá líneas en blanco dobles, espacios sobrantes y saltos de página vacíos. Las secciones vacías del template se mantienen con su título.

Al terminar, listá lo que aplicaste, lo que no pudiste aplicar con el conector y los [COMPLETAR] que quedaron.
````
