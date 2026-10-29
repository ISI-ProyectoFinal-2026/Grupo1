# Prompt para actualizar el informe en Google Docs

El informe formal vive en el Google Doc "Patitas - Informe Final". La fuente sigue siendo el repositorio: el Doc se actualiza con Claude Web (conector de Google Docs y acceso al repositorio de GitHub) usando el prompt de abajo.

## Flujo

1. Commitear los cambios de documentación en `main`.
2. Publicar el sitio del informe (workflow `publish-report.yml`).
3. Pegar el prompt en Claude Web, completando el link del Doc y las secciones modificadas.
4. Revisar el resumen que devuelve y los marcadores `[IMAGEN PENDIENTE]`.

Lo que se edite a mano en el Doc no vuelve al repositorio: si hay que cambiar contenido, se cambia en el `.md`.

## Prompt

````
Actualizá el Google Doc "Patitas - Informe Final" (<LINK DEL GOOGLE DOC>) a partir del repositorio de GitHub ISI-ProyectoFinal-2026/Grupo1, rama main.

Secciones a actualizar (archivo del repo → sección del Doc):
- <ej.: docs/informe/1-2-4-modelo-de-datos.md → 1.2.4>

Fuente y orden:
- El contenido del informe está en docs/informe/*.md y los ADR en docs/adr/*.md. El orden de las secciones es el de "nav" en mkdocs.yml.
- Ignorá el bloque de metadatos entre "---" al principio de cada archivo.

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

Al terminar, listá: secciones reemplazadas, imágenes y diagramas insertados, marcadores [IMAGEN PENDIENTE] que quedaron y diferencias sin resolver.
````
