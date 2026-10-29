---
name: documentacion
description: Reglas obligatorias para toda la documentación del proyecto. Trigger: crear o editar cualquier archivo en docs/ (informe, ADR, evidencia), generar el .docx del informe o publicar el sitio.
---

# Reglas de documentación

Aplican siempre que se toca documentación: `docs/informe/`, `docs/adr/` (incluida su evidencia), la generación del `.docx` (`docs/GENERAR_INFORME_DOCX.md`) y la publicación del sitio.

## 1. Referencias: sitio vs. documento final

- **Sitio (GitHub Pages)**: se puede referenciar y enlazar otros archivos. Ej.: "Tabla 1.1-4. Problemas y necesidades de InfoAnimal SR. Fuente: Figuras 1.1-1 y 1.1-2; PDD v1.0.docx, "Limitaciones identificadas"."
- **Documento final (`.docx`)**: autocontenido. Todo `.md` o archivo que una sección cite se desglosa dentro de esa misma sección, con sus tablas y figuras.
- En el `.docx` solo se admiten referencias que el lector puede abrir: repositorio de GitHub, PR #N, Issue #N, URLs públicas. Una cita a otra sección o ADR queda como texto ("ver ADR-0021") solo si ese contenido también está en el documento.

## 2. ADR

- Un ADR puede editarse para completarlo o corregirlo, aunque esté Aceptado.
- Si la decisión cambia (ej.: un modelo mejor que el elegido), no se reescribe el ADR: se crea uno nuevo desde `docs/adr/0000-plantilla.md` y el anterior pasa a `Reemplazada por ADR-XXXX`.
- La evidencia de un ADR (texto, tablas e imágenes) forma parte del ADR. Cada imagen lleva epígrafe: "Figura X. Título. Fuente: ...".
- La justificación la aporta el equipo; si no está documentada, se pregunta.

## 3. Portada del documento final

| Campo | Valor |
| --- | --- |
| Universidad | Universidad Tecnológica Nacional |
| Facultad | Facultad Regional San Rafael |
| Carrera | Ingeniería en Sistemas de Información |
| Materia | Proyecto Final 2026 |
| Proyecto | PATITAS — Informe Final |
| Grupo | Grupo 1 (integrantes según `docs/pdd/PDD v1.0.docx`) |
| Docentes | Hernán Zinik y Matías Varela |
| Fecha | Fecha de generación |

Implementada en `cover_lines` de `tools/informe-docx/informe_docx.py`.
