# ADR-0020: Sitio web del informe con Material for MkDocs en GitHub Pages

- **Estado:** Pendiente
- **Responsables:** Matías Alvarado

## Decisión

El informe final y los ADR se publican como sitio web con Material for MkDocs en GitHub Pages, desplegado a pedido por un workflow manual. El Markdown del repositorio sigue siendo la única fuente.

## Motivo

- Compartir con el equipo y con el profesor una vista del informe organizada, navegable y descriptiva.
- Publicar a pedido mientras el trabajo avanza.
- Incluir los diagramas dibujados, las métricas del benchmark y las capturas de pantalla.
- Mantener el Markdown del repositorio como única fuente, con revisión por PR y trazabilidad.

## Alternativas

Notion (sin exportación nativa a Word y con una segunda copia para mantener), un `.docx` en Google Drive (peor lectura, cada archivo regenerado reemplaza al anterior y las cuentas de servicio no tienen cuota de almacenamiento en Drive) y Google Docs como fuente (se pierde la revisión por PR).

## Consecuencias

- Material for MkDocs está en modo mantenimiento y solo recibe correcciones críticas hasta mayo de 2027; su sucesor, Zensical, lee la misma configuración.
- GitHub Pages lo tiene que habilitar un administrador de la organización.
- La generación del `.docx` (Fase B) se puede agregar al mismo workflow.

## Referencias

[Anuncio de modo mantenimiento de Material for MkDocs](https://squidfunk.github.io/mkdocs-material/blog/2025/11/05/zensical/); [GitHub Pages con workflows propios](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
