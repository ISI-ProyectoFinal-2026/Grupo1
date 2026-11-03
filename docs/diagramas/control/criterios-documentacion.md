# Criterios de documentación de diagramas

Reglas obligatorias para todo diagrama de `docs/diagramas/`. Complementan al skill `documentacion`.

## 1. Fidelidad técnica

- Un diagrama representa solo lo que existe en el repositorio, en una fuente citada o en una decisión del equipo registrada.
- No se inventan componentes, flujos, cifras ni nombres para completar un diagrama.
- Si un dato no se puede verificar, se omite del diagrama y se registra en `pendientes-y-limitaciones.md`.
- Cada diagrama indica el commit analizado.

## 2. Trazabilidad

- Todo diagrama tiene una fila en `../indice-maestro.md` y en `../matriz-trazabilidad.md`.
- Cada elemento relevante remite a su evidencia: ruta de archivo, PR, Issue, ADR o URL pública.
- Cada ejecución queda en `registro-ejecuciones.md` y cada fuente consultada en `registro-fuentes.md`.
- El `.docx` final es autocontenido: las referencias deben poder abrirse (repositorio de GitHub, PR, Issue o URL pública).

## 3. Idioma

- Textos, etiquetas, leyendas y epígrafes en español.
- Los nombres propios del código (clases, tablas, endpoints, servicios) se mantienen tal como figuran en el repositorio.
- Epígrafe de cada figura: "Figura X. Título. Fuente: ...".

## 4. Calidad visual

- Salida generada con calidad `showcase`, salvo que la densidad del diagrama requiera `standard`.
- Se prioriza la legibilidad: etiquetas completas, sin solapamientos ni elementos cortados.
- Las exportaciones usadas en el informe deben leerse a tamaño de página.
- Una revisión visual solo se declara como realizada si se inspeccionaron las capturas; de lo contrario se informa como chequeo automatizado.

## 5. Estado de la funcionalidad

Cada elemento representado se clasifica y la clasificación se refleja en el diagrama:

| Estado | Criterio |
| --- | --- |
| Implementada | Existe en el código y se verificó. |
| Parcial | Existe en parte; se indica qué falta. |
| Planificada | Prevista, sin implementación en el repositorio. |
| No verificada | No se pudo confirmar. |

Nunca se presenta una funcionalidad planificada, parcial o no verificada como implementada.

## 6. Organización de archivos

- Nombres de archivos y carpetas en minúsculas y con guiones.
- Cada diagrama Archify vive en su carpeta `<tipo>-<slug>` y guarda `candidate.json`, el HTML, la evidencia y las exportaciones.
- No se modifica código, configuración ni documentación fuera de `docs/diagramas/` como parte de la producción de diagramas.
