# ADR-0018: Criterio de evolución tecnológica

- **Estado:** Aceptada
- **Responsables:** Equipo (definido por Matías Alvarado, PM)

## Decisión

Mientras el sistema esté en construcción, ninguna tecnología, componente de infraestructura o decisión estructural es definitiva: se reemplaza cuando mejora de forma significativa el rendimiento o la calidad del producto. La mejora es significativa cuando se cumplen tres condiciones: está medida con un benchmark reproducible, el costo de migración (esfuerzo, riesgo de regresión, componentes afectados) está estimado y es compensado, y se registra en un ADR nuevo que reemplaza al anterior e incluye las métricas previas y posteriores.

## Motivo

- El proyecto está en etapa de construcción: si una tecnología mejora de forma significativa el rendimiento o la calidad, la idea es migrar.
- No se fija un porcentaje único, porque el peso de una mejora depende de la métrica (precisión, latencia, memoria, seguridad o mantenibilidad).

## Consecuencias

- Las decisiones vigentes pueden revisarse sin que eso implique un error previo.
- Los hallazgos del benchmark de IA que contradigan las decisiones actuales se registran como issues y se evalúan con este criterio, sin modificar el sistema antes de contar con la medición y la estimación de costo.

## Referencias

Aplicado en [ADR-0004](0004-prisma-5-orm.md) y [ADR-0006](0006-stack-frontend.md).
