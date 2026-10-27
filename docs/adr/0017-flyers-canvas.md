# ADR-0017: Flyers con plantilla fija dibujada con canvas

- **Estado:** Aceptada
- **Responsables:** Matías Alvarado (POC y caché); Agustín Díaz (implementación)

## Decisión

Los flyers se generan automáticamente a partir de una plantilla fija, dibujada como imagen PNG de 1080×1920 con `@napi-rs/canvas` en el backend principal.

## Motivo

- Plantilla en vez de IA generativa: la IA inventa datos (como el teléfono) y deforma la foto, y un flyer de mascota perdida exige precisión (POC).
- Canvas en Node en vez de la plantilla HTML con Jinja2 y Playwright de la POC: se genera en el mismo servicio que tiene los datos y sin ejecutar un navegador completo, con binarios precompilados y sin dependencias del sistema (validación posterior).
- 1080×1920 (9:16) es el formato vertical de las historias de Instagram y los estados de WhatsApp, donde se comparten los flyers.

## Consecuencias

- La librería está en etapa pre-release; el riesgo se acota porque cada flyer se genera una vez y se cachea.

## Referencias

[POC de flyers](../pocs/poc_flyers.md), [PR #159](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/159), [PR #166](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/166), [PR #192](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/192).
