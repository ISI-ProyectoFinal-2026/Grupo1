# Diagramas de PATITAS

Repositorio permanente de los diagramas, sus fuentes y sus exportaciones para la documentación académica del proyecto. Este directorio no contiene diagramas generados todavía: solo la estructura y los registros de control.

## Estructura

| Ruta | Finalidad |
| --- | --- |
| `indice-maestro.md` | Listado de todos los diagramas previstos, con su estado y ruta. |
| `matriz-trazabilidad.md` | Vínculo entre cada diagrama, su fuente en el repositorio y la sección del informe donde se usa. |
| `control/` | Reglas y registros que gobiernan la producción de diagramas. |
| `archify/` | Diagramas generados con la skill Archify, agrupados por fase. |
| `uml/` | Diagramas UML que no se generan con Archify. |

### `control/`

| Archivo | Finalidad |
| --- | --- |
| `criterios-documentacion.md` | Reglas de fidelidad técnica, trazabilidad, idioma, calidad visual y estado de funcionalidades. |
| `inventario-repositorio.md` | Inventario de los componentes del repositorio que sirven de evidencia. |
| `registro-fuentes.md` | Fuentes consultadas para cada diagrama. |
| `registro-ejecuciones.md` | Bitácora de cada ejecución de Archify y su validación. |
| `pendientes-y-limitaciones.md` | Cuestiones abiertas y límites verificables. |

### `archify/`

| Fase | Carpetas | Contenido previsto |
| --- | --- | --- |
| `01-relevamiento` | `competidor-a/flujo-observable`, `competidor-b/flujo-observable`, `contexto-patitas` | Flujos observables de competidores y contexto del sistema. |
| `02-diseno` | `arquitectura-logica`, `descomposicion-funcional`, `navegacion`, `secuencias`, `modelo-datos`, `modelo-clases` | Diseño del sistema. |
| `03-implementacion` | `despliegue`, `flujo-datos`, `ciclo-vida-publicaciones`, `integraciones`, `backup-restauracion`, `migraciones-seeders`, `ci-cd` | Cómo está construido y operado. |
| `04-planificacion` | `estructura-equipo`, `comunicacion-decisiones`, `versionado`, `hitos`, `recursos` | Gestión del proyecto. |
| `05-pruebas` | `validacion`, `integracion` | Estrategia y resultados de prueba. |

### `uml/`

| Carpeta | Contenido previsto |
| --- | --- |
| `casos-de-uso` | Diagramas de casos de uso. |

## Uso

1. Cada diagrama Archify tiene su propia subcarpeta dentro de la carpeta de su tema, con nombre `<tipo>-<slug>`.
2. Esa subcarpeta guarda: `candidate.json` (fuente), el HTML, la evidencia de validación y las exportaciones (SVG, PNG, WebM).
3. Al generar o regenerar un diagrama se actualizan, en este orden: `control/registro-ejecuciones.md`, `control/registro-fuentes.md`, `indice-maestro.md` y `matriz-trazabilidad.md`.
4. Los diagramas se redactan en español y siguen `control/criterios-documentacion.md`.
5. Las carpetas vacías conservan un `.gitkeep`; se elimina cuando la carpeta recibe su primer contenido.

## Convenciones

- Nombres de archivos y carpetas en minúsculas y con guiones.
- Ninguna entrada se marca como realizada hasta que exista su `candidate.json` y su registro de ejecución.
