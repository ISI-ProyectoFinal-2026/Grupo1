# Informe final (fuente en Markdown)

Fuente del informe final del proyecto Patitas. Refleja la numeración de la plantilla [`Template Presentacion Final (1).docx`](../Template%20Presentacion%20Final%20(1).docx). La Fase A cierra el 2026-11-03 para la revisión del 2026-11-04; la Fase B (incluida la generación del `.docx`) queda para después.

## Cómo usarlo

1. Buscar la sección en la tabla y abrir su archivo.
2. Cada afirmación o número cita un artefacto del repositorio (código, CI, PR, ADR, resultado del benchmark). Lo que no existe figura como `No disponible`.
3. Cada tecnología enlaza a su [ADR](../adr/README.md); las de IA enlazan además a un gráfico de `backend-ia/benchmarks/results/` y al comando que lo reproduce.

## Secciones

Evidencia: **R** repositorio, **I** entrevista, **N** no disponible todavía.

| Sección de la plantilla | Archivo | Fase | Evidencia |
|---|---|---|---|
| 1.1 Definición de requerimientos | — | B | I / N |
| 1.2.1-1.2.3 Alcances, modelo funcional, pantallas | — | B | R (PDD, issues, frontend) |
| 1.2.4 Modelo de datos | `1-2-4-modelo-de-datos.md` | A | R |
| 1.3.1 Programación y documentación | `1-3-1-programacion-y-documentacion.md` | A | R, ADR |
| 1.3.2, 1.3.4, 1.3.5 Capacitación, manuales, implementación | — | B | I |
| 1.3.3 Pruebas (1.3.3.5 `No disponible`, #40) | `1-3-3-pruebas.md` | A | R |
| 2.1 Actividades e hitos | — | B | R + I |
| 2.2.1 Equipo de trabajo | `2-2-1-equipo-de-trabajo.md` | A | R |
| 2.2.2.1-2.2.2.3 Comunicación, avance, devoluciones | `2-2-2-comunicacion-y-decisiones.md` | B | I |
| 2.2.2.4 Decisiones | `2-2-2-comunicacion-y-decisiones.md` | A | ADR |
| 2.2.3 Gestión de configuración | `2-2-3-gestion-de-configuracion.md` | A | R |
| 2.3.1, 2.3.2.1 Recursos, factibilidad operativa | — | B | I |
| 2.3.2.2 Factibilidad técnica (.1, .2, .4-.6, .11-.14, .16-.19) | `2-3-2-2-factibilidad-tecnica.md` | A | ADR, benchmark, código |
| 2.3.2.2 Factibilidad técnica (.3, .7-.10, .15) | `2-3-2-2-factibilidad-tecnica.md` | B | I |
| 2.3.2.3-2.3.5 Legal, ambiental, social, costos, riesgos | — | B | I / N |
| 3 Conclusión | — | B | — |
| 4 Referencias | `4-referencias.md` | A (parcial) | R |
| 5-8 Índices | — | B | generado con el `.docx` |
| Anexos 1-11 | `anexos/` | B | I / R |

Las subsecciones de Fase B dentro de un archivo de Fase A llevan el título y la marca `Pendiente (Fase B)`.

## Convención de archivos

- Un archivo por grupo de secciones, nombrado con la numeración de la plantilla.
- Encabezado YAML:

```yaml
---
seccion: "2.3.2.2"
titulo: "Factibilidad técnica"
nivel: 3
fase: A
estado: borrador
actualizado: 2026-10-22
---
```

| Campo | Valor |
|---|---|
| `seccion` | Número de la plantilla de la sección raíz del archivo |
| `titulo` | Título de la plantilla |
| `nivel` | Nivel de título (TituloN) del H1; permite desplazar los niveles al generar el `.docx` |
| `fase` | `A` o `B` |
| `estado` | `borrador`, `revisado` o `pendiente` |
| `actualizado` | Fecha de la última edición (AAAA-MM-DD) |

- Enlaces relativos (`../adr/…`, `../equipo/ROLES.md`, `../../backend-ia/benchmarks/results/…`).
- Cada pie de figura o tabla termina con `Fuente:` y el comando que la reproduce.

## Registro de figuras y tablas

Numeración por sección (`Figura 2.3.2.2-1`, `Tabla 1.3.3-2`). Este registro alimenta los índices 5 y 6 de la Fase B.

| Id | Tipo | Título | Sección | Fuente |
|---|---|---|---|---|
